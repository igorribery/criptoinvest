# Lambda `price-check`

Esta lambda é acionada por cron (EventBridge Scheduler) para:

- ler alertas ativos no PostgreSQL (`price_alerts`)
- buscar preço spot em BRL (CoinGecko)
- aplicar cooldown/idempotência via DynamoDB
- enviar e-mail via SES (SMS via SNS fica pronto para quando você tiver telefone verificado)

## Variáveis de ambiente

- `AWS_REGION` (ex: `us-east-1`)
- `DDB_TABLE_ALERT_STATE` (ex: `alert_state`)
- `SES_FROM_EMAIL` (ex: `no-reply@seudominio.com`)
- `DATABASE_URL` **ou** `DATABASE_URL_SECRET_ID`
- `COINGECKO_API_BASE_URL` (opcional, default `https://api.coingecko.com/api/v3`)
- `SMS_ENABLED` (opcional, `true`/`false`)
- `RDS_SSL_REJECT_UNAUTHORIZED` (opcional, default `false`)
  - Para **Amazon RDS** (`*.rds.amazonaws.com`), a Lambda **sempre usa TLS** e remove `sslmode` da URL para não conflitar com o Node; com `false` evita o erro `self-signed certificate in certificate chain`.
  - Para validar certificado de verdade, use o bundle da AWS (`global-bundle.pem`) e `RDS_SSL_REJECT_UNAUTHORIZED=true` + CA (evolução futura).

## Build e zip

```bash
cd lambdas/price-check
npm install
npm run zip
```

Isso gera `lambda.zip` no mesmo diretório.

## Handler

Na console AWS, use:

- **Handler:** `index.handler` (o zip coloca `index.js` na raiz)
- Runtime: Node.js 20 ou 22 (evite 24 se der problema de compatibilidade)

Se preferir manter só a pasta `dist/` no zip, use **Handler:** `dist/index.handler`.

