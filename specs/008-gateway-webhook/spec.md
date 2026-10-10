# Spec 008 — Gateway webhook

- Status: Done
- Component(s): backend
- Branch: `feat/008-gateway-webhook`
- Traces to: FR-09
- Context to load: `docs/components/backend/CONTEXT.md`, `payment-gateway.md` (Events), `api.md`

## 1. Why

A payment that is still pending when the buyer closes the page must still end in its final state.
The gateway announces status changes; accepting those announcements settles such payments
without anyone polling.

## 2. Scope

**In:** `POST /webhooks/payment-gateway`; checksum verification with the events secret;
resolution of the matching transaction through the same idempotent path as create and get.

**Out:** registering the webhook URL in the gateway dashboard (manual, rule 10); events other
than transaction updates.

## 3. Behaviour

The endpoint accepts the gateway's event, checks its checksum and, for a transaction update that
matches one of our pending transactions, applies the announced status. Anything authentic that
cannot be applied is acknowledged with `200` and ignored, so the gateway does not retry in vain.

## 4. Acceptance criteria

- **AC-1** — Given an authentic `transaction.updated` event with status `APPROVED` for a pending transaction, the answer is `200` `{ data: { received: true, handled: true } }`, the transaction is approved, stock is decremented and the delivery created.
- **AC-2** — Given an authentic event with `DECLINED`, `VOIDED` or `ERROR`, the transaction takes that status and stock is untouched.
- **AC-3** — Given a wrong checksum, a tampered signed value, or no events secret configured, the answer is `401` `INVALID_SIGNATURE` and nothing changes.
- **AC-4** — The checksum is the SHA-256 hex digest of the values of `signature.properties` (read from `data`, in the given order) + `timestamp` + events secret, compared case-insensitively in constant time (checked against a fixed vector).
- **AC-5** — Given a body that is not an event (missing `event`, `data`, `signature.properties`, `signature.checksum` or `timestamp`), the answer is `400` `VALIDATION_ERROR`.
- **AC-6** — Given an authentic event that cannot be applied — another event type, unknown reference, amount different from the stored total, gateway id different from the stored one or not stored, transaction data missing, or `id` / `status` not covered by the signature — the answer is `200` with `handled: false` and nothing changes.
- **AC-7** — Delivering the same event twice, or after the transaction was already resolved, answers `200` and changes nothing (idempotent).
- **AC-8** — Given the store fails, the answer is `500` so the gateway retries later.
- **AC-9** — The gateway's extra fields are accepted (no whitelist on this body) and nothing from the event is logged.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Status `PENDING` or unknown in the event | acknowledged, transaction stays `PENDING` |
| Signed property path that does not exist or is an object | treated as an invalid signature |
| Checksum sent in lower case | accepted |

## 6. Contract changes

`POST /webhooks/payment-gateway` response and the `INVALID_SIGNATURE` (401) code added to `api.md`.

## 7. Security and privacy notes

Unauthenticated endpoint protected by the checksum, the global rate limit and the 10 kb body
limit. The event carries the buyer's e-mail: it is never logged or stored. An event can only
resolve the transaction whose stored gateway id equals the signed `transaction.id`, so a captured
event cannot be redirected to another reference.

## 8. Plan and tasks (merged)

- [x] T01 Event parsing + `GatewayEventVerifier` port and checksum adapter + fixed-vector tests
- [x] T02 `HandleGatewayEvent` use case + tests for every branch
- [x] T03 Controller, wiring + supertest tests
- [x] T04 Docs: `api.md`, `domain.md`
- [x] T90 lint, typecheck, test:cov green
