# Database Schema — Production MCP Server Toolkit

**Version:** 1.0  
**Last updated:** 2026-04-19

---

## v1.0 — No Persistent Database

The v1.0 local deployment has no database. All state is either:
- **In-process memory** — response cache (`node-cache`), rate limiter token buckets
- **Stateless** — every tool call is independently fulfilled from external APIs

State is ephemeral: the cache and rate limiter reset on process restart. This is acceptable for single-user local deployments.

---

## v1.0 Runtime State (In-Memory)

### Response Cache

Managed by `node-cache`. Stored in-process as a hash map.

```
Key format:    {domain}:{tool_name}:{sha256(JSON.stringify(input))}
Value:         serialized tool response (JSON)
TTL:           per-domain, per-tool (see TDD.md §7)
Max keys:      1,000 (LRU eviction)
```

### Rate Limiter State

One token bucket per domain, stored in-process.

```
{
  domain: string             // "financial" | "web3" | "devtools" | "healthcare"
  tokens: number             // current available tokens
  max_tokens: number         // bucket capacity
  refill_rate: number        // tokens added per second
  last_refill_at: number     // unix timestamp ms
}
```

---

## v2.0 — Hosted API Mode (Planned)

When deployed as a hosted API with Stripe billing and multi-user support, the following schema applies. Target database: **PostgreSQL** (via Prisma ORM).

---

### Table: `users`

Stores API consumers registered via the hosted web portal.

```sql
CREATE TABLE users (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255)  NOT NULL UNIQUE,
  name          VARCHAR(255),
  stripe_id     VARCHAR(255)  UNIQUE,           -- Stripe customer ID
  plan          VARCHAR(50)   NOT NULL DEFAULT 'free',  -- free | pro | enterprise
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_id ON users(stripe_id);
```

**Plans:**

| Plan | Daily call limit | Rate limit |
|------|-----------------|-----------|
| free | 100 | 10 req/min |
| pro | 10,000 | 200 req/min |
| enterprise | unlimited | custom |

---

### Table: `api_keys`

Each user can have multiple API keys (rotate without downtime).

```sql
CREATE TABLE api_keys (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash      VARCHAR(64)   NOT NULL UNIQUE,  -- SHA-256 of raw key; raw key never stored
  key_prefix    VARCHAR(10)   NOT NULL,          -- first 8 chars of raw key for display
  name          VARCHAR(255),                    -- user-assigned label (e.g. "Claude Desktop")
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,                     -- NULL = no expiry
  revoked_at    TIMESTAMPTZ,                     -- NULL = active
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
```

**Key generation:** Raw key = `mcp_` + 32 random bytes (base58). Stored as SHA-256 hash. Key shown to user once at creation.

---

### Table: `usage_logs`

Append-only log of every tool call. Used for billing, rate limiting, and analytics.

```sql
CREATE TABLE usage_logs (
  id            BIGSERIAL     PRIMARY KEY,
  user_id       UUID          NOT NULL REFERENCES users(id),
  api_key_id    UUID          REFERENCES api_keys(id),
  domain        VARCHAR(50)   NOT NULL,          -- financial | web3 | devtools | healthcare
  tool          VARCHAR(100)  NOT NULL,
  input_hash    VARCHAR(16),                     -- first 16 chars of input SHA-256 (no raw input stored)
  status        VARCHAR(20)   NOT NULL,          -- success | error | rate_limited | auth_error
  latency_ms    INT,
  cache_hit     BOOLEAN       NOT NULL DEFAULT false,
  error_code    VARCHAR(50),
  called_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_called_at ON usage_logs(called_at);
CREATE INDEX idx_usage_logs_domain_tool ON usage_logs(domain, tool);

-- Partition by month for large-scale deployments
-- (implement once volume exceeds 10M rows)
```

---

### Table: `rate_limit_windows`

Distributed rate limit counters — replaces in-process token bucket when running multiple server instances.

```sql
CREATE TABLE rate_limit_windows (
  user_id       UUID          NOT NULL REFERENCES users(id),
  domain        VARCHAR(50)   NOT NULL,
  window_start  TIMESTAMPTZ   NOT NULL,
  call_count    INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, domain, window_start)
);

CREATE INDEX idx_rate_limit_windows_lookup
  ON rate_limit_windows(user_id, domain, window_start DESC);
```

**Window resolution:** 1-minute rolling window. Old windows purged by a nightly cron.

---

### Table: `stripe_events`

Idempotent log of Stripe webhook events to prevent double-processing.

```sql
CREATE TABLE stripe_events (
  stripe_event_id  VARCHAR(255)  PRIMARY KEY,   -- Stripe's event ID (evt_...)
  event_type       VARCHAR(100)  NOT NULL,
  processed_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  payload          JSONB         NOT NULL
);
```

---

## Redis (v1.0 and v2.0)

Redis is used for distributed caching in v2.0 (hosted API). In v1.0, `node-cache` (in-process) is used instead — no Redis dependency for local installs.

### Cache Key Conventions (v2.0)

```
mcp:cache:{domain}:{tool}:{input_hash}  TTL: per-domain (see TDD §7)
mcp:rl:{user_id}:{domain}:{window}      TTL: 120s (2x window size for safety)
mcp:health:{domain}                     TTL: 10s (domain health check cache)
```

---

## Migration Strategy (v1.0 → v2.0)

When adding the hosted API:

1. Add Prisma with PostgreSQL connection string in `.env`
2. Run `prisma migrate dev --name init` to create all tables
3. Replace `node-cache` with Redis adapter in `shared/cache.ts` (behind an interface — no domain code changes required)
4. Replace in-process rate limiter with Redis-backed implementation (same interface)
5. Add `api_keys` auth flow alongside existing JWT flow — both valid during transition
