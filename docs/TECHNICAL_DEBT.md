# Technical Debt Log — Production MCP Server Toolkit

**Last updated:** 2026-04-19

Items are prioritized as: **High** (blocking scale/security), **Medium** (causes friction), **Low** (nice to fix eventually).

---

## Active Items

### TD-001 — In-process cache not shared across HTTP server instances

**Priority:** Medium  
**Introduced in:** v1.0  
**Category:** Architecture

**Description:** `node-cache` stores response data in-process memory. If multiple Node.js processes serve the HTTP transport (e.g., PM2 cluster mode, or horizontal scaling), each process has its own cache. The same upstream API call may be made by N processes within a TTL window.

**Impact:** Increased upstream API usage. Free-tier quotas exhausted faster. No correctness issue — data is still valid.

**Fix:** Replace `shared/cache.ts` internals with Redis (`ioredis`). The cache interface is already abstracted; domain code needs no changes.

**When to fix:** Before enabling PM2 cluster mode or running more than 1 server instance.

---

### TD-002 — Rate limiter state is per-process

**Priority:** High (if scaling horizontally)  
**Introduced in:** v1.0  
**Category:** Architecture

**Description:** Token bucket rate limiters in `shared/rate-limiter.ts` are in-process. Two server instances could each allow 24 Alpha Vantage calls/day, effectively doubling the rate limit.

**Impact:** Upstream API rate limits breached if multiple instances are deployed. Could exhaust paid API tiers unexpectedly.

**Fix:** Move rate limit state to Redis. Use `ioredis` + atomic Lua script for token bucket. Same fix path as TD-001.

**When to fix:** Before deploying more than 1 server instance. Currently safe for single-process v1.0.

---

### TD-003 — FHIR healthcare domain uses public sandbox, not production

**Priority:** Medium  
**Introduced in:** v1.0  
**Category:** Feature completeness

**Description:** Healthcare tools connect to `hapi.fhir.org/baseR4` (public sandbox with synthetic data). The domain is a reference implementation, not production-ready for real clinical use.

**Impact:** Useful for prototyping and demos. Cannot be used with real patient data without replacing the client and adding SMART on FHIR OAuth.

**What's needed for production:**
- OAuth 2.0 SMART on FHIR token flow in `healthcare/client.ts`
- Replace sandbox URL with EHR vendor endpoint (`FHIR_BASE_URL`)
- BAA with EHR vendor
- PHI handling policy review

**When to fix:** When a user requests production FHIR support. Tracked as v1.1 item.

---

### TD-004 — Alpha Vantage free tier dependency in financial domain

**Priority:** Medium  
**Introduced in:** v1.0  
**Category:** Reliability

**Description:** The financial domain defaults to Alpha Vantage's free tier (25 calls/day). A demo session of 10–15 tool calls exhausts half the daily quota.

**Impact:** Financial tools silently degrade mid-demo if quota is hit. Rate limit warning in tool response mitigates but doesn't prevent.

**Fix options:**
- Document premium key requirement for sustained use (already in `ENV_CONFIG.md`)
- Add Yahoo Finance as a fallback data source (no API key required, but unofficial/fragile)
- Add Polygon.io as an optional alternative (more generous free tier)

**When to fix:** If demo failures become frequent. Yahoo Finance fallback is a quick v1.1 addition.

---

### TD-005 — No NFT wash trade detection

**Priority:** Low  
**Introduced in:** v1.0 (deliberately deferred)  
**Category:** Feature completeness

**Description:** `get_nft_recent_sales` returns raw sales data without filtering suspected wash trades (circular sales between related wallets to inflate volume/floor).

**Impact:** Analysis based on recent sales may be misleading for collections with high wash trade activity.

**Fix:** Add wash trade detection signal to sales data (flag transactions where buyer/seller share wallet clusters or where NFT was sold multiple times at identical prices within a short window).

**When to fix:** v1.1. High value for NFT analysts; deferred to keep v1.0 scope tight.

---

### TD-006 — No Infura fallback for Alchemy RPC

**Priority:** Low  
**Introduced in:** v1.0  
**Category:** Reliability

**Description:** Web3 domain uses Alchemy as the sole RPC provider. Alchemy downtime (rare but possible) takes down all Web3 tools.

**Impact:** During Alchemy outages, all Web3 tools return `UPSTREAM_ERROR`. Alchemy has strong SLA but not 100% uptime.

**Fix:** Add Infura as a secondary RPC in `web3/clients/alchemy.ts`. Failover automatically on connection error.

**When to fix:** v1.1. Low priority — Alchemy is rarely down.

---

### TD-007 — JWT passed via MCP `_meta` field (unofficial pattern)

**Priority:** Low  
**Introduced in:** v1.0  
**Category:** Standards compliance

**Description:** MCP protocol does not have a native authentication mechanism in the v1.0 spec. We pass the JWT via `_meta.authorization` in tool call requests. This is a pragmatic workaround, not a standards-compliant auth flow.

**Impact:** Works correctly with Claude Desktop and custom agents. May break with future MCP clients that strip or validate `_meta` fields strictly.

**Fix:** When the MCP spec adds native auth (in progress in the MCP working group), migrate to the official mechanism.

**When to fix:** When MCP native auth is standardized. Monitor the spec at modelcontextprotocol.io.

---

### TD-008 — No per-tool RBAC (all auth tokens have full access)

**Priority:** Low  
**Introduced in:** v1.0 (deliberately deferred — in non-goals)  
**Category:** Feature completeness

**Description:** A valid JWT grants access to all tools across all active domains. There is no way to issue a token that can only call financial tools, or that can call devtools but not healthcare.

**Impact:** Acceptable for v1.0 (single-user or fully trusted clients). Would be a gap for enterprise deployments with multiple teams with different data access requirements.

**Fix:** Add `scope` claim to JWT (`"scope": "financial,devtools"`). Auth middleware checks tool's domain against token scope.

**When to fix:** v2.0 (hosted API with multi-tenant support).

---

## Resolved Items

*(Items are moved here once the fix is merged and released.)*

| ID | Issue | Fixed in | Notes |
|----|-------|----------|-------|
| — | — | — | — |

---

## Debt Evaluation Criteria

When deciding whether to add a new debt item:

- **Is it a correctness issue?** → Fix now, don't log as debt
- **Does it create a security risk?** → Fix now (or immediately if it's already in prod)
- **Does it block a documented v1.1 feature?** → High priority
- **Is it a known limitation that's documented?** → Log as debt at appropriate priority, document in README/ENV_CONFIG
- **Is it purely cosmetic?** → Not worth logging; just fix it if it takes < 30 minutes
