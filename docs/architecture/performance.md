---
layer: L1
component: system
read-when: running or changing the load tests, or reasoning about latency and capacity
---

# Performance and load tests

Scripts in `load-tests/` (k6). They drive a **fixed arrival rate**, so two runs send the same
traffic whatever the response time — a slow system shows up as latency and dropped iterations,
not as fewer requests.

## How to run

```bash
./load-tests/run.sh browse             # read traffic, Redis on
CACHE=off ./load-tests/run.sh browse   # same traffic, no cache
./load-tests/run.sh checkout           # purchases end to end
```

`run.sh` starts DynamoDB Local and Redis, builds the API, seeds its own `load-*` tables, starts
a local stand-in for the payment gateway (150 ms of simulated latency) and runs k6 from its
Docker image. Tunables: `STEADY_RPS`, `PEAK_RPS`, `STEADY_DURATION`, `SPIKE_DURATION`,
`CHECKOUT_RPS`, `CHECKOUT_PEAK_RPS`, `GATEWAY_DELAY_MS`. Raw results: `load-tests/results/*.json`.

Never point these scripts at the gateway sandbox, and not at the deployed stack without raising
its rate limit on purpose: it answers 429 after 60 requests per minute and address.

## Scenarios

| Script | Traffic | Stages |
|---|---|---|
| `browse.js` | 45 % catalogue page · 15 % search · 20 % product · 10 % stock · 10 % sales report | 15 s warm-up → 60 s at 200 req/s → 20 s spike at 800 req/s → 20 s recovery at 200 req/s |
| `checkout.js` | per purchase: payment config → pay → read transaction → catalogue | 45 s at 20 purchases/s → 15 s spike at 60 purchases/s |

Thresholds (the run fails if crossed): errors < 1 %, read p95 < 300 ms and p99 < 800 ms,
payment p95 < 1.5 s, fewer than 50 dropped iterations.

## Results (2026-10-13)

One Node 26 process, DynamoDB Local (in memory), Redis 7.4, k6 2.3 — all on one laptop
(Ryzen AI 9 HX 370, 24 threads). 18 products and 2,509 stored transactions.

**Read traffic, 200 → 800 → 200 req/s**

| | Without cache | With Redis |
|---|---|---|
| Requests answered | 30,613 | 38,650 |
| Requests the system could not take (dropped) | 8,037 | 0 |
| Errors | 0 | 0 |
| p95 / p99, whole run | 5.27 s / 10.34 s | 5.4 ms / 9.4 ms |
| p95 steady (200 req/s) | 79 ms | 4.1 ms |
| p95 during the spike (800 req/s) | 9.53 s | 7.2 ms |
| p95 after the spike | 4.87 s | 3.4 ms |

With Redis, by endpoint (p95 / p99): catalogue 4.3 / 7.7 ms · search 4.3 / 7.4 ms ·
product 5.6 / 11.0 ms · stock 5.9 / 11.1 ms · report 8.1 / 12.0 ms. Slowest request: 102 ms.

**Purchases, 20 → 60 per second** — 2,509 purchases, 10,037 requests, no errors.

| Request | p95 | p99 | Of which simulated gateway |
|---|---|---|---|
| Pay (`POST /transactions`) | 166 ms | 170 ms | 150 ms |
| Payment configuration | 153 ms | 154 ms | 150 ms |
| Read transaction | 2.2 ms | 3.1 ms | — |
| Catalogue after paying | 3.0 ms | 4.2 ms | — |

p95 of the whole purchase during the spike: 159 ms (164 ms at the steady rate).

## Reading the numbers

- Without the cache the limit is the sales report: every request scans the transactions table,
  and at 80 of those per second the scans queue behind each other and delay everything else on
  the same process. The spike is not absorbed and the backlog outlives it (recovery p95 4.9 s).
- With Redis the same scan runs at most once every 30 s per range, and the catalogue at most
  once a minute. The spike costs 3 ms of p95.
- The API adds about 10–15 ms to a payment; the rest is the gateway. Approvals invalidate the
  catalogue on every purchase and it still answers in 3 ms.
- These are single-machine numbers against an emulator: they show the shape (what saturates,
  what the cache removes), not production latency. In AWS each DynamoDB call adds network time,
  Lambda adds cold starts and scales out per request, and the scan costs read capacity.

## Known limits

- The report scan grows with the table; past a few thousand transactions it needs an index by
  day (`backend/data-model.md`).
- When a cached entry expires under load, several requests may reload it at once.
- The rate limiter counts per instance, not across Lambda instances.
