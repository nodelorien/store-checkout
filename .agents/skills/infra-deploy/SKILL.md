---
name: infra-deploy
description: AWS deployment and CI/CD rules for this repo (CDK in TypeScript, S3 + CloudFront, API Gateway + Lambda, DynamoDB, SSM secrets, GitHub Actions, security headers). Use when touching infra/, workflows, environment variables, secrets handling or deploying.
---

# DevOps engineer (AWS CDK · serverless)

## Load

1. `docs/components/infra/CONTEXT.md` (always).
2. `docs/components/backend/data-model.md` when touching tables; `payment-gateway.md` for env vars.
3. ADR-0008 only when changing the topology.

## Procedure

1. No approved spec → use `sdd-workflow` first.
2. Change CDK constructs with their Jest template assertions (test first).
3. `npm run synth -w infra` and `npm run diff -w infra` before proposing a deploy. Show the diff.
4. **Deploying, destroying, or creating/updating secrets are outward-facing actions: ask the user
   for explicit confirmation each time**, and state which AWS account/region will be affected.
5. After deploy: smoke-test `/api/v1/health`, `/api/v1/products`, the SPA root, and Swagger; check
   response headers; record URLs for the README.
6. Update `docs/components/infra/CONTEXT.md` when resources, env vars or workflows change.

## Non-negotiables

- Everything is CDK code. No console-created resources.
- No secret values in the repo, CDK context, workflow YAML, logs or stack outputs. Secrets are
  SSM `SecureString` parameters created out-of-band; `.env.example` holds placeholders only.
- Least-privilege IAM: the Lambda role gets only its four tables (+ indexes) and its own SSM path.
- S3 bucket is private; access only through CloudFront OAC. HTTPS only (redirect HTTP → HTTPS).
- Security headers policy on CloudFront as listed in `CONTEXT.md`; verify with Mozilla Observatory.
- `/api/*` behaviour: caching disabled, all methods allowed, no SPA error fallback on API paths
  (API 404s must stay JSON 404s).
- Free-tier only. No NAT gateway, RDS, ALB or custom domain without a new ADR.
- Stack, resource names and tags never contain the payment provider's company name.
- CI: PR pipeline blocks merge on lint, typecheck, tests or coverage < 80%. Deploy only from `main`.
  GitHub → AWS via OIDC; actions pinned by commit SHA.

## Checks before calling a deployment done

- [ ] SPA loads over HTTPS; deep link `/transactions/<id>` survives a hard refresh.
- [ ] `GET /api/v1/products` returns seeded data through the CloudFront domain.
- [ ] A sandbox payment completes end-to-end from the deployed SPA.
- [ ] Security headers present on SPA and API responses.
- [ ] Swagger URL public and listed in the README.
- [ ] No secrets in `git log -p`, CloudFormation template or Lambda console env for the three secret values.

## Report back

Resources changed (from `cdk diff`), URLs, header check result, costs introduced (should be none).
