import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as fs from 'fs';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add('Environment', 'prod');
    cdk.Tags.of(this).add('Service', 'criptoinvest-alerting');

    // === DynamoDB: estado/cooldown dos alertas ===
    const alertStateTable = new dynamodb.Table(this, 'AlertStateTable', {
      tableName: 'alert_state',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // cost-optimized
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // === Secrets Manager (placeholders) ===
    // A lambda do seu repo lê:
    // - DATABASE_URL (OU DATABASE_URL_SECRET_ID que aponta para um SecretString contendo SOMENTE a connection string)
    // - SES_FROM_EMAIL via env direto (aqui injetamos usando dinâmica do SecretValue)
    const databaseUrlSecret = new secretsmanager.Secret(this, 'DatabaseUrlSecret', {
      secretName: 'criptoinvest/prod/database-url',
      description: 'Postgres connection string usada pela lambda price-check.',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      secretStringValue: cdk.SecretValue.unsafePlainText('REPLACE_ME_POSTGRES_CONNECTION_STRING'),
    });

    // === Lambda: price-check (cron via EventBridge) ===
    const priceCheckZipPath = path.resolve(__dirname, '..', '..', 'lambdas', 'price-check', 'lambda.zip');
    if (!fs.existsSync(priceCheckZipPath)) {
      throw new Error(
        `Arquivo nao encontrado: ${priceCheckZipPath}. Gere com:\n` +
          `cd lambdas/price-check && npm install && npm run build && npm run zip`,
      );
    }

    const priceCheckFn = new lambda.Function(this, 'PriceCheckFunction', {
      functionName: 'criptoinvest-price-check-prod',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(priceCheckZipPath),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.THREE_MONTHS,
      environment: {
        DDB_TABLE_ALERT_STATE: alertStateTable.tableName,
        DATABASE_URL_SECRET_ID: databaseUrlSecret.secretArn,
        // Não é um segredo sensível; mantemos placeholder até você ajustar.
        SES_FROM_EMAIL: 'no-reply@example.com',

        // Defaults seguros (você pode ajustar depois via Secrets/Env)
        SMS_ENABLED: 'false',
        COINGECKO_API_BASE_URL: 'https://api.coingecko.com/api/v3',
        RDS_SSL_REJECT_UNAUTHORIZED: 'false',
      },
    });

    alertStateTable.grantReadWriteData(priceCheckFn);
    databaseUrlSecret.grantRead(priceCheckFn);

    // Permissão para envio via SESv2 (SES action para SendEmail)
    priceCheckFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail'],
        resources: ['*'],
      }),
    );

    // === Agendamento (desativado por padrão) ===
    // Para evitar execução antes de você preencher os segredos reais.
    const scheduleRule = new events.Rule(this, 'PriceCheckSchedule', {
      description: 'Executa price-check para verificar alertas (desativado por padrão).',
      enabled: false,
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
    });

    scheduleRule.addTarget(new targets.LambdaFunction(priceCheckFn));
  }
}
