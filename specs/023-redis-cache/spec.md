# Spec 023 — Redis cache for catalogue and reports

- Status: Done
- Component(s): backend, infra
- Branch: `feat/023-redis-cache`
- Traces to: FR-01, FR-12, NFR-02, NFR-05
- Context to load: `docs/components/backend/CONTEXT.md`, `caching.md`, `data-model.md`, `../infra/CONTEXT.md`
- Plan and tasks: folded into this file

## 1. Why

The two heaviest reads — the catalogue and the sales summary — scan a whole table on every
request. Both change rarely compared with how often they are read, so a shared cache removes most
of that work and keeps response times flat under load.

## 2. Scope

**In:**
- A cache in front of the catalogue read and the sales-records read, stored in Redis.
- Catalogue entries are dropped as soon as an approved payment changes stock.
- Redis is optional: without it the API behaves exactly as before.
- A configurable global rate limit, so the API can be load-tested from one address.
- Local Redis in `docker-compose`; an optional Redis URL for the deployed Lambda.

**Out:**
- Caching single products, stock, transactions, customers, deliveries or the payment configuration.
- Provisioning Redis in AWS (a VPC cache needs a NAT gateway — infra rule 5; see ADR-0013).
- Moving the rate limiter's counters to Redis.

## 3. Behaviour

With `REDIS_URL` set, the first catalogue request reads the database and stores the result; the
following ones are answered from Redis until the entry expires (60 s by default) or a payment is
approved, whichever comes first. The sales summary works the same way with a shorter life (30 s)
and no invalidation, so a report may lag an approval by up to that time.

Responses are identical with and without the cache. A cache that is slow, unreachable or holds
something unreadable is ignored: the request is served from the database and never fails because
of Redis.

## 4. Acceptance criteria

- **AC-1** — Given an empty cache, when the catalogue is read twice, then the database is read
  once and both answers are equal.
- **AC-2** — Given a cached catalogue, when a payment is approved and stock is written, then the
  next catalogue read comes from the database and shows the new stock. A payment that does not
  change stock (declined, already resolved, sold out) invalidates nothing.
- **AC-3** — Given a failing database read, then the error is returned and nothing is cached.
- **AC-4** — Given a cached sales read for a range, when the same range is requested within its
  life, then the database is not read again; another range is read separately.
- **AC-5** — Given Redis is down, times out or returns an unreadable entry, then reads fall back
  to the database, writes and invalidations are skipped, and no request fails.
- **AC-6** — Given no `REDIS_URL`, then nothing is cached and no connection is attempted.
- **AC-7** — Given the configuration, then `REDIS_URL` must be a `redis://` or `rediss://` URL,
  the two lifetimes are integers from 1 to 3600 seconds and the rate limit an integer from 1 to
  100000; `REDIS_URL` may come from an SSM parameter like the gateway secrets.
- **AC-8** — Given a deployment with `REDIS_URL_PARAM`, then the Lambda receives the parameter
  name and may read only that parameter; without it nothing changes.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Two instances, one approves a payment | the shared entry is deleted, both read fresh data |
| Seed re-run while cached | stock is stale for at most the catalogue lifetime |
| Invalidation fails (Redis down) | the payment still succeeds; the entry expires on its own |
| Redis URL with a password | never logged; errors log the error name only |

## 6. Contract changes

No endpoint or payload changes. New optional environment variables: `REDIS_URL`
(or `REDIS_URL_PARAM`), `CACHE_TTL_CATALOGUE_SECONDS` (60), `CACHE_TTL_REPORTS_SECONDS` (30),
`RATE_LIMIT_PER_MINUTE` (60). New optional deploy variable: `REDIS_URL_PARAM`.

## 7. Design

| Layer | Change |
|---|---|
| shared | `Cache` port (text values, never rejects) with a Redis adapter and a no-op adapter |
| products | repository decorator caching the full catalogue; port to invalidate it |
| reports | sales-records decorator caching by range start |
| transactions | repository decorator that invalidates the catalogue after an applied approval |
| infra | optional `REDIS_URL_PARAM` on the Lambda with read access to that one parameter |

Use cases are untouched: caching lives entirely in adapters behind the existing ports.
