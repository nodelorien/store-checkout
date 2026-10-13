# ADR-0013: Optional Redis cache-aside for scanned reads

- Status: Accepted
- Date: 2026-10-13
- Drivers: FR-01, NFR-02, infra rule 5 (no paid network resources)

## Context

The catalogue and the sales summary each scan a whole DynamoDB table per request (ADR-0004,
`data-model.md`). They are read far more often than they change, and they are the two requests
whose latency grows with data and with concurrency. The API runs on Lambda outside a VPC
(ADR-0008), and the infra rules forbid paid network resources without a decision record.

## Decision

Add a cache-aside layer in Redis, behind a `Cache` port, applied by decorating the two outbound
ports that scan. Use cases do not know it exists.

- The catalogue entry lives 60 s and is deleted when an approval write changes stock.
- Sales records live 30 s and are not invalidated.
- The cache is optional and fail-open: without `REDIS_URL`, or with Redis unreachable, every
  read goes to DynamoDB and no request fails.
- The stack does not provision Redis. A deployment may point at any Redis reachable over TLS by
  storing its URL in an SSM SecureString (`REDIS_URL_PARAM`).

## Consequences

- Catalogue reads cost one Redis `GET` instead of a table scan; see the load test results.
- A report may lag an approval by up to 30 s; a re-seed may lag by up to 60 s.
- One more moving part locally (`docker compose up redis`) and one optional secret in AWS.
- The rate limiter still counts per instance; moving it to Redis is a possible follow-up.

## Alternatives rejected

| Option | Why not |
|---|---|
| In-process memory cache | Each Lambda instance would hold its own copy: no shared invalidation, so one instance could show stock another has already sold |
| ElastiCache in the stack | Needs the Lambda in a VPC, and then a NAT gateway (or endpoints) to reach the payment gateway and SSM — a fixed monthly cost for an assessment stack |
| DynamoDB DAX | Same VPC requirement; caches items, not the aggregated read |
| CloudFront caching of `/api/v1/products` | Cannot be invalidated per approval cheaply; stock would be stale for every viewer |
| Cache in the use case | Mixes an infrastructure concern into application code (ADR-0002) |
