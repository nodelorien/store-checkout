# ADR-0009: Jest everywhere, 80% enforced

- Status: Accepted
- Date: 2026-10-09
- Drivers: NFR-03 (30 points — the largest single rubric item)

## Context

Unit tests are mandatory on both sides, must be written with Jest, must exceed 80% coverage,
and the results go in the README. The web app is built with Vite, whose natural runner (Vitest)
is not Jest.

## Decision

- Jest in `apps/api`, `apps/web` and `infra`. No Vitest, even though the web app uses Vite.
- Web: Jest + `jsdom` + Testing Library + `@swc/jest` (or `ts-jest`); MSW (or a fetch mock) for
  the API layer. Anything Vite-specific (`import.meta.env`) is isolated behind `src/shared/config/env.ts`
  so Jest can mock one module.
- `coverageThreshold.global` = 80 for statements, branches, functions and lines in each app.
  CI fails below it. Target 90%+ to leave margin.
- Coverage exclusions are limited to: entry points (`main.ts`, `lambda.ts`, `main.tsx`), Nest
  module wiring files, type-only files, generated code. Nothing else is excluded.
- Tests are written with the code (TDD for domain and use cases); each `tasks.md` item names its tests.
- `npm run test:cov` at the root runs every workspace and prints the summaries pasted into the README.

## Consequences

- Positive: coverage cannot silently regress; the 30-point item is protected from day one.
- Positive: hexagonal + ROP make the high-value logic testable without mocks of AWS or HTTP.
- Negative: Jest + ESM/Vite needs a little config (transform, CSS/asset module mappers).

## Alternatives rejected

- Vitest for the web — faster, but the brief says Jest.
- E2E-heavy strategy (Playwright/Cypress) — not counted by the rubric; optional smoke test only.
