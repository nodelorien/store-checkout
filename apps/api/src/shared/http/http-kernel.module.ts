import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { AllExceptionsFilter } from './all-exceptions.filter';

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const CREATE_TRANSACTION_RATE_LIMIT = { ttl: 60_000, limit: 10 } as const;

/** Cross-cutting HTTP behaviour: rate limiting and the error envelope for every failure. */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [
          { name: 'default', ttl: RATE_LIMIT_WINDOW_MS, limit: config.rateLimitPerMinute },
        ],
      }),
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class HttpKernelModule {}
