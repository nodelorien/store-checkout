import { SSMClient } from '@aws-sdk/client-ssm';
import { Global, Module } from '@nestjs/common';
import { NoopCache } from './cache/noop-cache';
import { createRedisClient, RedisCache } from './cache/redis-cache';
import { APP_CONFIG, AppConfig, loadConfig } from './config/app-config';
import { createSsmSecretFetcher } from './config/ssm-secret.fetcher';
import { createDocumentClient, DYNAMODB_DOCUMENT_CLIENT } from './dynamodb/dynamodb.client';
import { CACHE, Cache } from './ports/cache.port';
import { CLOCK } from './ports/clock.port';
import { FEES_CONFIG } from './ports/fees-config.port';
import { ID_GENERATOR } from './ports/id-generator.port';
import { CryptoIdGenerator, SystemClock } from './system/system-adapters';

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      // Fails the boot (and the Lambda cold start) when the environment is invalid.
      useFactory: (): Promise<AppConfig> =>
        loadConfig(
          process.env,
          createSsmSecretFetcher(new SSMClient({ region: process.env.AWS_REGION ?? 'us-east-1' })),
        ),
    },
    {
      provide: DYNAMODB_DOCUMENT_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createDocumentClient(config.aws),
    },
    {
      provide: CACHE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Cache =>
        config.cache.redisUrl
          ? new RedisCache(createRedisClient(config.cache.redisUrl))
          : new NoopCache(),
    },
    { provide: FEES_CONFIG, inject: [APP_CONFIG], useFactory: (config: AppConfig) => config.fees },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
  ],
  exports: [APP_CONFIG, DYNAMODB_DOCUMENT_CLIENT, CACHE, FEES_CONFIG, CLOCK, ID_GENERATOR],
})
export class SharedModule {}
