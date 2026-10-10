---
layer: L3
component: backend
read-when: changing entities, statuses, business rules or domain error codes
---

# Domain model

## Aggregates

| Aggregate | Fields | Notes |
|---|---|---|
| **Product** | `id`, `name`, `description`, `priceInCents`, `currency`, `imageUrl`, `stock`, `createdAt`, `updatedAt` | Seeded. `stock` is an integer ≥ 0. |
| **Customer** | `id`, `fullName`, `email`, `phone`, `createdAt`, `updatedAt` | Unique by normalised (lower-cased, trimmed) email → upsert. |
| **Transaction** | `id`, `reference`, `status`, `productId`, `quantity`, `customerId`, `amounts`, `currency`, `shippingAddress`, `cardBrand`, `cardLastFour`, `gatewayTransactionId?`, `statusMessage?`, `deliveryId?`, `createdAt`, `updatedAt`, `resolvedAt?` | `reference` is the human "transaction number". |
| **Delivery** | `id`, `transactionId`, `customerId`, `productId`, `quantity`, `address`, `status`, `createdAt`, `updatedAt` | Created only when a transaction is approved. |

## Value objects

- `Money` — integer cents + currency; `add`, `multiply`; rejects negatives and non-integers.
- `Quantity` — integer, 1 ≤ n ≤ `MAX_QUANTITY_PER_ORDER` (10).
- `Email`, `Phone` — normalised and validated.
- `Address` — `addressLine1`, `addressLine2?`, `city`, `region`, `country` (`CO`), `postalCode?`.
- `Amounts` — `subtotalInCents` (price × qty), `baseFeeInCents`, `deliveryFeeInCents`, `totalInCents`.
- `TransactionReference` — `TX-<yyyymmdd>-<8 uppercase base32 chars>`; unique, non-sequential.

## Transaction state machine

```
              ┌──────────► APPROVED   (final)  → stock decremented, delivery created
PENDING ──────┼──────────► DECLINED   (final)  → stock untouched
              ├──────────► VOIDED     (final)  → stock untouched
              └──────────► ERROR      (final)  → stock untouched
```

- Only `PENDING` may transition. Resolving a final transaction is a no-op returning the current state.
- `Transaction.resolve(gatewayStatus, message)` returns `Result<Transaction, DomainError>` and is
  the only place that maps gateway statuses to ours (unknown status → stay `PENDING`).

## Delivery status

`PENDING` (created) → `SHIPPED` → `DELIVERED`. Only creation is exercised by the checkout flow;
the address can be amended while `PENDING` (see `api.md`).

## Business rules (PRD BR-xx → where enforced)

| Rule | Enforced in |
|---|---|
| BR-01 total formula | `Amounts.calculate(price, quantity, fees)` |
| BR-02 fees are server config | `FeesConfig` port, injected into the use case |
| BR-03 quantity bounds | `Quantity` VO + stock condition |
| BR-04 stock never negative | conditional atomic write (`data-model.md`) |
| BR-05 single final state | `Transaction.resolve` + `status = PENDING` condition |
| BR-06 / BR-07 stock + delivery on approval | `ResolveTransactionUseCase` |

## Use cases

| Use case | Module | Summary |
|---|---|---|
| `ListProducts`, `GetProduct`, `GetProductStock` | products | read catalogue / stock |
| `UpsertCustomer`, `GetCustomer` | customers | create or update by email |
| `GetPaymentConfig` | payment-config | public key, acceptance info, fees |
| `CreateTransaction` | transactions | validate → stock check → amounts → customer → PENDING → charge → bounded poll → resolve |
| `GetTransaction` | transactions | read; if `PENDING` and has a gateway id, reconcile first |
| `ResolveTransaction` | transactions | apply a gateway status atomically (used by create, get, webhook) |
| `GetDelivery`, `GetDeliveryByTransaction`, `UpdateDeliveryAddress` | deliveries | read / amend while `PENDING` |

## Domain errors

Discriminated union on `code`. HTTP mapping in `api.md`.

`VALIDATION_ERROR` · `PRODUCT_NOT_FOUND` · `CUSTOMER_NOT_FOUND` · `TRANSACTION_NOT_FOUND` ·
`DELIVERY_NOT_FOUND` · `OUT_OF_STOCK` · `DELIVERY_NOT_EDITABLE` · `PAYMENT_GATEWAY_REJECTED`
(gateway returned 4xx for the charge request: bad token, bad signature…) ·
`PAYMENT_GATEWAY_UNAVAILABLE` (timeout / 5xx / network) · `PERSISTENCE_ERROR`.

A **declined payment is not an error**: the use case succeeds and returns a transaction whose
status is `DECLINED`.
