import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './all-exceptions.filter';

export const GLOBAL_RATE_LIMIT = { ttl: 60_000, limit: 60 } as const;
export const CREATE_TRANSACTION_RATE_LIMIT = { ttl: 60_000, limit: 10 } as const;

/** Cross-cutting HTTP behaviour: rate limiting and the error envelope for every failure. */
@Module({
  imports: [ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ...GLOBAL_RATE_LIMIT }] })],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class HttpKernelModule {}
