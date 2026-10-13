---
layer: L1
component: system
read-when: work crosses component boundaries, or you need the end-to-end payment sequence
---

# Architecture overview

## Components

| Component | Path | Stack | L2 entry |
|---|---|---|---|
| API | `apps/api` | NestJS, TypeScript, AWS SDK v3 (DynamoDB), Jest | `docs/components/backend/CONTEXT.md` |
| Web | `apps/web` | React, Vite, MUI, Redux Toolkit, React Router, Jest + Testing Library | `docs/components/frontend/CONTEXT.md` |
| Infra | `infra` | AWS CDK (TypeScript), GitHub Actions | `docs/components/infra/CONTEXT.md` |

Monorepo with npm-compatible workspaces (ADR-0001). No shared runtime package: the HTTP contract
(`docs/components/backend/api.md` + generated OpenAPI) is the only coupling between web and API.

## Runtime topology

```
Browser ──HTTPS──> CloudFront ──┬── /*       → S3 (SPA static assets, product images)
   │                            └── /api/*   → API Gateway (HTTP API) → Lambda (NestJS) → DynamoDB
   │                                                                        │   └ ─ → Redis (optional cache, ADR-0013)
   │                                                                        │
   └── card tokenization (public key) ──────────> Payment gateway <── charge (private key) ──┘
```

Single origin for SPA and API → no CORS in production, one place for security headers.

## Payment sequence (the core flow)

```
1  Web   GET  /api/v1/products                                  → list + stock
2  Web   GET  /api/v1/payment-config                            → public key, acceptance link, fees
3  Web → Gateway  tokenize card (public key)                    → card token (PAN never hits our API)
4  Web   POST /api/v1/transactions {productId, qty, cardToken, acceptanceToken, customer, delivery}
5  API   validate → compute amounts → upsert customer
         → check stock ≥ qty → create transaction PENDING (reference = transaction number)
6  API → Gateway  create charge (private key + integrity signature)
7  API   short-poll gateway for a final status (bounded) → resolve if final
8  API   201 {transaction}         (status may still be PENDING)
9  Web   if PENDING: poll GET /api/v1/transactions/:id  (API reconciles with gateway on read)
10 API   on final status, atomically:
         APPROVED          → transaction APPROVED + decrement stock + create delivery
         DECLINED/ERROR/…  → transaction final, stock untouched
11 Web   show result → back to product page → refetch products
```

Details: backend `payment-gateway.md` and `domain.md`; frontend `checkout-flow.md`.

## Cross-cutting decisions (see `docs/adr/`)

| Topic | Decision | ADR |
|---|---|---|
| Repo layout | Monorepo `apps/api`, `apps/web`, `infra` | 0001 |
| Backend architecture | Hexagonal, ports & adapters, per-module | 0002 |
| Error handling | ROP with an in-house `Result<T, E>` | 0003 |
| Persistence | DynamoDB, one table per aggregate | 0004 |
| Frontend state | Redux Toolkit (+ RTK Query), selective localStorage persistence | 0005 |
| Stock consistency | Decrement only on approval, conditional atomic write | 0011 |
| Card data | Client-side tokenization; API never sees PAN | 0007 |
| Deployment | S3 + CloudFront + API Gateway + Lambda, CDK | 0008 |
| Testing | Jest everywhere, 80% global threshold enforced in CI | 0009 |
| Caching | Optional Redis cache-aside for the scanned reads, fail-open | 0013 |
| AI context | Layered docs + SDD + shared skills | 0010 |

## Conventions shared by all components

- TypeScript `strict`. ESLint + Prettier. No `any` without a comment justifying it.
- Money: integer cents. Dates: ISO-8601 UTC strings. IDs: UUID v4.
- API JSON is `camelCase`; errors follow one envelope (`api.md`).
- Env vars: `PAYMENT_GATEWAY_*` for the provider, validated at boot.
