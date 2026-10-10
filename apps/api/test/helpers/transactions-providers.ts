import { Provider } from '@nestjs/common';
import { CUSTOMER_REPOSITORY } from '../../src/modules/customers/application/ports/customer-repository.port';
import { UpsertCustomerUseCase } from '../../src/modules/customers/application/use-cases/upsert-customer.use-case';
import { PRODUCT_REPOSITORY } from '../../src/modules/products/application/ports/product-repository.port';
import { PAYMENT_GATEWAY_PORT } from '../../src/modules/transactions/application/ports/payment-gateway.port';
import { PAYMENT_POLL_CONFIG } from '../../src/modules/transactions/application/ports/payment-poll-config.port';
import { TRANSACTION_REPOSITORY } from '../../src/modules/transactions/application/ports/transaction-repository.port';
import { TransactionReconciler } from '../../src/modules/transactions/application/services/transaction-reconciler';
import { CreateTransactionUseCase } from '../../src/modules/transactions/application/use-cases/create-transaction.use-case';
import { GetTransactionUseCase } from '../../src/modules/transactions/application/use-cases/get-transaction.use-case';
import { ResolveTransactionUseCase } from '../../src/modules/transactions/application/use-cases/resolve-transaction.use-case';
import { CLOCK } from '../../src/shared/ports/clock.port';
import { FEES_CONFIG } from '../../src/shared/ports/fees-config.port';
import { ID_GENERATOR } from '../../src/shared/ports/id-generator.port';
import { FEES, POLL, TransactionsHarness } from './transactions-harness';

/**
 * Nest providers that wire the real use cases over the harness fakes, so controller specs go
 * through Nest's dependency injection exactly as production does.
 */
export function transactionProviders(h: TransactionsHarness): Provider[] {
  return [
    { provide: PRODUCT_REPOSITORY, useValue: h.productRepository },
    { provide: CUSTOMER_REPOSITORY, useValue: h.customerRepository },
    { provide: TRANSACTION_REPOSITORY, useValue: h.transactionRepository },
    { provide: PAYMENT_GATEWAY_PORT, useValue: h.gateway },
    { provide: CLOCK, useValue: h.clock },
    { provide: ID_GENERATOR, useValue: h.ids },
    { provide: FEES_CONFIG, useValue: FEES },
    { provide: PAYMENT_POLL_CONFIG, useValue: POLL },
    UpsertCustomerUseCase,
    ResolveTransactionUseCase,
    TransactionReconciler,
    CreateTransactionUseCase,
    GetTransactionUseCase,
  ];
}
