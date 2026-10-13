import { randomUUID } from 'node:crypto';
import { DeleteTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/bootstrap';
import { ProductProps } from '../../../src/modules/products/domain/product';
import { createTables } from '../../../src/seed/seed-runner';
import { TableNames } from '../../../src/seed/table-definitions';
import { APP_CONFIG, AppConfig, parseConfig } from '../../../src/shared/config/app-config';
import { createDocumentClient } from '../../../src/shared/dynamodb/dynamodb.client';
import { GatewayStub } from './gateway-stub';

export const DYNAMODB_ENDPOINT =
  process.env.INTEGRATION_DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
export const REDIS_URL = process.env.INTEGRATION_REDIS_URL ?? 'redis://localhost:6379';

const HINT = 'Start the services first: docker compose up -d dynamodb redis';

export interface IntegrationApp {
  readonly app: NestExpressApplication;
  readonly config: AppConfig;
  readonly tables: TableNames;
  readonly dynamo: DynamoDBDocumentClient;
  readonly redis: Redis;
  readonly gateway: GatewayStub;
  putProduct(product: ProductProps): Promise<void>;
  stockOf(productId: string): Promise<number>;
  close(): Promise<void>;
}

export function aProductItem(overrides: Partial<ProductProps> = {}): ProductProps {
  return {
    id: randomUUID(),
    name: 'Aurora Desk Lamp',
    description: 'Dimmable LED desk lamp',
    priceInCents: 12_990_000,
    currency: 'COP',
    imageUrl: '/images/catalog/aurora-desk-lamp.svg',
    stock: 5,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Boots the real `AppModule` — every module, repository and adapter — against DynamoDB Local,
 * Redis and the gateway stand-in. Each call gets its own tables, so files never share data.
 */
export async function startIntegrationApp(
  env: Record<string, string> = {},
): Promise<IntegrationApp> {
  const run = randomUUID().slice(0, 8);
  const tables: TableNames = {
    products: `it-${run}-products`,
    customers: `it-${run}-customers`,
    transactions: `it-${run}-transactions`,
    deliveries: `it-${run}-deliveries`,
  };

  const gateway = new GatewayStub();
  await gateway.start();

  const config = parseConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    // Each request names its own client address, so the rate limit never couples two tests.
    TRUST_PROXY: 'true',
    AWS_REGION: 'us-east-1',
    DYNAMODB_ENDPOINT,
    TABLE_PRODUCTS: tables.products,
    TABLE_CUSTOMERS: tables.customers,
    TABLE_TRANSACTIONS: tables.transactions,
    TABLE_DELIVERIES: tables.deliveries,
    REDIS_URL,
    PAYMENT_GATEWAY_BASE_URL: gateway.baseUrl,
    PAYMENT_GATEWAY_PUBLIC_KEY: 'pub_test_integration',
    PAYMENT_GATEWAY_PRIVATE_KEY: 'prv_test_integration',
    PAYMENT_GATEWAY_INTEGRITY_SECRET: 'test_integrity_integration',
    PAYMENT_GATEWAY_EVENTS_SECRET: 'test_events_integration',
    PAYMENT_GATEWAY_TIMEOUT_MS: '2000',
    PAYMENT_POLL_MAX_MS: '2000',
    PAYMENT_POLL_INTERVAL_MS: '50',
    ...env,
  }).match(
    (value) => value,
    (problems) => {
      throw new Error(problems.join('; '));
    },
  );

  const dynamo = createDocumentClient(config.aws, {});
  try {
    await createTables(dynamo, tables);
  } catch (cause) {
    await gateway.stop();
    throw new Error(`DynamoDB Local is not reachable at ${DYNAMODB_ENDPOINT}. ${HINT}`, { cause });
  }

  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
  redis.on('error', () => undefined);
  try {
    await redis.ping();
  } catch (cause) {
    redis.disconnect();
    await gateway.stop();
    throw new Error(`Redis is not reachable at ${REDIS_URL}. ${HINT}`, { cause });
  }

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .compile();
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>());
  app.useLogger(false);
  await app.init();

  return {
    app,
    config,
    tables,
    dynamo,
    redis,
    gateway,
    async putProduct(product) {
      await dynamo.send(new PutCommand({ TableName: tables.products, Item: { ...product } }));
    },
    async stockOf(productId) {
      const output = await dynamo.send(
        new GetCommand({
          TableName: tables.products,
          Key: { id: productId },
          ConsistentRead: true,
        }),
      );
      return Number(output.Item?.stock);
    },
    async close() {
      await app.close();
      const keys = await redis.keys(`*it-${run}-*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.quit();
      for (const name of Object.values(tables)) {
        await dynamo.send(new DeleteTableCommand({ TableName: name }));
      }
      dynamo.destroy();
      await gateway.stop();
    },
  };
}
