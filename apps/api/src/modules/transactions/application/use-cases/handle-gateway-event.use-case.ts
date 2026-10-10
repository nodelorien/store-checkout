import { Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrors } from '../../../../shared/errors/domain-error';
import {
  err,
  fromResult,
  ok,
  okAsync,
  Result,
  ResultAsync,
} from '../../../../shared/result/result';
import {
  GATEWAY_EVENT_VERIFIER,
  GatewayEvent,
  GatewayEventVerifier,
} from '../ports/gateway-event-verifier.port';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepository,
} from '../ports/transaction-repository.port';
import { ResolveTransactionUseCase } from './resolve-transaction.use-case';

export const TRANSACTION_UPDATED_EVENT = 'transaction.updated';
const REQUIRED_SIGNED_PROPERTIES = ['transaction.id', 'transaction.status'];

export interface HandleGatewayEventOutput {
  readonly received: true;
  /** `false` when the event was authentic but there was nothing to apply. */
  readonly handled: boolean;
}

interface TransactionUpdate {
  readonly gatewayTransactionId: string;
  readonly status: string;
  readonly reference: string;
  readonly amountInCents: number;
  readonly statusMessage?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Shape validation of the raw body. Extra fields sent by the gateway are simply ignored. */
export function parseGatewayEvent(body: unknown): Result<GatewayEvent, DomainError> {
  const invalid = (field: string): Result<GatewayEvent, DomainError> =>
    err(DomainErrors.invalidField(field, `${field} is missing or not valid`));

  if (!isRecord(body) || typeof body.event !== 'string' || body.event === '') {
    return invalid('event');
  }
  if (!isRecord(body.data)) {
    return invalid('data');
  }
  if (typeof body.timestamp !== 'number' || !Number.isFinite(body.timestamp)) {
    return invalid('timestamp');
  }
  const signature = body.signature;
  if (
    !isRecord(signature) ||
    !Array.isArray(signature.properties) ||
    signature.properties.length === 0 ||
    signature.properties.some((property) => typeof property !== 'string')
  ) {
    return invalid('signature.properties');
  }
  if (typeof signature.checksum !== 'string' || signature.checksum === '') {
    return invalid('signature.checksum');
  }
  return ok({
    event: body.event,
    data: body.data,
    timestamp: body.timestamp,
    signature: { properties: signature.properties as string[], checksum: signature.checksum },
  });
}

function toTransactionUpdate(event: GatewayEvent): TransactionUpdate | null {
  const signed = event.signature.properties;
  const transaction = event.data.transaction;
  if (
    event.event !== TRANSACTION_UPDATED_EVENT ||
    !REQUIRED_SIGNED_PROPERTIES.every((property) => signed.includes(property)) ||
    !isRecord(transaction) ||
    typeof transaction.id !== 'string' ||
    typeof transaction.status !== 'string' ||
    typeof transaction.reference !== 'string' ||
    typeof transaction.amount_in_cents !== 'number'
  ) {
    return null;
  }
  return {
    gatewayTransactionId: transaction.id,
    status: transaction.status,
    reference: transaction.reference,
    amountInCents: transaction.amount_in_cents,
    statusMessage:
      typeof transaction.status_message === 'string' ? transaction.status_message : undefined,
  };
}

@Injectable()
export class HandleGatewayEventUseCase {
  constructor(
    @Inject(GATEWAY_EVENT_VERIFIER) private readonly verifier: GatewayEventVerifier,
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(ResolveTransactionUseCase) private readonly resolve: ResolveTransactionUseCase,
  ) {}

  /**
   * Railway:
   *  1. parse the body                                   → VALIDATION_ERROR
   *  2. verify the checksum                              → INVALID_SIGNATURE
   *  3. not an applicable transaction update             → ok(handled: false)
   *  4. find our transaction by reference; unknown, amount mismatch or a gateway id other
   *     than the one we stored                           → ok(handled: false)
   *  5. resolve (idempotent)                             → PERSISTENCE_ERROR
   */
  execute(body: unknown): Promise<Result<HandleGatewayEventOutput, DomainError>> {
    return fromResult(parseGatewayEvent(body))
      .andThen((event) =>
        this.verifier.verify(event)
          ? ok<GatewayEvent, DomainError>(event)
          : err<DomainError, GatewayEvent>(DomainErrors.invalidSignature()),
      )
      .andThen((event) => this.apply(toTransactionUpdate(event)))
      .map((handled) => ({ received: true as const, handled }))
      .toPromise();
  }

  private apply(update: TransactionUpdate | null): ResultAsync<boolean, DomainError> {
    if (update === null) {
      return okAsync(false);
    }
    return fromResult(this.transactions.findByReference(update.reference)).andThen(
      (transaction) => {
        const applicable =
          transaction !== null &&
          transaction.toProps().amounts.totalInCents === update.amountInCents &&
          transaction.gatewayTransactionId === update.gatewayTransactionId;
        if (!applicable) {
          return ok<boolean, DomainError>(false);
        }
        return fromResult(
          this.resolve.execute({
            transaction,
            gatewayStatus: update.status,
            statusMessage: update.statusMessage,
          }),
        ).map(() => true);
      },
    );
  }
}
