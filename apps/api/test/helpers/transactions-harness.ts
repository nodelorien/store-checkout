import { UpsertCustomerUseCase } from '../../src/modules/customers/application/use-cases/upsert-customer.use-case';
import { Product } from '../../src/modules/products/domain/product';
import { TransactionReconciler } from '../../src/modules/transactions/application/services/transaction-reconciler';
import {
  CreateTransactionInput,
  CreateTransactionUseCase,
} from '../../src/modules/transactions/application/use-cases/create-transaction.use-case';
import { GetTransactionUseCase } from '../../src/modules/transactions/application/use-cases/get-transaction.use-case';
import { ResolveTransactionUseCase } from '../../src/modules/transactions/application/use-cases/resolve-transaction.use-case';
import { aProduct, PRODUCT_ID } from '../builders/product.builder';
import { AN_ADDRESS } from '../builders/transaction.builder';
import { FakePaymentGateway } from '../fakes/fake-payment-gateway';
import { FakeClock, FakeIdGenerator } from '../fakes/fake-system';
import { InMemoryCustomerRepository } from '../fakes/in-memory-customer.repository';
import { InMemoryProductRepository } from '../fakes/in-memory-product.repository';
import { InMemoryTransactionRepository } from '../fakes/in-memory-transaction.repository';

export const FEES = { baseFeeInCents: 250_000, deliveryFeeInCents: 800_000 };
export const POLL = { maxMs: 9000, intervalMs: 1500 };

export function aCreateInput(
  overrides: Partial<CreateTransactionInput> = {},
): CreateTransactionInput {
  return {
    productId: PRODUCT_ID,
    quantity: 2,
    cardToken: 'tok_test_card_123',
    cardBrand: 'VISA',
    cardLastFour: '4242',
    installments: 1,
    acceptanceToken: 'acceptance-jwt',
    customer: { fullName: 'Ada Lovelace', email: 'ada@example.com', phone: '+573001234567' },
    delivery: { ...AN_ADDRESS },
    ...overrides,
  };
}

/** The whole transactions application layer wired over in-memory fakes. */
export function transactionsHarness(products: Product[] = [aProduct().withStock(5).build()]) {
  const clock = new FakeClock();
  const ids = new FakeIdGenerator();
  const productRepository = new InMemoryProductRepository(products);
  const customerRepository = new InMemoryCustomerRepository();
  const transactionRepository = new InMemoryTransactionRepository(productRepository);
  const gateway = new FakePaymentGateway();

  const upsertCustomer = new UpsertCustomerUseCase(customerRepository, clock, ids);
  const resolve = new ResolveTransactionUseCase(transactionRepository, clock, ids);
  const reconciler = new TransactionReconciler(gateway, resolve);
  const get = new GetTransactionUseCase(transactionRepository, reconciler);
  const create = new CreateTransactionUseCase(
    productRepository,
    transactionRepository,
    gateway,
    upsertCustomer,
    resolve,
    reconciler,
    FEES,
    POLL,
    clock,
    ids,
  );

  return {
    clock,
    ids,
    productRepository,
    customerRepository,
    transactionRepository,
    gateway,
    upsertCustomer,
    resolve,
    reconciler,
    get,
    create,
  };
}

export type TransactionsHarness = ReturnType<typeof transactionsHarness>;
