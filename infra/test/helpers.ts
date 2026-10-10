import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { CheckoutStack } from '../lib/checkout-stack';
import type { DeploymentConfig } from '../lib/config';

export const GATEWAY_ORIGIN = 'https://gateway.test';

export function testConfig(overrides: Partial<DeploymentConfig> = {}): DeploymentConfig {
  const apiCodePath = mkdtempSync(path.join(tmpdir(), 'api-code-'));
  writeFileSync(path.join(apiCodePath, 'index.js'), 'exports.handler = async () => ({});');
  const webDistPath = mkdtempSync(path.join(tmpdir(), 'web-dist-'));
  writeFileSync(path.join(webDistPath, 'index.html'), '<!doctype html>');

  return {
    stage: 'test',
    gatewayBaseUrl: `${GATEWAY_ORIGIN}/v1`,
    gatewayPublicKey: 'pub_test_key',
    baseFeeInCents: 250_000,
    deliveryFeeInCents: 800_000,
    apiCodePath,
    webDistPath,
    ...overrides,
  };
}

export function synthesize(overrides: Partial<DeploymentConfig> = {}): Template {
  const stack = new CheckoutStack(new App(), 'checkout-test', {
    config: testConfig(overrides),
    env: { account: '111111111111', region: 'us-east-1' },
  });
  return Template.fromStack(stack);
}
