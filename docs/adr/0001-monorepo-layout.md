# ADR-0001: Monorepo with `apps/api`, `apps/web`, `infra`

- Status: Accepted
- Date: 2026-10-09
- Drivers: NFR-08, NFR-09, NFR-10

## Context

One candidate, one public repository, one README must describe frontend, backend and
infrastructure. Evaluators and AI agents need to find each part quickly.

## Decision

A single repository with package-manager workspaces:

```
apps/api    NestJS API
apps/web    React SPA
infra       AWS CDK app
docs        layered context docs
specs       feature specs
```

No shared runtime package between `api` and `web`. The HTTP contract is documented in
`docs/components/backend/api.md` and published as OpenAPI; the web app declares its own types.

## Consequences

- Positive: one PR can carry spec + API + UI; one CI pipeline; docs sit next to code.
- Positive: component boundaries map 1:1 to context folders, so agents load one component's docs.
- Negative: API and web types can drift; mitigated by contract tests on the web API layer and the reviewer checklist.

## Alternatives rejected

- Two repositories — doubles README/CI work and splits the commit history evaluators look at.
- Shared `packages/contracts` — extra build wiring (Lambda bundling, Jest module mapping) for ~10 types.
- Nx / Turborepo — tooling overhead not justified for three packages.
