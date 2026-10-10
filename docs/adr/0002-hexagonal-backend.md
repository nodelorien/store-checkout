# ADR-0002: Hexagonal architecture on NestJS

- Status: Accepted
- Date: 2026-10-09
- Drivers: NFR-02 (and 10 bonus points)

## Context

Business logic must not live in controllers. The brief explicitly rewards hexagonal
architecture with ports and adapters. NestJS modules and DI make it cheap.

## Decision

Each bounded module (`products`, `customers`, `transactions`, `deliveries`) has three layers:

```
domain/           entities, value objects, domain errors — pure TS, zero imports from Nest/AWS
application/      use cases + ports (interfaces + DI tokens)
infrastructure/   adapters: http (controllers, DTOs), persistence (DynamoDB), gateway (HTTP client)
```

Dependency rule: `infrastructure → application → domain`. Never the reverse. Ports are
TypeScript interfaces bound with `Symbol` injection tokens; Nest modules wire adapters to ports.
Use cases are plain classes; `@Injectable()` is the only framework decorator allowed outside
`infrastructure/`.

## Consequences

- Positive: use cases are unit-tested with in-memory fakes — fast path to >80% coverage.
- Positive: swapping DynamoDB or the gateway touches one adapter.
- Negative: more files per feature (port + adapter + mapper).
- Enforced by an ESLint import-boundary rule and the reviewer checklist.

## Alternatives rejected

- Classic Nest layered services — business logic leaks into services coupled to the ORM/SDK.
- Full DDD/CQRS (`@nestjs/cqrs`) — ceremony out of proportion for four aggregates.
