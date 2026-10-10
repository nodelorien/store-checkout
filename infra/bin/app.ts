import { App } from 'aws-cdk-lib';
import * as path from 'node:path';
import { CheckoutStack } from '../lib/checkout-stack';
import { loadDeploymentConfig } from '../lib/config';

const root = path.resolve(__dirname, '..');

const config = loadDeploymentConfig(process.env, {
  apiCodePath: path.join(root, 'build', 'api'),
  webDistPath: path.resolve(root, '..', 'apps', 'web', 'dist'),
});

const app = new App();

new CheckoutStack(app, `checkout-${config.stage}`, {
  config,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  description: 'Store checkout: SPA, API and data',
});
