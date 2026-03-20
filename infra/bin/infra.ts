#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();

// Para deploy, o CDK precisa do account/region.
// Você pode passar via context:
//   npx cdk deploy -c account=123456789012 -c region=sa-east-1
const account =
  app.node.tryGetContext('account') ??
  process.env.CDK_DEFAULT_ACCOUNT ??
  process.env.AWS_ACCOUNT_ID ??
  undefined;
const region =
  app.node.tryGetContext('region') ??
  process.env.CDK_DEFAULT_REGION ??
  process.env.AWS_REGION ??
  'sa-east-1';

new InfraStack(app, 'InfraStack', {
  // Se account não estiver presente, o stack continua synth (env-agnostic),
  // mas o deploy tende a falhar com "Unable to resolve AWS account".
  env: account ? { account, region } : undefined,
});
