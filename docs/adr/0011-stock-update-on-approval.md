# ADR-0011: Update stock only when the payment is approved

- Status: Accepted
- Date: 2026-10-09
- Supersedes: 0006
- Drivers: FR-07, FR-09, BR-04, BR-05, BR-06 — the brief has priority over our own design

## Context

The brief orders the flow explicitly: create the transaction in PENDING, call the gateway, and
**once the payment is completed or failed** update the transaction, assign the product and update
the stock. ADR-0006 decremented stock earlier (reservation at PENDING). The project owner decided
the brief must be followed literally.

## Decision

- **Create:** the use case checks `stock >= quantity` (early `OUT_OF_STOCK`, gateway not called)
  and stores the transaction as `PENDING`. Stock is **not** modified.
- **Resolve APPROVED** — one `TransactWriteItems`:
  1. transaction → `APPROVED` (condition `status = PENDING`)
  2. product `stock = stock - quantity` (condition `stock >= quantity`)
  3. create the delivery (product assigned to the customer)
- **Resolve DECLINED / VOIDED / ERROR:** transaction → final status (condition `status = PENDING`). Stock untouched.
- Condition 1 failing means "already resolved" → idempotent success. Condition 2 failing means the
  last units were sold while this payment was in flight → the transaction is resolved as `ERROR`
  with message `OUT_OF_STOCK_AFTER_PAYMENT`, no delivery is created.

## Consequences

- Positive: matches the brief step by step; stock never goes negative (BR-04 holds via the condition).
- Positive: no stock is held by abandoned or slow payments.
- Negative: two simultaneous buyers of the last unit can both be charged; the second ends in
  `ERROR` and would need a void/refund, which is out of scope (documented limitation, sandbox only).

## Alternatives rejected

- Reservation at PENDING (ADR-0006) — safer against overselling but changes the order the brief specifies.
