---
layer: L2
component: infra
read-when: touching infra/ (AWS CDK), CI/CD workflows, environment variables or deployment
---

# Infra context (`infra/`)

AWS CDK app in TypeScript (ADR-0008). One stack, three constructs. Everything free-tier friendly.

## Resources

| Construct | Resources |
|---|---|
| `Database` | 4 DynamoDB tables (on-demand) with the keys/GSIs from `backend/data-model.md`; `RemovalPolicy.DESTROY` (assessment stack) |
| `Api` | Lambda (`NodejsFunction`, esbuild bundle of `apps/api/src/lambda.ts`, arm64, 512 MB, timeout 29 s) · API Gateway HTTP API (`$default` → Lambda, throttling) · IAM least privilege (only the 4 tables + their indexes, read of its SSM parameters) · log retention 1 week |
| `Web` | private S3 bucket (block public access, SSE) · CloudFront distribution with OAC · behaviours: default → S3, `/api/*` → HTTP API (caching disabled, all methods, forward headers except `Host`) · SPA fallback (403/404 → `/index.html` 200, default behaviour only) · response-headers policy · `BucketDeployment` of `apps/web/dist` |

Outputs: `CloudFrontUrl`, `ApiDocsUrl` (`…/api/docs`), `ApiGatewayUrl`.

## Security headers (CloudFront response-headers policy)

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy`: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'`
  (MUI/Emotion) `; script-src 'self'; connect-src 'self' <gateway origin>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
- `X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` · `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

Swagger UI needs a relaxed CSP on `/api/docs*` only (set by the API with `helmet`, not by CloudFront).
Goal: grade A or better on Mozilla Observatory; record the result in the README.

## Configuration and secrets

| Name | Where | Kind |
|---|---|---|
| `PAYMENT_GATEWAY_BASE_URL`, `PAYMENT_GATEWAY_PUBLIC_KEY` | Lambda env (from CDK context / CI vars) | plain |
| `PAYMENT_GATEWAY_PRIVATE_KEY`, `PAYMENT_GATEWAY_INTEGRITY_SECRET`, `PAYMENT_GATEWAY_EVENTS_SECRET` | SSM Parameter Store `SecureString` under `/checkout/<stage>/…`, read at cold start | secret |
| `TABLE_*`, `BASE_FEE_IN_CENTS`, `DELIVERY_FEE_IN_CENTS`, `NODE_ENV`, `LOG_LEVEL` | Lambda env | plain |
| `VITE_API_BASE_URL` | web build | `/api/v1` in prod, `http://localhost:3000/api/v1` in dev |

Locally: `apps/api/.env` (git-ignored) from `apps/api/.env.example` (placeholders only).
Secrets are created once with the AWS CLI, **never** through CDK source or CI logs.

## CI/CD (`.github/workflows/`)

| Workflow | Trigger | Jobs |
|---|---|---|
| `ci.yml` | pull request, push | install → lint → typecheck → `test:cov` (api, web, infra; fails < 80%) → build |
| `deploy.yml` | push to `main` (after CI) | build web + api → `cdk deploy --require-approval never` → seed products → smoke test `/api/v1/health` |

AWS auth through GitHub OIDC role (no long-lived keys). Third-party actions pinned by SHA.

## Rules

1. No resource is created by hand; if it is not in CDK it does not exist.
2. No secret values in CDK code, context files, workflow files or outputs.
3. IAM: no `*` actions or resources on the Lambda role.
4. CDK constructs have Jest tests (`Template.fromStack` assertions) — counted separately from app coverage.
5. Do not introduce paid resources (NAT gateway, RDS, ALB, custom domains) without a new ADR.
6. Resource names, tags and stack name must not contain the payment provider's name (`checkout-<stage>`).
   The gateway origin for the CSP and the base URL are passed as deploy-time variables, never written in CDK source.

## Commands (once scaffolded)

`npm run synth -w infra` · `npm run diff -w infra` · `npm run deploy -w infra` · `npm run test -w infra`

## README deliverables owned by infra

Deployed app URL, Swagger URL, architecture diagram, deploy instructions, Observatory score.
