import { Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrors } from '../../../../shared/errors/domain-error';
import { CLOCK, Clock } from '../../../../shared/ports/clock.port';
import { FEES_CONFIG, FeesConfig } from '../../../../shared/ports/fees-config.port';
import { ID_GENERATOR, IdGenerator } from '../../../../shared/ports/id-generator.port';
import {
  err,
  errAsync,
  fromResult,
  ok,
  okAsync,
  Result,
  ResultAsync,
} from '../../../../shared/result/result';
import { UpsertCustomerUseCase } from '../../../customers/application/use-cases/upsert-customer.use-case';
import { CustomerContact, validateContact } from '../../../customers/domain/customer';
import { Address, AddressProps } from '../../../deliveries/domain/address';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from '../../../products/application/ports/product-repository.port';
import { Quantity } from '../../../products/domain/quantity';
import { Amounts } from '../../domain/amounts';
import { CardInfo, CardInfoProps } from '../../domain/card-info';
import { mapGatewayStatus, Transaction } from '../../domain/transaction';
import { isValidIdempotencyKey, TransactionReference } from '../../domain/transaction-reference';
import {
  GatewayCharge,
  PAYMENT_GATEWAY_PORT,
  PaymentGatewayPort,
} from '../ports/payment-gateway.port';
import { PAYMENT_POLL_CONFIG, PaymentPollConfig } from '../ports/payment-poll-config.port';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepository,
} from '../ports/transaction-repository.port';
import { TransactionReconciler } from '../services/transaction-reconciler';
import { ResolveTransactionUseCase } from './resolve-transaction.use-case';
import { toTransactionView, TransactionView } from './transaction.views';

export interface CreateTransactionInput {
  readonly productId: string;
  readonly quantity: number;
  readonly cardToken: string;
  readonly cardBrand: string;
  readonly cardLastFour: string;
  readonly installments: number;
  readonly acceptanceToken: string;
  readonly customer: CustomerContact;
  readonly delivery: Partial<AddressProps>;
  readonly idempotencyKey?: string;
}

export interface CreateTransactionOutput {
  readonly transaction: TransactionView;
  /** `true` when an existing transaction was returned for a repeated idempotency key. */
  readonly replayed: boolean;
}

interface ValidInput {
  readonly quantity: Quantity;
  readonly address: Address;
  readonly card: CardInfoProps;
  readonly idempotencyKey?: string;
}

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(PAYMENT_GATEWAY_PORT) private readonly gateway: PaymentGatewayPort,
    @Inject(UpsertCustomerUseCase) private readonly upsertCustomer: UpsertCustomerUseCase,
    @Inject(ResolveTransactionUseCase) private readonly resolve: ResolveTransactionUseCase,
    @Inject(TransactionReconciler) private readonly reconciler: TransactionReconciler,
    @Inject(FEES_CONFIG) private readonly fees: FeesConfig,
    @Inject(PAYMENT_POLL_CONFIG) private readonly pollConfig: PaymentPollConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Railway:
   *  1. validate (quantity, address, card, contact, idempotency key)   → VALIDATION_ERROR
   *  2. idempotency key already used → reconcile and return the original (replayed)
   *  3. product by id                                                   → PRODUCT_NOT_FOUND
   *  4. stock check (read only, ADR-0011)                               → OUT_OF_STOCK
   *  5. amounts from the stored price and server fees
   *  6. upsert customer
   *  7. store PENDING (lost an idempotency race → replay)               → PERSISTENCE_ERROR
   *  8. charge the gateway; on failure resolve as ERROR and return
   *                                  → PAYMENT_GATEWAY_REJECTED | PAYMENT_GATEWAY_UNAVAILABLE
   *  9. bounded poll for a final status → resolve (stock + delivery on approval)
   * A declined payment is a success: the transaction comes back with status DECLINED.
   */
  execute(input: CreateTransactionInput): Promise<Result<CreateTransactionOutput, DomainError>> {
    return fromResult(this.validate(input))
      .andThen((valid) =>
        this.findReplay(valid.idempotencyKey).andThen((existing) =>
          existing ? this.replay(existing) : this.createAndCharge(input, valid),
        ),
      )
      .toPromise();
  }

  private validate(input: CreateTransactionInput): Result<ValidInput, DomainError> {
    const key = input.idempotencyKey?.trim() || undefined;
    if (key !== undefined && !isValidIdempotencyKey(key)) {
      return err(
        DomainErrors.invalidField(
          'Idempotency-Key',
          'Idempotency-Key must have 8 to 128 letters, digits, dashes or underscores',
        ),
      );
    }
    return Quantity.create(input.quantity).andThen((quantity) =>
      CardInfo.create(input.cardBrand, input.cardLastFour, input.installments).andThen((card) =>
        validateContact(input.customer).andThen(() =>
          Address.create(input.delivery).map((address) => ({
            quantity,
            address,
            card,
            idempotencyKey: key,
          })),
        ),
      ),
    );
  }

  private findReplay(key: string | undefined): ResultAsync<Transaction | null, DomainError> {
    return key ? fromResult(this.transactions.findByIdempotencyKey(key)) : okAsync(null);
  }

  private replay(existing: Transaction): ResultAsync<CreateTransactionOutput, DomainError> {
    return this.reconciler
      .reconcile(existing)
      .map((transaction) => ({ transaction: toTransactionView(transaction), replayed: true }));
  }

  private createAndCharge(
    input: CreateTransactionInput,
    valid: ValidInput,
  ): ResultAsync<CreateTransactionOutput, DomainError> {
    return fromResult(this.products.findById(input.productId))
      .andThen((product) => product.ensureAvailable(valid.quantity))
      .andThen((product) =>
        product
          .price()
          .andThen((price) => Amounts.calculate(price, valid.quantity, this.fees))
          .map((amounts) => ({ product, amounts })),
      )
      .andThen(({ product, amounts }) =>
        fromResult(this.upsertCustomer.execute(input.customer)).map(({ customer }) => {
          const now = this.clock.now();
          const transaction = Transaction.createPending(
            {
              id: this.ids.uuid(),
              reference: TransactionReference.generate(now, this.ids),
              product: { id: product.id, name: product.name, imageUrl: product.imageUrl },
              quantity: valid.quantity.value,
              customerId: customer.id,
              amounts,
              currency: product.currency,
              shippingAddress: valid.address.toProps(),
              card: valid.card,
            },
            now,
          );
          return { transaction, customerEmail: customer.email };
        }),
      )
      .andThen(({ transaction, customerEmail }) =>
        fromResult(this.transactions.create(transaction, valid.idempotencyKey)).andThen(
          (outcome) =>
            outcome === 'DUPLICATE_KEY'
              ? this.replayAfterLostRace(valid.idempotencyKey)
              : this.chargeAndResolve(transaction, input, customerEmail).map((settled) => ({
                  transaction: toTransactionView(settled),
                  replayed: false,
                })),
        ),
      );
  }

  /** Another request with the same key stored its transaction between our lookup and our write. */
  private replayAfterLostRace(
    key: string | undefined,
  ): ResultAsync<CreateTransactionOutput, DomainError> {
    return this.findReplay(key).andThen((existing) =>
      existing
        ? this.replay(existing)
        : errAsync<DomainError, CreateTransactionOutput>(DomainErrors.persistence()),
    );
  }

  private chargeAndResolve(
    transaction: Transaction,
    input: CreateTransactionInput,
    customerEmail: string,
  ): ResultAsync<Transaction, DomainError> {
    const props = transaction.toProps();
    return fromResult(
      this.gateway.createCharge({
        reference: props.reference,
        amountInCents: props.amounts.totalInCents,
        currency: props.currency,
        customerEmail,
        cardToken: input.cardToken,
        installments: props.installments,
        acceptanceToken: input.acceptanceToken,
      }),
    )
      .orElse((error) => this.failCharge(transaction, error))
      .andThen((charge) => this.settle(transaction, charge));
  }

  /**
   * The charge request failed, so no payment exists: close the transaction as `ERROR` and
   * return the gateway error (with the transaction identifiers so the client can show them).
   * The charge is never retried automatically (double-charge risk).
   */
  private failCharge(
    transaction: Transaction,
    error: DomainError,
  ): ResultAsync<GatewayCharge, DomainError> {
    const withContext: DomainError = {
      ...error,
      details: [
        { field: 'transactionId', message: transaction.id },
        { field: 'reference', message: transaction.reference },
      ],
    };
    return fromResult(
      this.resolve.execute({ transaction, gatewayStatus: 'ERROR', statusMessage: error.code }),
    )
      .orElse(() => ok<Transaction, DomainError>(transaction))
      .andThen(() => err<DomainError, GatewayCharge>(withContext));
  }

  private settle(
    transaction: Transaction,
    charge: GatewayCharge,
  ): ResultAsync<Transaction, DomainError> {
    const resolveWith = (final: GatewayCharge): Promise<Result<Transaction, DomainError>> =>
      this.resolve.execute({
        transaction,
        gatewayStatus: final.status,
        statusMessage: final.statusMessage,
        gatewayTransactionId: charge.id,
      });

    if (mapGatewayStatus(charge.status) !== 'PENDING') {
      return fromResult(resolveWith(charge));
    }

    const now = this.clock.now();
    const pending = transaction.withGatewayTransactionId(charge.id, now);
    // Losing the gateway id is not fatal: the resolution write stores it again.
    return fromResult(this.transactions.attachGatewayId(pending.id, charge.id, now.toISOString()))
      .orElse(() => ok<void, DomainError>(undefined))
      .map(() => this.pollUntilFinal(charge.id))
      .andThen((final) => (final ? resolveWith(final) : ok<Transaction, DomainError>(pending)));
  }

  /**
   * Bounded wait for a final status. Stops at the first failed query (the transaction stays
   * `PENDING` and a later read reconciles it) and never exceeds `pollConfig.maxMs`.
   */
  private async pollUntilFinal(gatewayTransactionId: string): Promise<GatewayCharge | null> {
    const { maxMs, intervalMs } = this.pollConfig;
    const deadline = this.clock.now().getTime() + maxMs;

    while (this.clock.now().getTime() + intervalMs <= deadline) {
      await this.clock.sleep(intervalMs);
      const result = await this.gateway.getCharge(gatewayTransactionId);
      if (result.isErr()) {
        return null;
      }
      if (mapGatewayStatus(result.value.status) !== 'PENDING') {
        return result.value;
      }
    }
    return null;
  }
}
