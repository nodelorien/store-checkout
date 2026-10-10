# Spec 006 — Transactions API

- Status: Done
- Component(s): backend
- Branch: `feat/006-transactions-api`
- Traces to: FR-07, FR-08, FR-09, BR-01, BR-02, BR-03, BR-04, BR-05, BR-06
- Context to load: `docs/components/backend/CONTEXT.md`, `domain.md`, `api.md`, `data-model.md`, `payment-gateway.md`, `testing.md`, ADR-0011

## 1. Why

This is the purchase itself: record the intent as `PENDING`, charge the card through the
gateway, and — only when the payment is approved — assign the product and decrease the stock.

## 2. Scope

**In:** transaction domain (amounts, reference, state machine); `POST /transactions` (create
`PENDING`, charge, bounded poll, resolve); `GET /transactions/:id` (reconciles while `PENDING`);
atomic resolution writes; idempotency key; creation of the delivery record on approval.

**Out:** reading or amending deliveries over HTTP (spec 007); webhook (spec 008); refunds/voids.

## 3. Behaviour

The client sends product, quantity, card token and buyer/delivery data — never prices. The API
computes the total from the stored price and server fees, stores the transaction as `PENDING`,
charges the gateway and waits a bounded time for a final status. Approved → stock decreases and a
delivery is created in the same atomic write. Any other final status leaves stock untouched. A
payment still pending after the wait is returned as `PENDING` and settles on a later read.

## 4. Acceptance criteria

- **AC-1** — Approved payment: `201`, status `APPROVED`, `deliveryId` set, `resolvedAt` set, stock decreased by the quantity, one delivery created.
- **AC-2** — Declined payment: `201`, status `DECLINED` with the gateway's message, no delivery, stock unchanged.
- **AC-3** — Stock lower than the quantity: `409` `OUT_OF_STOCK`; nothing is stored and the gateway is never called.
- **AC-4** — Unknown product: `404` `PRODUCT_NOT_FOUND`; the gateway is never called.
- **AC-5** — Gateway rejects the charge request (4xx): the transaction ends `ERROR`, stock unchanged, answer `422` `PAYMENT_GATEWAY_REJECTED`.
- **AC-6** — Gateway unavailable on the charge request: the transaction ends `ERROR`, stock unchanged, answer `502` `PAYMENT_GATEWAY_UNAVAILABLE`; the charge is not retried.
- **AC-7** — Still pending after the poll window: `201` with status `PENDING`, stock unchanged, gateway id stored; polling stops at the configured maximum.
- **AC-8** — Same `Idempotency-Key` twice: one charge, the second answer is `200` with the same transaction (also when both requests race).
- **AC-9** — Amounts: `subtotal = stored price × quantity`, `total = subtotal + base fee + delivery fee`, all integer cents, whatever the client sends (price-like properties are rejected with `400`).
- **AC-10** — Approved but the last units were sold meanwhile: the transaction ends `ERROR` with message `OUT_OF_STOCK_AFTER_PAYMENT`, no delivery, stock unchanged.
- **AC-11** — `GET /transactions/:id`: `200` with the transaction; `404` `TRANSACTION_NOT_FOUND`; while `PENDING` with a gateway id it asks the gateway once and resolves when final; a gateway failure returns the transaction still `PENDING`.
- **AC-12** — Resolving is idempotent: a final transaction is never changed again, and losing a race for the same resolution returns the stored state.
- **AC-13** — Invalid requests answer `400` `VALIDATION_ERROR` with field details (DTO rules of `api.md`); card data properties (`number`, `cvc`, `expMonth`, …) are rejected.
- **AC-14** — A gateway status outside the known set leaves the transaction `PENDING`.
- **AC-15** — Transaction responses carry `Cache-Control: no-store`; `POST /transactions` is limited to 10 requests per minute per client.
- **AC-16** — The reference has the form `TX-<yyyymmdd>-<8 base32 chars>`.
- **AC-17** — Store failures surface as `500` `PERSISTENCE_ERROR`; a failure to persist the gateway id does not abort the payment flow.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| `getCharge` fails while polling | stop polling, return `PENDING` |
| Charge answer is already final | resolve immediately, no polling |
| Resolution of the `ERROR` state fails after a charge failure | the gateway error is still returned |
| Malformed `Idempotency-Key` | `400` `VALIDATION_ERROR` |
| Replayed key whose transaction is still `PENDING` | reconciled like a read, then returned |

## 6. Contract changes

None to shapes. Additions: `PAYMENT_GATEWAY_*` errors raised after the transaction was stored
carry `details` entries `transactionId` and `reference` so the client can show or poll it.
Persistence: `productName`, `productImageUrl`, `installments` stored on the transaction;
idempotency enforced by a lock item (see `data-model.md`).

## 7. Security and privacy notes

Only the card token, brand and last four digits are accepted; the token is passed to the gateway
and never stored or logged. Totals never come from the client.

## 8. Plan and tasks (merged)

- [x] T01 Domain: `Address`, `Amounts`, `CardInfo`, `TransactionReference`, `Transaction`, `Delivery` + tests
- [x] T02 Ports + in-memory fakes; `ResolveTransaction` + tests for every branch
- [x] T03 `CreateTransaction` (railway + bounded poll + idempotency) + the ten mandatory scenarios
- [x] T04 `GetTransaction` with reconciliation + tests
- [x] T05 `DynamoDbTransactionRepository` (writes A, B, C; cancellation reasons) + tests
- [x] T06 DTOs, controller, module wiring + supertest tests
- [x] T07 Docs: `api.md`, `data-model.md`, `domain.md`
- [x] T90 lint, typecheck, test:cov green
