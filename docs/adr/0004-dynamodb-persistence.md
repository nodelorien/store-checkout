# ADR-0004: DynamoDB as the database

- Status: Accepted
- Date: 2026-10-09
- Drivers: NFR-04, NFR-08, BR-04, BR-05

## Context

The brief recommends PostgreSQL or DynamoDB and deployment on the AWS free tier. The API must
call an external gateway on the public internet. Access patterns are all by primary key plus one
small list (products). The deadline is one day.

## Decision

DynamoDB, on-demand billing, **one table per aggregate** (`products`, `customers`,
`transactions`, `deliveries`). Access through AWS SDK v3 `DynamoDBDocumentClient` inside
repository adapters. Multi-item invariants use `TransactWriteItems` with condition expressions
(stock ≥ quantity, status = PENDING). Local development uses DynamoDB Local in Docker.

## Consequences

- Positive: always-free tier, no VPC, so Lambda keeps internet access without a NAT gateway.
- Positive: conditional writes give atomic stock control and idempotent resolution without locks.
- Positive: infra is a few CDK lines; no migrations.
- Negative: no joins or ad-hoc queries; every new access pattern needs a key or GSI (`data-model.md`).
- Negative: no ORM; mapping is manual (kept in adapter mappers, which is where hexagonal wants it anyway).

## Alternatives rejected

- PostgreSQL on RDS + Lambda — Lambda must join the VPC and then needs a NAT gateway (paid) to
  reach the payment gateway; or RDS must be public (bad practice).
- PostgreSQL on RDS + ECS/EC2 — works, but more infrastructure to build, patch and pay for in one day.
- Single-table design — optimal at scale, harder to read for evaluators; four small tables are clearer.
