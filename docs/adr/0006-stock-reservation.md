# ADR-0006: Reserve stock at PENDING, release on failure

- Status: Superseded by 0011
- Date: 2026-10-09
- Drivers: FR-07, FR-09, BR-04, BR-05, BR-06

## Context

The brief says: create the transaction PENDING, charge, then update stock. Taken literally
(decrement only after approval) two customers can pay for the last unit, and the second approved
charge has no stock — we would need refunds, which are out of scope.

## Decision

- Creating a transaction **atomically** (one `TransactWriteItems`) decrements product stock with
  the condition `stock >= quantity` and inserts the transaction as `PENDING`. If the condition
  fails the use case returns `OUT_OF_STOCK` and the gateway is never called.
- Resolving a transaction is a second atomic write conditioned on `status = PENDING`:
  - `APPROVED` → set status, create the delivery. Stock stays consumed.
  - `DECLINED` / `VOIDED` / `ERROR` → set status, add the quantity back to stock.
- A failed condition on resolve means "already resolved" → treated as success (idempotent), so
  create-time polling, client polling and webhooks can race safely.

Observable behaviour still matches the brief: after a successful payment the stock is lower;
after a failed one it is unchanged.

## Consequences

- Positive: no overselling, no refunds, idempotent resolution.
- Negative: stock is briefly held by in-flight payments. Every PENDING transaction is reconciled
  on read, so a hold lasts seconds; a stale-PENDING sweeper is a documented follow-up, not built.
- Negative: if the gateway call fails before a charge exists, the use case must resolve the
  transaction as `ERROR` to release stock (covered by tests).

## Alternatives rejected

- Decrement only on approval — oversell risk described above.
- Optimistic check without atomic write — race condition under concurrency.
