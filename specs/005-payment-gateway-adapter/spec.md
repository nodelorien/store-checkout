# Spec 005 — Payment gateway adapter and payment configuration

- Status: Done
- Component(s): backend
- Branch: `feat/005-payment-gateway-adapter`
- Traces to: FR-08
- Context to load: `docs/components/backend/CONTEXT.md`, `payment-gateway.md`, `api.md`

## 1. Why

The checkout needs the gateway's public data to tokenize a card in the browser, and the API needs
a single, well-isolated place that talks to the gateway to charge and to read a charge status.

## 2. Scope

**In:** `PaymentGatewayPort` (acceptance, create charge, get charge); HTTP adapter with timeout
and error mapping; integrity signature; `GET /payment-config`.

**Out:** the transaction flow that uses the port (spec 006); webhook events (spec 008).

## 3. Behaviour

`GET /payment-config` returns what the browser needs: public key, tokenization URL, a **fresh**
acceptance token with the link to the terms, currency and the server-side fees. Acceptance tokens
are single-use at the gateway, so they are never cached.

## 4. Acceptance criteria

- **AC-1** — `GET /payment-config` answers `200` with `{ publicKey, tokenizationUrl, acceptance: { token, permalink }, currency, baseFeeInCents, deliveryFeeInCents }`, `Cache-Control: no-store`, and asks the gateway for a new acceptance token on every request.
- **AC-2** — Given the gateway cannot provide the acceptance token (timeout, network, 4xx, 5xx, unexpected body), `GET /payment-config` answers `502` `PAYMENT_GATEWAY_UNAVAILABLE`.
- **AC-3** — The integrity signature is the SHA-256 hex digest of `reference + amountInCents + currency + integritySecret` (checked against the vector published by the provider).
- **AC-4** — Creating a charge sends `POST {base}/transactions` with the private key as bearer and a snake_case body containing amount, currency, customer e-mail, reference, signature, acceptance token and the card payment method (token, installments); the answer is mapped to `{ id, status, statusMessage }`.
- **AC-5** — Given the gateway answers a charge request with 4xx, the result is `PAYMENT_GATEWAY_REJECTED` with a generic message (the provider's text is not forwarded to clients).
- **AC-6** — Given a timeout, a network failure, a 5xx, 408 or 429, or a body without `data.id` / `data.status`, the result is `PAYMENT_GATEWAY_UNAVAILABLE`.
- **AC-7** — Reading a charge sends `GET {base}/transactions/{id}` with the private key as bearer and maps `status` / `status_message`; any failure (including 404) is `PAYMENT_GATEWAY_UNAVAILABLE`.
- **AC-8** — The acceptance token is read from `GET {base}/merchants/{publicKey}`; if that path answers 404 the adapter falls back to `GET {base}/merchants/info` with the `x-merchant-public-key` header (the provider is migrating to it).
- **AC-9** — Nothing logged by the adapter contains tokens, keys, signatures, e-mails or phone numbers.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Gateway status outside the known set | passed through; a warning is logged; the domain keeps the transaction `PENDING` |
| Non-JSON error body | handled as an empty body |
| Base URL configured with a trailing slash | normalised at configuration load |

## 6. Contract changes

`GET /payment-config` shape unchanged. Behaviour change versus the first design: no caching of
the acceptance token. `payment-gateway.md` corrected against the provider's documentation.

## 7. Security and privacy notes

Private key and integrity secret never leave the adapter. The public key is not secret. Gateway
error bodies are logged only as error type + field names + redacted messages.

## 8. Plan and tasks (merged)

- [x] T01 Port + `FakePaymentGateway`
- [x] T02 `buildIntegritySignature` + fixed-vector test
- [x] T03 `HttpPaymentGatewayAdapter` + tests with a mocked `fetch`
- [x] T04 `GetPaymentConfig` use case, controller, modules + tests
- [x] T05 Correct `payment-gateway.md`
- [x] T90 lint, typecheck, test:cov green
