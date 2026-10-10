# Lumen Store — product checkout with card payment

Mobile-first SPA where a customer picks a product, pays with a credit card through an external
payment gateway (sandbox), provides delivery data, sees the result and returns to a catalogue
with updated stock.

| | |
|---|---|
| Live app | <https://d1bup7lds8dkbd.cloudfront.net> |
| API docs (Swagger) | <https://d1bup7lds8dkbd.cloudfront.net/api/docs> — locally `http://localhost:3000/api/docs` |
| Stack | React 19 · MUI · Redux Toolkit / RTK Query · NestJS 11 · DynamoDB · AWS CDK · Jest |

## Flow

1. **Product page** — products, price, stock, button "Pay with credit card".
2. **Card + delivery** — modal with validation and VISA / MasterCard logo detection.
3. **Summary** — backdrop with product amount, base fee, delivery fee, total and pay button.
4. **Final status** — approved / declined / error / pending (polling).
5. **Product page** — stock refreshed.

Refreshing the browser at any step restores progress. Card number, CVC and expiry are never
stored: the browser tokenizes the card directly with the gateway and only the token, brand and
last four digits are kept.

## Architecture

```
Browser ─► CloudFront ─┬─ /*      ► S3 (SPA + images)
                       └─ /api/*  ► API Gateway ► Lambda (NestJS) ► DynamoDB
Browser ─► payment gateway (card tokenization, public key)
Lambda  ─► payment gateway (charge + status, private key + integrity signature)
```

- **Backend** (`apps/api`): hexagonal architecture — `domain/` (pure TypeScript), `application/`
  (use cases + ports), `infrastructure/` (HTTP controllers, DynamoDB repositories, gateway adapter).
  Controllers hold no business logic. Use cases follow Railway Oriented Programming with a
  `Result<T, E>` type; ESLint forbids inner layers from importing frameworks or SDKs.
- **Frontend** (`apps/web`): Redux Toolkit (Flux), RTK Query for server data, allow-listed
  `localStorage` snapshot for refresh recovery.
- **Infra** (`infra`): AWS CDK — DynamoDB, Lambda + HTTP API, private S3 + CloudFront, security
  headers (HSTS, CSP, nosniff, frame deny, referrer and permissions policies), least-privilege IAM.

Decisions are recorded in [`docs/adr`](docs/adr); requirements in [`docs/product/prd.md`](docs/product/prd.md).

## Data model (DynamoDB, one table per aggregate)

| Table | PK | Indexes | Main attributes |
|---|---|---|---|
| products | `id` | — | name, description, priceInCents, currency, imageUrl, stock |
| customers | `id` | `byEmail` | fullName, email, phone |
| transactions | `id` | `byReference`, `byIdempotencyKey` | reference, status, productId, quantity, customerId, amounts, card brand/last four, gatewayTransactionId, deliveryId |
| deliveries | `id` | `byTransaction` | transactionId, customerId, productId, quantity, address, status |

```
customers 1 ─── n transactions n ─── 1 products
                     1 │
                       0..1 deliveries
```

Transaction states: `PENDING → APPROVED | DECLINED | VOIDED | ERROR`. On approval one atomic
write marks the transaction approved, decrements stock (`stock >= quantity` condition) and
creates the delivery. Details: [`docs/components/backend/data-model.md`](docs/components/backend/data-model.md).

## API (`/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/products`, `/products/:id`, `/products/:id/stock` | catalogue and stock |
| GET | `/payment-config` | gateway public key, acceptance terms, fees |
| PUT | `/customers` · GET `/customers/:id` | upsert / read customer |
| POST | `/transactions` · GET `/transactions/:id` | create payment (idempotent) / read + reconcile |
| GET | `/transactions/:id/delivery` · `/deliveries/:id` · PATCH `/deliveries/:id` | deliveries |
| POST | `/webhooks/payment-gateway` | gateway events (checksum verified) |

Full contract: [`docs/components/backend/api.md`](docs/components/backend/api.md) and Swagger.

## Test coverage (Jest)

`npm run test:cov`

| Workspace | Tests | Statements | Branches | Functions | Lines |
|---|---|---|---|---|---|
| Backend `apps/api` | 508 (33 suites) | 100% | 99.58% | 100% | 100% |
| Frontend `apps/web` | 493 (39 suites) | 98.66% | 94.54% | 99.26% | 99.57% |
| Infra `infra` | 31 | 100% | 100% | 100% | 100% |

A global threshold of 80% is enforced in each workspace and in CI.

## Run locally

Requirements: Node 22+, npm, Docker.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # fill in the sandbox gateway values
docker compose up -d dynamodb
npm run tables:create -w apps/api
npm run seed -w apps/api
npm run dev:api        # http://localhost:3000  (docs at /api/docs)
npm run dev:web        # http://localhost:5173
```

Quality gates: `npm run lint` · `npm run format:check` · `npm run typecheck` · `npm run test:cov` · `npm run build`.

## Deploy (AWS)

```bash
# once: store the three gateway secrets as SSM SecureString parameters
aws ssm put-parameter --type SecureString --name /checkout/prod/payment-gateway/private-key      --value '<private key>'
aws ssm put-parameter --type SecureString --name /checkout/prod/payment-gateway/integrity-secret --value '<integrity secret>'
aws ssm put-parameter --type SecureString --name /checkout/prod/payment-gateway/events-secret    --value '<events secret>'

export PAYMENT_GATEWAY_BASE_URL='<sandbox base url>' PAYMENT_GATEWAY_PUBLIC_KEY='<public key>'
npm run build && npm run bundle:api -w infra
npx cdk bootstrap --app "npx tsx infra/bin/app.ts"     # first time per account/region
npm run deploy -w infra
# the seed loads apps/api/.env when present, so override its local region and endpoint
AWS_REGION="$(aws configure get region)" DYNAMODB_ENDPOINT= TABLE_PRODUCTS=checkout-prod-products npm run seed -w apps/api
```

The stack deploys to the region of the active AWS profile; the live app runs in `us-east-2`.

`.github/workflows/deploy.yml` does the same on pushes to `main` once the repository variables
`AWS_DEPLOY_ROLE_ARN`, `PAYMENT_GATEWAY_BASE_URL` and `PAYMENT_GATEWAY_PUBLIC_KEY` exist.

## Security notes

- Card data never reaches the API, logs, Redux or `localStorage`; the API rejects any card field.
- Secrets live in `.env` (git-ignored) locally and in SSM in AWS; none are in the repository.
- Prices and fees are computed server-side; input is validated and whitelisted; rate limiting,
  body limit, `helmet`, `no-store` on sensitive resources, redacted request logs.

## Known limitations

- Two simultaneous buyers of the last unit can both be charged; the second ends in `ERROR`
  (stock is updated only after payment, as the assessment specifies) and would need a refund.
- Rate limiting is in-memory per Lambda instance. No code splitting in the SPA yet.

## Working with AI agents

The repo is built spec-first with layered context docs: [`AGENTS.md`](AGENTS.md) (router and
hard rules), [`docs/`](docs/README.md) (PRD, ADRs, per-component context), [`specs/`](specs/README.md)
(one spec per feature) and shared role skills in `.agents/skills`.
