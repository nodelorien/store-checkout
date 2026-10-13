# Spec 024 — Integration tests, load tests and README

- Status: Done
- Component(s): backend, infra, docs
- Branch: `feat/024-integration-and-load-tests`
- Traces to: NFR-03, NFR-09, NFR-10, FR-13
- Context to load: `docs/components/backend/testing.md`, `caching.md`, `docs/architecture/performance.md`
- Plan and tasks: folded into this file

## 1. Why

Unit tests prove each piece against fakes. Nothing yet proved the pieces together against a real
database and cache, or showed how the API behaves when traffic rises. The README also had to
present the project the way a public repository does.

## 2. Scope

**In:**
- Integration tests: the whole API over HTTP against DynamoDB Local, Redis and a local stand-in
  for the payment gateway. Run on demand and in CI; not part of the coverage gate.
- Load tests (k6): read traffic with a spike, and purchases end to end; results recorded.
- README rewritten: sections by topic, screenshots, architecture diagrams, testing, cache, load.

**Out:**
- Load against the deployed stack or the gateway sandbox (third-party and shared resources).
- Browser end-to-end tests in the repository.
- Performance budgets enforced in CI (the thresholds live in the scripts; runs are manual).

## 3. Behaviour

`npm run test:integration` needs `docker compose up -d dynamodb redis`; without them it fails
at once naming the missing service. Every run creates its own tables and removes them.

`./load-tests/run.sh <browse|checkout>` builds the API, prepares a throwaway local stack and runs
the script; `CACHE=off` runs the same traffic without Redis. The gateway is always the stand-in.

## 4. Acceptance criteria

- **AC-1** — An approved purchase writes transaction, stock and delivery together and charges the
  gateway once with the server-side total; a declined one changes nothing but the transaction.
- **AC-2** — Two simultaneous purchases of the last unit end with exactly one approval and stock 0.
- **AC-3** — A repeated `Idempotency-Key` charges once; a purchase beyond stock charges nothing.
- **AC-4** — The catalogue is served from Redis, is refreshed by an approval and kept by a decline;
  the single-product stock is never served from the cache.
- **AC-5** — A gateway rejection or outage leaves an `ERROR` transaction and the stock unchanged.
- **AC-6** — The sales summary reflects stored transactions and contains no personal data.
- **AC-7** — The Redis adapter stores, expires and deletes against a real server, and answers a
  miss in under a second when the server is unreachable.
- **AC-8** — The load scripts report p95 and p99 per endpoint and per stage (steady, spike,
  recovery) and fail when a threshold is crossed.

## 5. Contract changes

None for the API. New scripts: `npm run test:integration`, `npm run test:load -- <script>`.
CI gains an `integration` job.
