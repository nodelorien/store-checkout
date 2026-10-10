import { Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../shared/config/app-config';
import { CustomersModule } from '../customers/customers.module';
import { ProductsModule } from '../products/products.module';
import {
  PAYMENT_POLL_CONFIG,
  PaymentPollConfig,
} from './application/ports/payment-poll-config.port';
import { TRANSACTION_REPOSITORY } from './application/ports/transaction-repository.port';
import { TransactionReconciler } from './application/services/transaction-reconciler';
import { CreateTransactionUseCase } from './application/use-cases/create-transaction.use-case';
import { GetTransactionUseCase } from './application/use-cases/get-transaction.use-case';
import { HandleGatewayEventUseCase } from './application/use-cases/handle-gateway-event.use-case';
import { ResolveTransactionUseCase } from './application/use-cases/resolve-transaction.use-case';
import { PaymentGatewayModule } from './infrastructure/gateway/payment-gateway.module';
import { GatewayWebhookController } from './infrastructure/http/gateway-webhook.controller';
import { TransactionsController } from './infrastructure/http/transactions.controller';
import { DynamoDbTransactionRepository } from './infrastructure/persistence/dynamodb-transaction.repository';

@Module({
  imports: [ProductsModule, CustomersModule, PaymentGatewayModule],
  controllers: [TransactionsController, GatewayWebhookController],
  providers: [
    { provide: TRANSACTION_REPOSITORY, useClass: DynamoDbTransactionRepository },
    {
      provide: PAYMENT_POLL_CONFIG,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): PaymentPollConfig => ({
        maxMs: config.gateway.pollMaxMs,
        intervalMs: config.gateway.pollIntervalMs,
      }),
    },
    ResolveTransactionUseCase,
    TransactionReconciler,
    CreateTransactionUseCase,
    GetTransactionUseCase,
    HandleGatewayEventUseCase,
  ],
  exports: [TRANSACTION_REPOSITORY, ResolveTransactionUseCase],
})
export class TransactionsModule {}
