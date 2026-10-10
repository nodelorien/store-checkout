# Spec 001 — Project scaffold

- Status: Done
- Component(s): backend, frontend, infra
- Branch: `feat/001-project-scaffold`
- Traces to: NFR-01, NFR-02, NFR-03, NFR-10
- Context to load: `docs/architecture/overview.md`, ADR-0001, ADR-0009

## 1. Why

Every later feature needs a workspace where lint, type-check, Jest and the 80% coverage gate
already run, so quality is enforced from the first feature commit.

## 2. Scope

**In:** npm workspaces (`apps/api`, `apps/web`, `infra`); NestJS app skeleton with a health
endpoint; React + Vite + MUI + Redux Toolkit skeleton; Jest in both apps with an 80% global
threshold; ESLint + Prettier; TypeScript strict; DynamoDB Local via docker-compose; CI workflow;
`.env.example` files with placeholders.

**Out:** any business feature, AWS resources (spec 015).

## 3. Acceptance criteria

- **AC-1** — Given a fresh clone, when `npm install` and `npm run test:cov` run at the root, then both apps' Jest suites pass and enforce an 80% global threshold.
- **AC-2** — Given the API is running, when `GET /api/v1/health` is requested, then it answers `200` with `{ "data": { "status": "ok" } }`.
- **AC-3** — Given the web app is rendered, then the application shell shows the store name.
- **AC-4** — `npm run lint` and `npm run typecheck` succeed at the root.
- **AC-5** — Code in `domain/` or `application/` importing `@aws-sdk/*`, `express` or HTTP clients fails lint.
- **AC-6** — No `.env` file is tracked; `.env.example` files contain placeholders only.

## 4. Plan and tasks (merged — small feature)

- [x] T01 Root `package.json` (workspaces, scripts), `tsconfig.base.json`, ESLint flat config, Prettier
- [x] T02 `apps/api`: Nest bootstrap (`bootstrap.ts`, `main.ts`), health module + tests, Jest config
- [x] T03 `apps/web`: Vite + React + MUI + Redux store skeleton, `env.ts`, Jest config (jsdom), App test
- [x] T04 `docker-compose.yml` with DynamoDB Local; `.env.example` files
- [x] T05 `.github/workflows/ci.yml`: install → lint → typecheck → test:cov → build
- [x] T90 lint, typecheck, test:cov green
