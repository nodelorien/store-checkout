---
layer: L3
component: backend
read-when: touching the gateway adapter, charge creation, status polling, webhooks or gateway env vars
---

# Payment gateway integration

Sandbox only. The provider is referred to as "payment gateway" everywhere (AGENTS.md rule 1).
Base URL and keys come from the assessment brief — put them in `.env`, never in the repo.
Wire-format facts below were checked against the provider's official documentation and OpenAPI
reference, and the charge flow against the real sandbox (2026-10-09). This file records the
integration design, not a copy of their reference.

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
| `PAYMENT_GATEWAY_BASE_URL` | API | sandbox URL ending in `/v1` (trailing slash tolerated) |
| `PAYMENT_GATEWAY_PUBLIC_KEY` | API → SPA via `/payment-config` | `pub_…` safe to expose |
| `PAYMENT_GATEWAY_PRIVATE_KEY` | API only | `prv_…` secret |
| `PAYMENT_GATEWAY_INTEGRITY_SECRET` | API only | signs charges |
| `PAYMENT_GATEWAY_EVENTS_SECRET` | API only | verifies webhooks; optional (without it every event is rejected) |
| `PAYMENT_GATEWAY_TIMEOUT_MS` | API | per HTTP call, default 8000 |
| `PAYMENT_POLL_MAX_MS` / `PAYMENT_POLL_INTERVAL_MS` | API | defaults 9000 / 1500 |

The three secrets may instead be given as SSM SecureString parameter **names** in
`PAYMENT_GATEWAY_PRIVATE_KEY_PARAM`, `PAYMENT_GATEWAY_INTEGRITY_SECRET_PARAM`,
`PAYMENT_GATEWAY_EVENTS_SECRET_PARAM`; they are read (decrypted) once at boot. A plain env value wins.

## Port

```ts
interface PaymentGatewayPort {
  getAcceptance(): Promise<Result<{ token: string; permalink: string }, DomainError>>;
  createCharge(input: ChargeInput): Promise<Result<GatewayCharge, DomainError>>;   // { id, status, statusMessage? }
  getCharge(gatewayTransactionId: string): Promise<Result<GatewayCharge, DomainError>>;
}
```

Adapter: `modules/transactions/infrastructure/gateway/http-payment-gateway.adapter.ts` (global
`fetch`, injected so tests replace it; `AbortSignal.timeout`). `FakePaymentGateway` in
`test/fakes` implements the port for use-case tests. Tests never call the real gateway.

## Calls

| Step | Gateway call | Auth | Who |
|---|---|---|---|
| Acceptance | `GET /merchants/{publicKey}` → `data.presigned_acceptance { acceptance_token, permalink, type }` | none | API (`GetPaymentConfig`, **never cached**) |
| Tokenize card | `POST /tokens/cards` `{number, cvc, exp_month, exp_year, card_holder}` → `data { id, brand, last_four, exp_month, exp_year, expires_at }` | Bearer public key | **Browser** (ADR-0007) |
| Charge | `POST /transactions` → `201` `data { id, status: "PENDING", status_message, reference, amount_in_cents }` | Bearer private key | API |
| Status | `GET /transactions/{id}` → `data { status, status_message }` | Bearer private key (public key / no auth → 404) | API |

- **Acceptance tokens are single-use.** A second charge with the same token fails with 422
  ("already used") and the merchant endpoint issues a new token on each call, so
  `/payment-config` asks the gateway on every request.
- The provider is replacing `GET /merchants/{publicKey}` with `GET /merchants/info` + header
  `x-merchant-public-key` (announced end of life of the old path: 2026-10-31). The adapter calls
  the path-based endpoint and falls back to the header-based one on 404.
- The merchant response also carries `presigned_personal_data_auth` (same shape). The docs ask
  for it as `accept_personal_auth` in the charge, but the sandbox accepts charges without it, so
  it is not sent (it would need a contract change: the browser must show and accept it).

Charge body (snake_case on the wire, built in the adapter):
`amount_in_cents`, `currency`, `customer_email`, `reference`, `signature`, `acceptance_token`,
`payment_method: { type: "CARD", token, installments }`. Optional `customer_data`
(`full_name`, `phone_number`, …) and `shipping_address` (`address_line_1`, `city`, `region`,
`country`, `phone_number`, …) exist in the reference but are deliberately not sent: the address
and contact live in our own delivery record, and less personal data leaves the system.

**Integrity signature:** `sha256_hex(reference + amountInCents + currency + integritySecret)`
(an optional expiration time would go before the secret; unused). Pure function
`buildIntegritySignature`, unit-tested with the vector published by the provider.

## Error bodies

| HTTP | Body | Meaning |
|---|---|---|
| 401 | `{ error: { type: "INVALID_ACCESS_TOKEN", reason } }` | wrong key / wrong environment |
| 404 | `{ error: { type: "NOT_FOUND_ERROR", reason } }` | unknown id (or a non-private key on status) |
| 422 | `{ error: { type: "INPUT_VALIDATION_ERROR", messages: { field: [..] } } }` | invalid input; `messages` may nest objects |

The provider's message text is never forwarded to API clients. It is logged as error type +
field names + redacted, truncated text.

## Status mapping

| Gateway | Ours |
|---|---|
| `PENDING` | `PENDING` (keep polling) |
| `APPROVED` | `APPROVED` |
| `DECLINED` | `DECLINED` (the gateway's `status_message` is kept as `statusMessage`) |
| `VOIDED` | `VOIDED` |
| `ERROR` | `ERROR` |
| anything else | `PENDING` + warning log |

A charge is always created `PENDING`; the sandbox settles it in about 1.5 s.

## Resolution strategy

1. `CreateTransaction` creates the charge, stores `gatewayTransactionId`, then polls `getCharge`
   every `PAYMENT_POLL_INTERVAL_MS` up to `PAYMENT_POLL_MAX_MS` (must stay well under the 30 s
   API Gateway limit: worst case ≈ charge timeout + poll window + one status timeout). Final
   status → `ResolveTransaction`.
2. Still `PENDING` → return 201 with `PENDING`. The SPA polls `GET /transactions/:id`, which calls
   `getCharge` once and resolves if final.
3. Webhook (`POST /webhooks/payment-gateway`, spec 008): verify the event checksum with the
   events secret, then `ResolveTransaction`. Idempotent with 1 and 2.

## Events (webhook)

`{ event: "transaction.updated", data: { transaction: { id, status, amount_in_cents, reference, … } },
signature: { properties: [...], checksum }, timestamp, sent_at, environment }`.
Checksum = `sha256_hex(values of signature.properties read from data, in order + timestamp + eventsSecret)`,
compared case-insensitively with `signature.checksum` (also sent as header `X-Event-Checksum`).
The property list is dynamic — never hard-code it. Any answer other than `200` makes the gateway
retry (up to 3 times within 24 h).

## Failure handling

| Situation | Result |
|---|---|
| `createCharge` 4xx (invalid/expired/used token, bad signature) | resolve transaction `ERROR` → `err(PAYMENT_GATEWAY_REJECTED)` |
| `createCharge` timeout / 5xx / 408 / 429 / network | resolve `ERROR` → `err(PAYMENT_GATEWAY_UNAVAILABLE)`. No automatic retry of charge creation (double-charge risk) |
| `getCharge` fails while polling | stop polling, leave `PENDING`, return it; next read retries |
| `getAcceptance` fails (any reason) | `err(PAYMENT_GATEWAY_UNAVAILABLE)` |
| Unknown response shape | treated as `PAYMENT_GATEWAY_UNAVAILABLE`, warning logged without the body |

## Sandbox test data

Documented sandbox cards: `4242 4242 4242 4242` → `APPROVED`, `4111 1111 1111 1111` → `DECLINED`,
any other number → `ERROR`; any future expiry and any 3-digit CVC. Never use real card numbers.
