# Spec 015 — AWS deployment

- Status: Done
- Component(s): infra
- Branch: `feat/015-aws-deployment`
- Traces to: NFR-04, NFR-05, NFR-06, NFR-08
- Context to load: `docs/components/infra/CONTEXT.md`, ADR-0008

## 1. Why

The app and the API must be publicly reachable over HTTPS, reproducibly, from code.

## 2. Scope

**In:** one CDK stack with DynamoDB tables, the API on Lambda behind an HTTP API, the SPA on a
private S3 bucket behind CloudFront, `/api/*` routed through the same distribution, security
headers, least-privilege IAM, secrets referenced from SSM, a Lambda bundling script, a deploy
workflow.

**Out:** custom domain, WAF, multi-stage pipelines, any paid resource.

## 3. Acceptance criteria

- **AC-1** — The stack defines the four tables with the keys and indexes of `backend/data-model.md`, billed on demand.
- **AC-2** — The API function receives table names, fees and gateway settings as environment variables; secret values never appear in the template, only SSM parameter names.
- **AC-3** — The function role can read and write only the four tables (and their indexes) and read only its own SSM parameter path; no wildcard resources.
- **AC-4** — The site bucket blocks all public access and is reachable only through CloudFront.
- **AC-5** — The distribution redirects HTTP to HTTPS, serves the SPA by default and forwards `/api/*` to the HTTP API without caching.
- **AC-6** — Client-side routes (paths without a file extension) resolve to `index.html`, while API responses are never rewritten.
- **AC-7** — Responses carry HSTS, CSP (allowing connections only to self and the configured gateway origin), `nosniff`, frame denial, referrer and permissions policies.
- **AC-8** — The gateway origin and public key come from deploy-time variables; the provider's name is not written in the source.
- **AC-9** — The stack outputs the site URL and the API docs URL.

## 4. Plan and tasks (merged)

- [x] T01 `infra` workspace: CDK app, Jest config
- [x] T02 `Database` construct + tests (AC-1)
- [x] T03 `Api` construct + tests (AC-2, AC-3)
- [x] T04 `Web` construct: bucket, distribution, SPA rewrite function, headers + tests (AC-4..AC-7)
- [x] T05 Stack wiring, config from environment, outputs + tests (AC-8, AC-9)
- [x] T06 Lambda bundling script, deploy workflow
- [x] T07 First deploy, seed, smoke test (deployed to `us-east-2` on 2026-10-10)
