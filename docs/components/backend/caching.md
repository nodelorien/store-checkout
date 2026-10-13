---
layer: L3
component: backend
read-when: touching the cache, its keys or lifetimes, or adding a cached read
---

# Caching (Redis)

Cache-aside in front of the two reads that scan a whole table. Decision and trade-offs: ADR-0013.

## What is cached

| Read | Key | Life | Invalidated |
|---|---|---|---|
| Full catalogue (`ProductRepository.findAll`) | `catalogue:<products table>` | `CACHE_TTL_CATALOGUE_SECONDS` (60) | when an approval write is applied |
| Sales records (`SalesRecordsPort.findCreatedSince`) | `sales:<transactions table>:<range start>` | `CACHE_TTL_REPORTS_SECONDS` (30) | never — expiry only |

Search, order and paging run in memory over the cached catalogue, so every catalogue query
shares one entry. The table name in the key lets several stages share one Redis.

**Never cached:** a single product or its stock (the check before a charge must read the store),
transactions, customers, deliveries, the payment configuration (its acceptance token is single-use).
Nothing personal reaches Redis: products are public and sales records carry no person or order ids.

## How it is built

```
ListProductsUseCase ─► PRODUCT_REPOSITORY ─► CachedProductRepository ─► DynamoDbProductRepository
                                                   │  ▲ invalidate()
                                                   ▼  │
                                                 CACHE │ (RedisCache | NoopCache)
                                                      │
ResolveTransactionUseCase ─► TRANSACTION_REPOSITORY ─► CatalogueInvalidatingTransactionRepository
                                                          └─► DynamoDbTransactionRepository
```

- `shared/ports/cache.port.ts` — `Cache`: `get` / `set(ttl)` / `delete` over text. **No method
  rejects**; a failed read is a miss. This is the one port that does not return `Result`: a cache
  failure is never an outcome a use case should handle.
- `shared/cache/` — `RedisCache` (ioredis), `NoopCache` (no `REDIS_URL`), `readThrough` helper.
- Decorators live in each module's `infrastructure/persistence` and are wired in the module with
  a factory. Use cases and ports of the domain are unchanged.
- `CATALOGUE_INVALIDATOR` (products, application port) is what the transactions module uses; it
  never sees a cache key.

## Failure behaviour

| Situation | Result |
|---|---|
| No `REDIS_URL` | `NoopCache`: no connection, nothing stored |
| Redis down or slower than 500 ms | miss → database; one warning per 30 s with the error name only |
| Entry is not valid JSON or not the expected shape | miss → database → overwritten |
| Database read fails | error returned, nothing stored |
| Invalidation fails | payment succeeds; the entry expires on its own |

The client does not queue commands while disconnected (`enableOfflineQueue: false`) and retries
the connection in the background, so an outage costs each request nothing but the miss.

## Adding a cached read

1. Only for a read that is expensive, shared between users and tolerant of the chosen staleness.
2. Write a decorator of the port next to the real adapter; use `readThrough`.
3. Decide the invalidation (an explicit hook, or expiry only) and document it in the table above.
4. Test with `test/fakes/in-memory-cache.ts`: hit, miss, failed read, unreadable entry.

## Local and deployed

- Local: `docker compose up -d redis` and `REDIS_URL=redis://localhost:6379`.
- Deployed: optional. Deploy variable `REDIS_URL_PARAM` names an SSM SecureString holding a
  `rediss://` URL; the Lambda reads it at cold start. See `../infra/CONTEXT.md`.
