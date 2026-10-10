import { AppConfig, Env } from '../../src/shared/config/app-config';

/** A complete, valid environment for configuration tests. Values are obviously fake. */
export function validEnv(overrides: Record<string, string | undefined> = {}): Env {
  return {
    NODE_ENV: 'test',
    TABLE_PRODUCTS: 'test-products',
    TABLE_CUSTOMERS: 'test-customers',
    TABLE_TRANSACTIONS: 'test-transactions',
    TABLE_DELIVERIES: 'test-deliveries',
    PAYMENT_GATEWAY_BASE_URL: 'https://gateway.test/v1',
    PAYMENT_GATEWAY_PUBLIC_KEY: 'pub_test_key',
    PAYMENT_GATEWAY_PRIVATE_KEY: 'prv_test_key',
    PAYMENT_GATEWAY_INTEGRITY_SECRET: 'test_integrity_secret',
    PAYMENT_GATEWAY_EVENTS_SECRET: 'test_events_secret',
    ...overrides,
  };
}

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    port: 3000,
    logLevel: 'error',
    corsOrigins: [],
    trustProxy: false,
    aws: { region: 'us-east-1', dynamoEndpoint: 'http://localhost:8000' },
    tables: {
      products: 'test-products',
      customers: 'test-customers',
      transactions: 'test-transactions',
      deliveries: 'test-deliveries',
    },
    fees: { baseFeeInCents: 250_000, deliveryFeeInCents: 800_000 },
    gateway: {
      baseUrl: 'https://gateway.test/v1',
      publicKey: 'pub_test_key',
      privateKey: 'prv_test_key',
      integritySecret: 'test_integrity_secret',
      eventsSecret: 'test_events_secret',
      timeoutMs: 1000,
      pollMaxMs: 9000,
      pollIntervalMs: 1500,
    },
    ...overrides,
  };
}
