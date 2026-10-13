---
layer: L2
component: backend
read-when: any work inside apps/api
---

# Backend context (`apps/api`)

NestJS 11 API (pinned: v12 is ESM-only and breaks the CommonJS Jest + Lambda bundle setup). Hexagonal (ADR-0002), ROP use cases (ADR-0003), DynamoDB (ADR-0004), optional Redis cache (ADR-0013), runs on Lambda (ADR-0008).

## Deep dives (L3) — load only what you touch

| Doc | Read when |
|---|---|
| `domain.md` | changing entities, statuses, business rules, error codes |
| `api.md` | adding/changing an endpoint, DTO, status code (also the frontend's contract) |
| `data-model.md` | touching repositories, keys, atomic writes, seed data |
| `payment-gateway.md` | touching the outbound gateway adapter or payment resolution |
| `caching.md` | touching the Redis cache, its keys or lifetimes, or adding a cached read |
| `testing.md` | writing tests or fixing coverage |

## Folder structure

```
apps/api/src/
  main.ts  lambda.ts  app.module.ts  bootstrap.ts   # bootstrap.ts = shared app setup (pipes, helmet, swagger)
  shared/
    result/          Result<T,E> + combinators
    errors/          DomainError union, HTTP error mapper
    config/          env schema + typed ConfigService
    dynamodb/        DocumentClient provider
    cache/           Redis and no-op adapters of the Cache port, read-through helper
    http/            filters, interceptors (logging w/ redaction), result-to-response helper
  modules/
    products/ customers/ transactions/ deliveries/ payment-config/ reports/
      domain/            entities, value objects — pure TS
      application/
        ports/           *.port.ts  (interface + injection token)
        use-cases/       *.use-case.ts
      infrastructure/
        http/            *.controller.ts, dto/
        persistence/     dynamodb-*.repository.ts, mappers
        gateway/         (transactions only) payment gateway HTTP adapter
      <name>.module.ts
  seed/                seed + create-tables scripts, dummy products, optional seed Lambda handler
```

## Rules

1. Dependency direction: `infrastructure → application → domain`. `domain/` and `application/`
   import nothing from `@nestjs/*` (except `@Injectable`/`@Inject` in use cases), `@aws-sdk/*` or HTTP clients.
2. A use case = one class, one public `execute(input): Promise<Result<Output, DomainError>>`.
   Compose steps with `andThen`; no `throw`, no `try/catch` for expected failures.
3. Ports return `Result`. Adapters catch SDK/HTTP exceptions and convert them to `err(...)`.
4. Controllers: parse DTO → call use case → `match` result to HTTP. Nothing else.
5. DTOs validate shape (`class-validator`, global `ValidationPipe` with `whitelist`,
   `forbidNonWhitelisted`, `transform`). Business validation lives in domain/use cases.
6. Cross-module access goes through the other module's exported port, never its repository class.
7. Every endpoint has Swagger decorators; `api.md` is updated in the same PR.
8. Logs never contain card tokens, emails, phones or secrets (redaction interceptor).

## Use case shape (canonical)

```ts
execute(input: CreateTransactionInput): Promise<Result<TransactionView, DomainError>> {
  return fromResult(Quantity.create(input.quantity))
    .andThen((qty) => this.products.findById(input.productId).andThen((p) => p.ensureAvailable(qty)).map((p) => ({ p, qty })))
    .andThen(({ p, qty }) => Transaction.createPending(p, qty, this.fees, this.ids))
    .andThen((tx) => this.customers.upsert(input.customer).map(() => tx))
    .andThen((tx) => this.transactions.create(tx))
    .andThen((tx) => this.chargeAndResolve(tx, input))
    .map(toTransactionView);
}
```

## Commands (from repo root, once scaffolded)

`npm run dev -w apps/api` · `npm run test -w apps/api` · `npm run test:cov -w apps/api` ·
`npm run tables:create -w apps/api` · `npm run seed -w apps/api` · `docker compose up -d dynamodb redis` (local DB and cache)
