import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../../../shared/config/app-config';
import { DomainError, DomainErrors } from '../../../../shared/errors/domain-error';
import { redactText } from '../../../../shared/http/redact';
import { err, ok, Result } from '../../../../shared/result/result';
import {
  ChargeInput,
  GatewayAcceptance,
  GatewayCharge,
  PaymentGatewayPort,
} from '../../application/ports/payment-gateway.port';
import { buildIntegritySignature } from './integrity-signature';

export const HTTP_FETCH = Symbol('HTTP_FETCH');
export type FetchFn = typeof fetch;

const KNOWN_STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'];

type HttpOutcome =
  | { kind: 'success'; body: unknown }
  | { kind: 'client-error'; status: number; body: unknown }
  | { kind: 'unavailable'; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flattenMessages(value: unknown, path: string, into: Record<string, string>): void {
  if (isRecord(value)) {
    for (const [key, inner] of Object.entries(value)) {
      flattenMessages(inner, path ? `${path}.${key}` : key, into);
    }
  } else {
    const texts = Array.isArray(value) ? value : [value];
    into[path] = redactText(texts.map(String).join('; ')).slice(0, 200);
  }
}

/**
 * Safe summary of a gateway error body for logs: error type, reason and per-field messages
 * (field names are not sensitive; message text is redacted and truncated).
 */
export function describeGatewayError(body: unknown): Record<string, unknown> {
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const fields: Record<string, string> = {};
  if (error.messages !== undefined) {
    flattenMessages(error.messages, '', fields);
  }
  return {
    type: typeof error.type === 'string' ? error.type : 'UNKNOWN',
    reason: typeof error.reason === 'string' ? redactText(error.reason).slice(0, 200) : undefined,
    fields,
  };
}

/**
 * Outbound adapter for the payment gateway REST API. The only place that knows its wire format.
 * Host and keys come from configuration; nothing here is provider-specific by name.
 */
@Injectable()
export class HttpPaymentGatewayAdapter implements PaymentGatewayPort {
  private readonly logger = new Logger('PaymentGateway');
  private readonly settings: AppConfig['gateway'];

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(HTTP_FETCH) private readonly fetchFn: FetchFn,
  ) {
    this.settings = config.gateway;
  }

  async getAcceptance(): Promise<Result<GatewayAcceptance, DomainError>> {
    const publicKey = this.settings.publicKey;
    let outcome = await this.send('GET', `/merchants/${encodeURIComponent(publicKey)}`);
    if (outcome.kind === 'client-error' && outcome.status === 404) {
      // The provider is replacing the path-based endpoint with a header-based one.
      outcome = await this.send('GET', '/merchants/info', {
        headers: { 'x-merchant-public-key': publicKey },
      });
    }
    if (outcome.kind !== 'success') {
      return err(this.unavailable('acceptance', outcome));
    }

    const data = isRecord(outcome.body) ? outcome.body.data : undefined;
    const presigned = isRecord(data) ? data.presigned_acceptance : undefined;
    if (
      !isRecord(presigned) ||
      typeof presigned.acceptance_token !== 'string' ||
      typeof presigned.permalink !== 'string'
    ) {
      this.logger.warn('acceptance: unexpected response shape');
      return err(DomainErrors.gatewayUnavailable());
    }
    return ok({ token: presigned.acceptance_token, permalink: presigned.permalink });
  }

  async createCharge(input: ChargeInput): Promise<Result<GatewayCharge, DomainError>> {
    const outcome = await this.send('POST', '/transactions', {
      bearer: this.settings.privateKey,
      body: {
        amount_in_cents: input.amountInCents,
        currency: input.currency,
        customer_email: input.customerEmail,
        reference: input.reference,
        signature: buildIntegritySignature({
          reference: input.reference,
          amountInCents: input.amountInCents,
          currency: input.currency,
          integritySecret: this.settings.integritySecret,
        }),
        acceptance_token: input.acceptanceToken,
        payment_method: {
          type: 'CARD',
          token: input.cardToken,
          installments: input.installments,
        },
      },
    });

    if (outcome.kind === 'client-error') {
      this.logger.warn(
        JSON.stringify({
          operation: 'createCharge',
          status: outcome.status,
          error: describeGatewayError(outcome.body),
        }),
      );
      return err(DomainErrors.gatewayRejected());
    }
    if (outcome.kind === 'unavailable') {
      return err(this.unavailable('createCharge', outcome));
    }
    return this.parseCharge('createCharge', outcome.body);
  }

  async getCharge(gatewayTransactionId: string): Promise<Result<GatewayCharge, DomainError>> {
    const outcome = await this.send(
      'GET',
      `/transactions/${encodeURIComponent(gatewayTransactionId)}`,
      { bearer: this.settings.privateKey },
    );
    if (outcome.kind !== 'success') {
      return err(this.unavailable('getCharge', outcome));
    }
    return this.parseCharge('getCharge', outcome.body);
  }

  private parseCharge(operation: string, body: unknown): Result<GatewayCharge, DomainError> {
    const data = isRecord(body) ? body.data : undefined;
    if (!isRecord(data) || typeof data.id !== 'string' || typeof data.status !== 'string') {
      this.logger.warn(`${operation}: unexpected response shape`);
      return err(DomainErrors.gatewayUnavailable());
    }
    if (!KNOWN_STATUSES.includes(data.status)) {
      this.logger.warn(`${operation}: unknown gateway status, treated as pending`);
    }
    return ok({
      id: data.id,
      status: data.status,
      statusMessage: typeof data.status_message === 'string' ? data.status_message : undefined,
    });
  }

  private unavailable(
    operation: string,
    outcome: Exclude<HttpOutcome, { kind: 'success' }>,
  ): DomainError {
    this.logger.warn(
      JSON.stringify(
        outcome.kind === 'client-error'
          ? { operation, status: outcome.status, error: describeGatewayError(outcome.body) }
          : { operation, reason: outcome.reason },
      ),
    );
    return DomainErrors.gatewayUnavailable();
  }

  /** Never throws: every transport problem becomes an outcome. */
  private async send(
    method: 'GET' | 'POST',
    path: string,
    options: { bearer?: string; headers?: Record<string, string>; body?: unknown } = {},
  ): Promise<HttpOutcome> {
    try {
      const response = await this.fetchFn(`${this.settings.baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(options.bearer ? { Authorization: `Bearer ${options.bearer}` } : {}),
          ...options.headers,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(this.settings.timeoutMs),
      });
      const body: unknown = await response.json().catch(() => undefined);

      if (response.status >= 200 && response.status < 300) {
        return { kind: 'success', body };
      }
      const retryable = response.status === 408 || response.status === 429;
      if (response.status >= 400 && response.status < 500 && !retryable) {
        return { kind: 'client-error', status: response.status, body };
      }
      return { kind: 'unavailable', reason: `http ${response.status}` };
    } catch (cause) {
      return { kind: 'unavailable', reason: cause instanceof Error ? cause.name : 'unknown' };
    }
  }
}
