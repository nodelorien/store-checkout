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
| GET | `/products` | 200 | list products with stock |
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
| POST | `/webhooks/payment-gateway` | 200 | gateway event (checksum-verified). Optional, see spec 008 |

## Key payloads

`GET /products` → `200`
```json
{ "data": [ { "id": "uuid", "name": "…", "description": "…", "priceInCents": 12990000,
              "currency": "COP", "imageUrl": "/images/products/<slug>.svg", "stock": 12 } ] }
```

`GET /payment-config` → `200`
```json
{ "data": { "publicKey": "pub_…", "tokenizationUrl": "https://…/tokens/cards",
            "acceptance": { "token": "…", "permalink": "https://…pdf" },
            "currency": "COP", "baseFeeInCents": 250000, "deliveryFeeInCents": 800000 } }
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
Optional header `Idempotency-Key: <uuid>` — a repeated key returns the original transaction (200) instead of charging twice.

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

## Validation (DTO level)

- `productId`: UUID. `quantity`: int 1–10. `installments`: int 1–36 (default 1).
- `cardToken`, `acceptanceToken`: non-empty strings ≤ 2048 chars. `cardBrand`: `VISA | MASTERCARD`. `cardLastFour`: 4 digits.
- `fullName`: 3–100 chars. `email`: RFC email ≤ 254. `phone`: E.164-ish `^\+?[0-9]{7,15}$`.
- `addressLine1`: 5–120. `city`, `region`: 2–60. `country`: `CO`. `postalCode`: optional, 4–10 alphanumerics.
- Unknown properties → 400 (`forbidNonWhitelisted`). Strings are trimmed.
- Any field resembling card data (`number`, `cvc`, `expMonth`…) is rejected by the whitelist — by design.

## Error envelope

```json
{ "error": { "code": "OUT_OF_STOCK", "message": "Only 0 units left", "details": [], "requestId": "…" } }
```

| Code | HTTP |
|---|---|
| `VALIDATION_ERROR` | 400 (`details` = field errors) |
| `*_NOT_FOUND` | 404 |
| `OUT_OF_STOCK`, `DELIVERY_NOT_EDITABLE` | 409 |
| `PAYMENT_GATEWAY_REJECTED` | 422 |
| rate limited | 429 |
| `PAYMENT_GATEWAY_UNAVAILABLE` | 502 |
| `PERSISTENCE_ERROR`, unexpected | 500 (generic message, no internals) |

A declined card is **not** an HTTP error: `201` with `status: "DECLINED"`.

## HTTP hygiene

- `Cache-Control: no-store` on everything under `/transactions`, `/customers`, `/deliveries`; `/products` may use `max-age=0, must-revalidate`.
- `helmet`, body limit 10 kb, rate limit (`@nestjs/throttler`): 60 req/min global, 10/min on `POST /transactions`.
- CORS: disabled in production (same origin); allow `http://localhost:5173` in development only.
- `X-Request-Id` echoed/generated on every response.
