---
layer: L3
component: backend
read-when: adding or changing an endpoint, or consuming the API from the web app (this is the contract)
---

# HTTP API contract

Base path `/api/v1`. JSON, `camelCase`. Swagger UI at `/api/docs`, OpenAPI JSON at `/api/docs-json`.
No authentication (guest checkout); resource ids are unguessable UUIDs.

## Endpoints

| Method | Path | Success | Purpose |
|---|---|---|---|
| GET | `/health` | 200 | liveness |
| GET | `/products` | 200 | list products with stock; optional search, sort, paging |
| GET | `/products/:id` | 200 | one product |
| GET | `/products/:id/stock` | 200 | `{ productId, stock, updatedAt }` — explicit stock resource (FR-12) |
| GET | `/payment-config` | 200 | gateway public key, tokenization URL, acceptance info, fees |
| PUT | `/customers` | 200 / 201 | idempotent upsert by email (201 when created) |
| GET | `/customers/:id` | 200 | one customer |
| POST | `/transactions` | 201 | create PENDING, charge, return current state |
| GET | `/transactions/:id` | 200 | read (reconciles with gateway while PENDING) |
| GET | `/transactions/:id/delivery` | 200 | delivery of an approved transaction |
| GET | `/deliveries/:id` | 200 | one delivery |
| PATCH | `/deliveries/:id` | 200 | amend address while delivery is `PENDING` |
| POST | `/webhooks/payment-gateway` | 200 | gateway event (checksum-verified), answers `{ data: { received, handled } }` — spec 008 |
| GET | `/reports/summary` | 200 | sales and payment aggregates of the last days; no personal data |

## Key payloads

`GET /products?page&pageSize&search&sort` → `200` (all four optional; `meta` is always present)
```json
{ "data": [ { "id": "uuid", "name": "…", "description": "…", "priceInCents": 12990000,
              "currency": "COP", "imageUrl": "/images/catalog/<slug>.svg", "stock": 12 } ],
  "meta": { "page": 1, "pageSize": 12, "total": 18, "totalPages": 2 } }
```
- `page`: int ≥ 1 (default 1). `pageSize`: int 1–48; absent = no paging: every match in one page, `page` ignored, `meta` = `{ page: 1, pageSize: total (1 if 0), total, totalPages: 1 }`.
- `search`: trimmed, ≤ 60 chars, case-insensitive substring of `name` or `description`; empty = no filter.
- `sort`: `name` (default, A→Z — the historical order, spec 003 AC-1) · `featured` (curated: seed order) · `price-asc` · `price-desc`. Ties: name, then id.
- `total` counts matches after `search`; `totalPages` = max(1, ceil(total / pageSize)). A `page` past the end → `200`, `data: []`.

`GET /reports/summary?days` → `200` — `days`: int 1–90 (default 14), calendar days in `America/Bogota` (UTC−5) ending today
```json
{ "data": { "currency": "COP", "range": { "from": "2026-09-27", "to": "2026-10-10", "days": 14 },
    "totals": { "revenueInCents": 0, "approvedOrders": 0, "unitsSold": 0,
                "averageOrderInCents": 0, "totalAttempts": 0, "approvalRate": 0 },
    "salesByDay": [ { "date": "2026-09-27", "revenueInCents": 0, "orders": 0 } ],
    "topProducts": [ { "productId": "uuid", "name": "…", "unitsSold": 0, "revenueInCents": 0 } ],
    "payments": { "byStatus": [ { "status": "APPROVED", "count": 0 } ],
                  "byCardBrand": [ { "brand": "VISA", "attempts": 0, "approved": 0 } ] },
    "generatedAt": "ISO" } }
```
- A transaction counts on the day of its `createdAt`. Revenue (`totalInCents`), orders, units and `topProducts` use `APPROVED` only.
- `averageOrderInCents` = round(revenue / approvedOrders). `totalAttempts` = every transaction in range. `approvalRate` = approved / (approved + declined + error + voided), 0–1, 4 decimals (`PENDING` excluded). All 0 when empty.
- `salesByDay`: one zero-filled entry per day, oldest first. `topProducts`: ≤ 5 by revenue (ties: units, then name), name as stored on the transaction.
- `byStatus`: always `APPROVED, DECLINED, ERROR, VOIDED, PENDING`. `byCardBrand`: always `VISA, MASTERCARD`.

`GET /payment-config` → `200`
```json
{ "data": { "publicKey": "pub_…", "tokenizationUrl": "https://…/tokens/cards",
            "acceptance": { "token": "…", "permalink": "https://…pdf" },
            "currency": "COP", "baseFeeInCents": 250000, "deliveryFeeInCents": 800000 } }
```

`PUT /customers` — request `{ "fullName", "email", "phone" }` → `201` (created) or `200` (same e-mail, updated)
```json
{ "data": { "id": "uuid", "fullName": "Ada Lovelace", "email": "ada@example.com",
            "phone": "+573001234567", "createdAt": "ISO", "updatedAt": "ISO" } }
```

`POST /transactions` — request
```json
{ "productId": "uuid", "quantity": 1,
  "cardToken": "tok_…", "cardBrand": "VISA", "cardLastFour": "4242", "installments": 1,
  "acceptanceToken": "…",
  "customer": { "fullName": "Ada Lovelace", "email": "ada@example.com", "phone": "+573001234567" },
  "delivery": { "addressLine1": "Cra 7 # 71-21", "addressLine2": "Apto 501",
                "city": "Bogotá", "region": "Cundinamarca", "country": "CO", "postalCode": "110231" } }
```
Optional header `Idempotency-Key: <uuid>` (8–128 chars of `A-Za-z0-9_-`) — a repeated key returns the original transaction (200) instead of charging twice.

Response `201` (and `GET /transactions/:id` → `200`)
```json
{ "data": { "id": "uuid", "reference": "TX-20261009-7K2M9QXA", "status": "APPROVED",
            "statusMessage": null,
            "product": { "id": "uuid", "name": "…", "imageUrl": "…" }, "quantity": 1,
            "amounts": { "subtotalInCents": 12990000, "baseFeeInCents": 250000,
                         "deliveryFeeInCents": 800000, "totalInCents": 14040000 },
            "currency": "COP", "card": { "brand": "VISA", "lastFour": "4242" },
            "customerId": "uuid", "deliveryId": "uuid | null",
            "createdAt": "ISO", "resolvedAt": "ISO | null" } }
```
`status` ∈ `PENDING | APPROVED | DECLINED | VOIDED | ERROR`. The client must not send prices or fees.

`GET /deliveries/:id`, `GET /transactions/:id/delivery`, `PATCH /deliveries/:id` → `200`
```json
{ "data": { "id": "uuid", "transactionId": "uuid", "customerId": "uuid", "productId": "uuid", "quantity": 1,
            "address": { "addressLine1": "…", "addressLine2": "… | null", "city": "…", "region": "…",
                         "country": "CO", "postalCode": "… | null" },
            "status": "PENDING | SHIPPED | DELIVERED", "createdAt": "ISO", "updatedAt": "ISO" } }
```
`PATCH` body: any subset (at least one) of the `delivery` address fields; fields not sent are kept.
`GET /transactions/:id/delivery` answers `404 DELIVERY_NOT_FOUND` until the transaction is approved.

## Validation (DTO level)

- `productId`: UUID. `quantity`: int 1–10. `installments`: int 1–36 (default 1).
- `cardToken`, `acceptanceToken`: non-empty strings ≤ 2048 chars. `cardBrand`: `VISA | MASTERCARD`. `cardLastFour`: 4 digits.
- `fullName`: 3–100 chars. `email`: RFC email ≤ 254. `phone`: E.164-ish `^\+?[0-9]{7,15}$`.
- `addressLine1`: 5–120. `city`, `region`: 2–60. `country`: `CO`. `postalCode`: optional, 4–10 alphanumerics.
- Unknown properties and unknown query parameters → 400 (`forbidNonWhitelisted`). Strings are trimmed.
- Query numbers must be plain integers in range (`page=abc`, `pageSize=49`, `days=0`, `sort=x` → 400).
- Any field resembling card data (`number`, `cvc`, `expMonth`…) is rejected by the whitelist — by design.

## Error envelope

```json
{ "error": { "code": "OUT_OF_STOCK", "message": "Only 0 units left", "details": [], "requestId": "…" } }
```

| Code | HTTP |
|---|---|
| `VALIDATION_ERROR` | 400 (`details` = `[{ field, message }]`, nested fields as `customer.email`; also malformed JSON and non-UUID ids) |
| `*_NOT_FOUND` | 404 |
| `INVALID_SIGNATURE` (webhook only) | 401 |
| `OUT_OF_STOCK`, `DELIVERY_NOT_EDITABLE` | 409 |
| `PAYMENT_GATEWAY_REJECTED` | 422 (generic message; `details` carry `transactionId` and `reference` of the stored `ERROR` transaction) |
| `NOT_FOUND` (unknown route) | 404 |
| `PAYLOAD_TOO_LARGE` | 413 |
| `RATE_LIMITED` | 429 |
| `PAYMENT_GATEWAY_UNAVAILABLE` | 502 (same `details` when raised by `POST /transactions` after the transaction was stored) |
| `PERSISTENCE_ERROR`, `INTERNAL_ERROR` (unexpected) | 500 (generic message, no internals) |

A declined card is **not** an HTTP error: `201` with `status: "DECLINED"`.

## HTTP hygiene

- `Cache-Control: no-store` on everything under `/transactions`, `/customers`, `/deliveries`, `/payment-config`, `/webhooks`, `/reports`; `/products` uses `max-age=0, must-revalidate`.
- `helmet`, body limit 10 kb, rate limit (`@nestjs/throttler`): 60 req/min global, 10/min on `POST /transactions`.
- CORS: disabled in production (same origin); allow `http://localhost:5173` in development only.
- `X-Request-Id` echoed/generated on every response.
