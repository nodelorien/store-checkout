---
layer: L3
component: backend
read-when: touching repositories, table keys, atomic writes or seed data
---

# Data model (DynamoDB)

On-demand billing. Table names come from env (`TABLE_PRODUCTS`, …) so stages can coexist.
This model must be mirrored (diagram + table) in the README (NFR-09).

## Tables

| Table | PK | GSIs | Item attributes |
|---|---|---|---|
| `products` | `id` (S) | — | name, description, priceInCents (N), currency, imageUrl, stock (N), createdAt, updatedAt |
| `customers` | `id` (S) | `byEmail`: PK `email` | fullName, email (normalised), phone, createdAt, updatedAt |
| `transactions` | `id` (S) | `byReference`: PK `reference` · `byIdempotencyKey`: PK `idempotencyKey` (sparse) | reference, status, productId, productName, productImageUrl (snapshot), quantity, installments, customerId, subtotalInCents, baseFeeInCents, deliveryFeeInCents, totalInCents, currency, shippingAddress (M), cardBrand, cardLastFour, gatewayTransactionId?, statusMessage?, deliveryId?, idempotencyKey?, createdAt, updatedAt, resolvedAt? |
| `deliveries` | `id` (S) | `byTransaction`: PK `transactionId` | customerId, productId, quantity, address (M), status, createdAt, updatedAt |

```
customers 1 ──── n transactions n ──── 1 products
                      │ 1
                      │
                      0..1 deliveries
```

## Access patterns

| Pattern | Operation |
|---|---|
| List products | `Scan products` (≤ 20 seeded items; acceptable, documented) |
| Get product / customer / transaction / delivery by id | `GetItem` |
| Find customer by email (upsert) | `Query byEmail` |
| Find transaction by idempotency key | `GetItem` lock item `IDEMPOTENCY#<key>` (consistent) → `GetItem` transaction |
| Find transaction by reference (webhook) | `Query byReference` |
| Delivery of a transaction | `Query byTransaction` |

## Atomic writes (`TransactWriteItems`)

**A. Create transaction** — plain `Put transactions` (status `PENDING`) with condition
`attribute_not_exists(id)`. Stock is only *read* (use case returns `OUT_OF_STOCK` if `stock < quantity`).
With an `Idempotency-Key` the put goes in one `TransactWriteItems` together with a **lock item**
in the same table, `{ id: "IDEMPOTENCY#<key>", transactionId, createdAt }`, condition
`attribute_not_exists(id)`. A failed lock condition means the key is taken → the use case returns
the original transaction. GSIs are eventually consistent, so the lock (strongly consistent) is what
prevents a double charge; the sparse `byIdempotencyKey` GSI is kept for diagnostics only. Lock
items carry no `reference` / `idempotencyKey`, so they never appear in the GSIs.

**B. Resolve APPROVED** (ADR-0011)
1. `Update transactions` — set status, gatewayTransactionId, deliveryId, resolvedAt · condition `#status = :pending`
2. `Update products` — `SET stock = stock - :q, updatedAt = :now` · condition `stock >= :q`
3. `Put deliveries` (status `PENDING`) — condition `attribute_not_exists(id)`

**C. Resolve DECLINED / VOIDED / ERROR** — single `Update transactions` setting status,
statusMessage, resolvedAt · condition `#status = :pending`. Stock untouched.

Cancellation reasons in B: item 1 failed → "already resolved" → re-read and return `ok(current)`
(idempotent). Item 2 failed → sold out while paying → the use case resolves the transaction as
`ERROR` (`OUT_OF_STOCK_AFTER_PAYMENT`) through C. A failed condition in C → already resolved →
`ok(current)`. Anything else → `err(PERSISTENCE_ERROR)`.

## Repository ports (application layer)

```ts
ProductRepository      findAll() · findById(id)
CustomerRepository     findById(id) · findByEmail(email) · save(customer)
TransactionRepository  findById(id) · findByIdempotencyKey(key) · findByReference(ref) · create(tx, key?)
                       attachGatewayId(id, gatewayId) · resolveApproved(tx, delivery) [decrements stock] · resolveFailed(tx)
DeliveryRepository     findById(id) · findByTransactionId(id) · updateAddress(delivery)
```

All return `Promise<Result<…, DomainError>>`. Mappers (`toItem` / `toDomain`) live beside each adapter.
The write methods report their condition outcome as a value (`CREATED | DUPLICATE_KEY`,
`APPLIED | ALREADY_RESOLVED | OUT_OF_STOCK`), not as an error.

## Seed

`apps/api/src/seed/` — idempotent script (`PutItem` with fixed UUIDs) inserting 6 dummy products
with realistic names, descriptions, COP prices, varied stock (include one with stock 1 and one
with stock 0 to exercise edge cases) and `imageUrl` pointing to SVG files shipped with
the web app (`/images/catalog/<slug>.svg`). Run locally via `npm run seed -w apps/api`; in AWS
via a CDK custom resource or a one-off script after deploy. There is no create-product endpoint.

## Local development

`docker compose up dynamodb` (DynamoDB Local on `:8000`), `DYNAMODB_ENDPOINT=http://localhost:8000`.
A `tables:create` script creates the four tables with the same keys/GSIs as the CDK stack.
