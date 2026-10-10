---
layer: L3
component: backend
read-when: touching the gateway adapter, charge creation, status polling, webhooks or gateway env vars
---

# Payment gateway integration

Sandbox only. The provider is referred to as "payment gateway" everywhere (AGENTS.md rule 1).
Base URL and keys come from the assessment brief — put them in `.env`, never in the repo.
**Verify field names against the provider's official docs when implementing**; this file records
the integration design, not a copy of their reference.

## Brief-specific pitfalls

- The brief gives **two** base URLs. Use the **sandbox** one (`UAT_SANDBOX_URL`), not the plain UAT one.
- The provider's public docs show their public sandbox/production hosts. **Do not use those**: the
  keys in the brief are staging-test keys and only work against the hosts given in the brief.
- The brief also gives a shared dashboard login. Do not use it from automation, do not change its
  credentials or add MFA; integrate with API keys only.
- Gateway hostnames contain the provider's name → they exist only in `.env` / CI variables / SSM,
  including the CSP `connect-src` value (injected at deploy time).
- The public key is not secret but still comes from env, never from source.

## Environment

| Variable | Used by | Notes |
|---|---|---|
| `PAYMENT_GATEWAY_BASE_URL` | API | sandbox URL ending in `/v1` |
| `PAYMENT_GATEWAY_PUBLIC_KEY` | API → SPA via `/payment-config` | `pub_…` safe to expose |
| `PAYMENT_GATEWAY_PRIVATE_KEY` | API only | `prv_…` secret |
| `PAYMENT_GATEWAY_INTEGRITY_SECRET` | API only | signs charges |
| `PAYMENT_GATEWAY_EVENTS_SECRET` | API only | verifies webhooks |
| `PAYMENT_GATEWAY_TIMEOUT_MS` | API | default 8000 |
| `PAYMENT_POLL_MAX_MS` / `PAYMENT_POLL_INTERVAL_MS` | API | defaults 9000 / 1500 |

## Port

```ts
interface PaymentGatewayPort {
  getAcceptance(): Promise<Result<{ token: string; permalink: string }, DomainError>>;
  createCharge(input: ChargeInput): Promise<Result<GatewayCharge, DomainError>>;   // { id, status, statusMessage? }
  getCharge(gatewayTransactionId: string): Promise<Result<GatewayCharge, DomainError>>;
}
```

Adapter: `modules/transactions/infrastructure/gateway/http-payment-gateway.adapter.ts`
(Nest `HttpModule`/fetch). A `FakePaymentGateway` in `test/fakes` implements the port for use-case tests.

## Calls

| Step | Gateway call | Auth | Who |
|---|---|---|---|
| Acceptance | `GET /merchants/{publicKey}` → presigned acceptance token + permalink | none | API (`GetPaymentConfig`, cached ~5 min) |
| Tokenize card | `POST /tokens/cards` `{number, cvc, exp_month, exp_year, card_holder}` → token id, brand, last four, expiry | Bearer public key | **Browser** (ADR-0007) |
| Charge | `POST /transactions` | Bearer private key | API |
| Status | `GET /transactions/{id}` | Bearer private key | API |

Charge body (snake_case on the wire, mapped in the adapter):
`amount_in_cents`, `currency`, `customer_email`, `reference`, `signature`, `acceptance_token`,
`payment_method: { type: "CARD", token, installments }`, optional `customer_data`, `shipping_address`.

**Integrity signature:** `sha256_hex(reference + amountInCents + currency + integritySecret)`,
computed in a pure function `buildIntegritySignature` (unit-tested with a fixed vector).

## Status mapping

| Gateway | Ours |
|---|---|
| `PENDING` | `PENDING` (keep polling) |
| `APPROVED` | `APPROVED` |
| `DECLINED` | `DECLINED` |
| `VOIDED` | `VOIDED` |
| `ERROR` | `ERROR` |
| anything else | `PENDING` + warning log |

## Resolution strategy

1. `CreateTransaction` creates the charge, stores `gatewayTransactionId`, then polls `getCharge`
   every `PAYMENT_POLL_INTERVAL_MS` up to `PAYMENT_POLL_MAX_MS` (must stay well under the 30 s
   API Gateway limit). Final status → `ResolveTransaction`.
2. Still `PENDING` → return 201 with `PENDING`. The SPA polls `GET /transactions/:id`, which calls
   `getCharge` once and resolves if final.
3. Optional webhook (`POST /webhooks/payment-gateway`): verify the event checksum with the events
   secret, then `ResolveTransaction`. Idempotent with 1 and 2.

## Failure handling

| Situation | Result |
|---|---|
| `createCharge` 4xx (invalid/expired token, bad signature) | resolve transaction `ERROR` → `err(PAYMENT_GATEWAY_REJECTED)` |
| `createCharge` timeout / 5xx / network | resolve `ERROR` → `err(PAYMENT_GATEWAY_UNAVAILABLE)`. No automatic retry of charge creation (double-charge risk) |
| `getCharge` fails while polling | stop polling, leave `PENDING`, return it; next read retries |
| Unknown response shape | treated as `PAYMENT_GATEWAY_UNAVAILABLE`, body logged redacted |

## Sandbox test data

Use the provider's documented sandbox cards (one always approved, one always declined) for manual
testing and the README walkthrough. Never use real card numbers.
