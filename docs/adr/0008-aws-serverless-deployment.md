# ADR-0008: Serverless AWS deployment with CDK

- Status: Accepted
- Date: 2026-10-09
- Drivers: NFR-04, NFR-05, NFR-06, NFR-08

## Context

20 points for a deployed app + API; bonus for HTTPS and security headers; infrastructure as
code is evaluated. Budget: free tier. Traffic: a handful of evaluators.

## Decision

- **Web:** private S3 bucket + CloudFront (Origin Access Control), SPA fallback to `index.html`,
  long-cache hashed assets, product images served from the same bucket/CDN.
- **API:** NestJS bundled with esbuild into a single Lambda (Node.js LTS runtime) behind an
  API Gateway HTTP API, via a serverless-express adapter. The same Nest app runs with
  `main.ts` locally and `lambda.ts` in AWS.
- **Routing:** CloudFront behaviour `/api/*` → API Gateway (no caching); everything else → S3.
  One HTTPS domain (`*.cloudfront.net`), same-origin, no production CORS.
- **Security headers:** CloudFront response-headers policy (HSTS, CSP, X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy, Permissions-Policy) + `helmet` in the API.
- **Secrets:** SSM Parameter Store SecureString, read at cold start.
- **IaC:** AWS CDK in TypeScript (`infra/`), three constructs: `Database`, `Api`, `Web`.
- **CI/CD:** GitHub Actions — lint, test with coverage gate, build on PR; `cdk deploy` on `main`.

## Consequences

- Positive: ~zero cost, HTTPS out of the box, whole stack in one `cdk deploy`.
- Positive: Swagger UI is publicly reachable at `/api/docs`.
- Negative: Lambda cold start (~1 s for Nest); acceptable, mitigated by esbuild bundling.
- Negative: API Gateway hard timeout (~30 s) bounds the create-transaction short-poll (kept ≤ 10 s).

## Alternatives rejected

- ECS Fargate / EKS / App Runner — always-on cost and more moving parts.
- EC2 + docker-compose — manual patching, TLS and deploys.
- Terraform — fine tool, but CDK keeps the repo single-language.
