# ADR-006 — Use `node-cache` for v1.0 (defer Redis to v2.0)

**Date:** 2026-04-19  
**Status:** Accepted

---

## Context

Tool responses from external APIs (stock quotes, NFT floors, GitHub stats) should be cached to reduce API call volume and latency. Options for the cache backend:

1. **`node-cache`** — in-process LRU + TTL cache; no external dependencies
2. **Redis** — external in-memory store; requires a running Redis instance; supports distributed caching

---

## Decision

Use `node-cache` for v1.0. Migrate to Redis in v2.0 when the hosted API requires distributed caching across multiple processes.

---

## Reasoning

**Zero-dependency install is essential for v1.0:**
The target user installs via `npx mcp-suite`. If the server requires Redis, every user must install and run Redis before they can start. This destroys the "10-minute install" goal. `node-cache` requires nothing.

**v1.0 is single-process:**
stdio transport spawns one server process per Claude Desktop session. One process can cache in-process without coordination. The case for Redis (shared state across processes) simply doesn't exist in v1.0.

**Interface-abstracted:**
`shared/cache.ts` exports a cache interface (`get`, `set`, `del`). Domain code calls `cache.get(key)`, not `nodeCache.get(key)`. Swapping the implementation to Redis in v2.0 requires changing only `shared/cache.ts` — zero domain code changes.

```typescript
// shared/cache.ts — the interface domains depend on
export interface Cache {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, ttlSeconds: number): void
  del(key: string): void
}
```

---

## Trade-offs

- **Cache not shared across processes** — if PM2 cluster mode or horizontal scaling is used, each process has its own cache. This causes extra upstream API calls and may exhaust rate limits faster. This is documented as **TD-001** and **TD-002** in `TECHNICAL_DEBT.md`.
- **In-process memory pressure** — 1,000 cached items cap (LRU eviction) prevents unbounded memory growth. Acceptable given typical tool call volumes.

---

## Migration Path to Redis (v2.0)

1. Add `ioredis` dependency
2. Implement `RedisCache` class satisfying the `Cache` interface in `shared/cache.ts`
3. In `config.ts`, check for `REDIS_URL` env var — if present, use `RedisCache`; otherwise fall back to `NodeCache`
4. No changes needed in any domain module

---

## Consequences

- `node-cache` is a dependency in `package.json`
- `shared/cache.ts` exports a `Cache` interface and a factory function
- The cache implementation is invisible to domain modules
- Redis support is a v2.0 item tracked in `CHANGELOG.md` and `TECHNICAL_DEBT.md`
