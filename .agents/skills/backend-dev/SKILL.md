---
name: backend-dev
description: Backend engineering rules for apps/api (NestJS, hexagonal architecture, ports and adapters, railway-oriented use cases, DynamoDB, payment gateway adapter). Use when implementing or changing API endpoints, domain logic, use cases, repositories or the gateway integration.
---

# Backend engineer (NestJS · hexagonal · ROP)

## Load

1. `docs/components/backend/CONTEXT.md` (always).
2. The feature's `specs/NNN-*/spec.md`, `plan.md`, `tasks.md`.
3. Only the L3 docs for what you touch: `domain.md` · `api.md` · `data-model.md` · `payment-gateway.md` · `testing.md`.

Do not load frontend or infra docs unless the task changes the HTTP contract or env vars.

## Procedure

1. No approved spec → stop and use `sdd-workflow` first.
2. Work the task list in order, test first. Inside-out: domain → use case → adapters → controller → module wiring.
3. For each use case, write the railway first (steps + error codes), then tests for every branch, then code.
4. Run `npm run test -w apps/api -- <path>` while iterating; `npm run test:cov -w apps/api` before finishing.
5. Update the L3 docs your change invalidates (`api.md` for any contract change) in the same change set.

## Non-negotiables

- **Layering:** `domain/` is pure TypeScript. `application/` depends only on `domain/` and port
  interfaces. Nest, AWS SDK and HTTP clients appear only in `infrastructure/` and `*.module.ts`.
- **ROP:** use cases and ports return `Promise<Result<T, DomainError>>`. Compose with
  `map` / `andThen` / `mapErr`. No `throw` and no `try/catch` for expected failures. Adapters
  convert thrown SDK/HTTP errors into `err(...)` at the boundary.
- **Controllers** are thin: DTO in → use case → `match` → HTTP response/envelope. No branching on business state.
- **Validation in two places:** DTO (shape, via `class-validator`) and domain (meaning, via value objects).
- **Money** is integer cents; totals are computed by `Amounts.calculate` from stored prices and
  server-side fees — never from request data.
- **Atomicity:** stock and transaction status change only through the conditional
  `TransactWriteItems` operations described in `data-model.md`. Never read-then-write stock.
- **Idempotency:** resolving an already-final transaction is a successful no-op.
- **Secrets and PII:** never log card tokens, keys, emails or phones. Never accept card numbers.
- **Naming:** say "payment gateway"; never the provider's company name (also in identifiers and env vars).
- **Determinism:** time and ids come from injected `Clock` / `IdGenerator` ports.
- **Swagger:** every endpoint documents request, success and error responses.

## Naming

| Thing | Pattern | Example |
|---|---|---|
| Use case | `<verb>-<noun>.use-case.ts` / `<Verb><Noun>UseCase` | `create-transaction.use-case.ts` |
| Port | `<noun>.port.ts` + token `<NOUN>_PORT` or `<NOUN>_REPOSITORY` | `payment-gateway.port.ts` |
| Adapter | `<tech>-<noun>.<kind>.ts` | `dynamodb-product.repository.ts`, `http-payment-gateway.adapter.ts` |
| DTO | `<verb>-<noun>.dto.ts` | `create-transaction.dto.ts` |
| Test | same name + `.spec.ts` | |

## Definition of done

- All tasks ticked; every `AC-n` has a passing test titled `AC-n: …`.
- `lint`, `typecheck`, `test:cov` green; coverage ≥ 80% (aim 90%+).
- No import-boundary violations; no `any` without justification.
- Docs updated; Swagger renders the new endpoint.

## Report back

Files changed, tests added (count + coverage summary), contract changes, anything deferred.
