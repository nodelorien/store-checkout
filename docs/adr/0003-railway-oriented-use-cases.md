# ADR-0003: ROP with an in-house `Result` type

- Status: Accepted
- Date: 2026-10-09
- Drivers: NFR-02 (and 10 bonus points)

## Context

Use cases should follow Railway Oriented Programming: each step returns success or failure and
the pipeline short-circuits on the first failure. Expected failures (validation, out of stock,
declined payment) are not exceptions.

## Decision

A small in-house `Result<T, E>` in `apps/api/src/shared/result/`:

- Constructors `ok(value)`, `err(error)`; guards `isOk`, `isErr`.
- Combinators `map`, `mapErr`, `andThen`, `tap`, `match`, and async variants
  (`andThenAsync`, or a `ResultAsync` wrapper) so pipelines read top-to-bottom.
- Every port method and use case returns `Promise<Result<T, DomainError>>`.
- `DomainError` is a discriminated union (`code` field). One HTTP-layer mapper translates
  `code → status` (`api.md`). Controllers call `match` — no `try/catch`, no `if (isErr)` ladders.
- `throw` is reserved for programmer errors and truly unexpected infrastructure failures;
  adapters catch SDK/HTTP exceptions and convert them to `err(...)`.

## Consequences

- Positive: failure paths are visible in types and trivially testable.
- Positive: zero dependencies; ~100 lines, 100% covered.
- Negative: contributors must learn the combinators; documented in `backend/CONTEXT.md`.

## Alternatives rejected

- `neverthrow` — good library, but a hand-rolled type shows the pattern explicitly and avoids its ESLint plugin setup.
- `fp-ts` / `effect` — steep learning curve, heavy for this scope.
- Nest exception filters only — that is exception-driven flow, not ROP.
