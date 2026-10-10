# Spec 003 — Products catalogue API

- Status: Done
- Component(s): backend
- Branch: `feat/003-products-catalog-api`
- Traces to: FR-01, FR-12, FR-13
- Context to load: `docs/components/backend/CONTEXT.md`, `domain.md`, `api.md`, `data-model.md`

## 1. Why

The shopper must see what can be bought, its price and how many units are left before paying.

## 2. Scope

**In:** product domain (`Product`, `Money`, `Quantity`); read-only repository; `GET /products`,
`GET /products/:id`, `GET /products/:id/stock`; seed of six dummy products; table creation
script for DynamoDB Local.

**Out:** creating or editing products (forbidden by the brief); stock decrement (spec 006).

## 3. Behaviour

The catalogue lists every seeded product with its current stock, sorted by name. A product and
its stock can be read individually by id.

## 4. Acceptance criteria

- **AC-1** — Given seeded products, when `GET /products` is requested, then it answers `200` with `{ data: [...] }` where each item has `id`, `name`, `description`, `priceInCents`, `currency`, `imageUrl`, `stock`, sorted by name.
- **AC-2** — Given an existing id, when `GET /products/:id` is requested, then it answers `200` with that product.
- **AC-3** — Given an unknown id, `GET /products/:id` and `GET /products/:id/stock` answer `404` `PRODUCT_NOT_FOUND`.
- **AC-4** — Given an id that is not a UUID, the answer is `400` `VALIDATION_ERROR`.
- **AC-5** — Given an existing id, `GET /products/:id/stock` answers `200` with `{ productId, stock, updatedAt }`.
- **AC-6** — Given the data store fails, the answer is `500` `PERSISTENCE_ERROR` with a generic message.
- **AC-7** — `Quantity` accepts integers from 1 to 10 only; `Money` rejects negative and non-integer amounts.
- **AC-8** — `Product.ensureAvailable(quantity)` fails with `OUT_OF_STOCK` when stock is lower than the quantity.
- **AC-9** — The seed contains exactly the six agreed products with fixed UUIDs, integer-cent COP prices, one product with stock 1 and one with stock 0, and `imageUrl` `/images/products/<slug>.svg`; running it twice leaves the same items.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Empty table | `200` with `data: []` |
| Scan is paginated by the store | every page is read |
| Re-running the seed | items are overwritten (stock resets) — documented |

## 6. Contract changes

None to `api.md` shapes. `imageUrl` now points at `.svg` files (was `.webp`).

## 7. Security and privacy notes

Public, read-only data. Ids are validated as UUIDs before reaching the store.

## 8. Plan and tasks (merged)

- [x] T01 Domain: `Money`, `Quantity`, `Product` + tests
- [x] T02 Port `ProductRepository`; use cases `ListProducts`, `GetProduct`, `GetProductStock` + tests with in-memory fake
- [x] T03 `DynamoDbProductRepository` + mapper + tests (`aws-sdk-client-mock`)
- [x] T04 Controller, Swagger models, module wiring + supertest tests
- [x] T05 Seed data, seed script, `tables:create` script, npm scripts
- [x] T06 Docs: `data-model.md` (SVG), `api.md`
- [x] T90 lint, typecheck, test:cov green
