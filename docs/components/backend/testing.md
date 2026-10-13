---
layer: L3
component: backend
read-when: writing API tests or fixing API coverage
---

# Backend testing

Jest + `ts-jest` (or `@swc/jest`). Threshold 80% global (statements, branches, functions, lines); aim ≥ 90%.

## Test pyramid

| Layer | What to test | How |
|---|---|---|
| `shared/result` | every combinator, ok and err tracks | pure unit, 100% |
| `domain/` | VOs (valid/invalid), `Amounts.calculate`, `Transaction.createPending/resolve`, state machine | pure unit, no mocks |
| `application/use-cases` | every railway: happy path + **each** failure branch | in-memory fakes of ports (`test/fakes/`) |
| `infrastructure/persistence` | mappers; command inputs (keys, conditions); cancellation-reason → error mapping | `aws-sdk-client-mock` |
| `infrastructure/gateway` | request building, signature, status mapping, timeout/4xx/5xx → errors | mocked HTTP client |
| `infrastructure/http` | DTO validation, status codes, error envelope | Nest `Test.createTestingModule` + `supertest`, use cases faked |

## Integration tests

`npm run test:integration` (needs `docker compose up -d dynamodb redis`). Files:
`apps/api/test/integration/*.int-spec.ts`, own config `jest.integration.config.js`, no coverage.
The real `AppModule` over HTTP against DynamoDB Local, Redis and `support/gateway-stub.ts`, a
local HTTP stand-in for the gateway driven by the card token (`TOKENS`). Each file creates its
own tables and deletes them. They cover what fakes cannot: the atomic approval write and its
stock condition under concurrency, the idempotency lock, indexes, cache hit / invalidation and
expiry. Keep one behaviour per test and use a fresh product per test. The same stand-in runs
as a process with `npm run gateway:stub -w apps/api` (local runs without credentials, load tests).

## Conventions

- Files: `*.spec.ts` next to the source. Fakes and builders: `apps/api/test/{fakes,builders}/`.
- Names trace to specs: `it('AC-3: returns OUT_OF_STOCK when stock is lower than quantity', …)`.
- Builders for fixtures (`aProduct().withStock(0).build()`); no shared mutable fixtures.
- Assert on `Result` with helpers `expectOk(result)` / `expectErr(result, 'CODE')`.
- Inject `Clock` and `IdGenerator` ports; never call `Date.now()` / `randomUUID()` directly in domain or use cases.
- No network, no real AWS, no DynamoDB Local in unit tests (that is what integration tests are for).

## Mandatory scenarios for `CreateTransaction`

1. Approved → transaction `APPROVED`, delivery created, stock decreased.
2. Declined → transaction `DECLINED`, no delivery, stock unchanged.
3. Out of stock → `OUT_OF_STOCK`, gateway never called.
4. Product not found → `PRODUCT_NOT_FOUND`.
5. Gateway rejects charge (4xx) → transaction `ERROR`, stock unchanged, `PAYMENT_GATEWAY_REJECTED`.
6. Gateway unavailable → transaction `ERROR`, stock unchanged, `PAYMENT_GATEWAY_UNAVAILABLE`.
7. Still pending after poll window → returns `PENDING`, stock unchanged.
10. Approved but stock sold out meanwhile → transaction `ERROR` (`OUT_OF_STOCK_AFTER_PAYMENT`), no delivery.
8. Same `Idempotency-Key` twice → one charge, same transaction.
9. Amounts are computed from the stored price, ignoring anything client-sent.

## Coverage config

Excluded only: `main.ts`, `lambda.ts`, `*.module.ts`, `*.port.ts` (interfaces), `*.dto.ts` with
no logic, `seed/`. Report: `text-summary` + `lcov`. Paste the `text-summary` into the README.
