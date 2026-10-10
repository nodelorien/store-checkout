# Spec 007 — Deliveries API

- Status: Done
- Component(s): backend
- Branch: `feat/007-deliveries-api`
- Traces to: FR-09, FR-12, BR-07
- Context to load: `docs/components/backend/CONTEXT.md`, `domain.md`, `api.md`, `data-model.md`

## 1. Why

After an approved payment the buyer must be able to see where the product will be sent, and fix
a typo in the address before it ships.

## 2. Scope

**In:** `GET /deliveries/:id`, `GET /transactions/:id/delivery`, `PATCH /deliveries/:id` (address
only, while `PENDING`); delivery repository.

**Out:** creating deliveries over HTTP (they are created only by the approval write, spec 006);
moving a delivery to `SHIPPED` / `DELIVERED` (no fulfilment back office in this project).

## 3. Behaviour

A delivery exists only for an approved transaction. It can be read by its id or through its
transaction. Its address can be partially amended while the delivery is still `PENDING`.

## 4. Acceptance criteria

- **AC-1** — `GET /deliveries/:id` answers `200` with `{ id, transactionId, customerId, productId, quantity, address, status, createdAt, updatedAt }`; unknown id → `404` `DELIVERY_NOT_FOUND`; non-UUID → `400`.
- **AC-2** — `GET /transactions/:id/delivery` answers `200` with the delivery of that transaction; when the transaction has no delivery (not approved, or unknown) → `404` `DELIVERY_NOT_FOUND`.
- **AC-3** — `PATCH /deliveries/:id` with one or more address fields answers `200` with the merged address and a new `updatedAt`; fields not sent keep their value.
- **AC-4** — `PATCH` on a delivery that is not `PENDING` answers `409` `DELIVERY_NOT_EDITABLE` (also when it stops being `PENDING` between the read and the write).
- **AC-5** — `PATCH` with an empty body, an invalid field or an unknown property answers `400` `VALIDATION_ERROR`; the merged address is validated as a whole by the domain.
- **AC-6** — Store failures answer `500` `PERSISTENCE_ERROR`.
- **AC-7** — Delivery responses carry `Cache-Control: no-store`.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| `addressLine2` sent as an empty string | the line is removed |
| Only `country` sent with another value than `CO` | `400` |
| Amending the address | the transaction's own `shippingAddress` snapshot is not rewritten |

## 6. Contract changes

Delivery resource and `PATCH` body made explicit in `api.md`.

## 7. Security and privacy notes

Addresses are personal data: never logged, responses `no-store`. Only address fields are writable.

## 8. Plan and tasks (merged)

- [x] T01 Port + in-memory fake; `GetDelivery`, `GetDeliveryByTransaction`, `UpdateDeliveryAddress` + tests
- [x] T02 `DynamoDbDeliveryRepository` (`byTransaction` GSI, conditional update) + tests
- [x] T03 DTO, controller, module + supertest tests
- [x] T04 Docs: `api.md`
- [x] T90 lint, typecheck, test:cov green
