# Technical Design Document — Production MCP Server Toolkit

**Version:** 1.0  
**Status:** Active  
**Last updated:** 2026-04-19

---

## 1. Overview

The Production MCP Server Toolkit is a TypeScript MCP server that exposes structured AI tool access to multiple data domains: financial markets, Web3/DeFi, developer tooling, and healthcare (FHIR). It is designed to be installable in under 10 minutes, secure by default, and extensible by third parties.

This document covers architecture decisions, system components, data flow, and the reasoning behind major technical choices.

---

## 2. Goals & Constraints

### Goals
- Single installable package (`npx mcp-suite`) that works with Claude Desktop, Cursor, Windsurf, and custom agents
- Authentication enabled by default — deployable in enterprise environments without modification
- Domain isolation — missing API keys disable one domain, not the whole server
- Extensible — new domains can be added by following a documented pattern

### Constraints
- Must support both stdio (local agent) and HTTP+SSE (remote agent) transports
- No real PHI — healthcare domain uses public FHIR sandbox with synthetic data only
- v1.0 scope: no database, no multi-tenancy, no per-user RBAC
- TypeScript only — no Python or polyglot build pipeline

---

## 3. System Architecture

### 3.1 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Clients                             │
│     Claude Desktop    Cursor    Windsurf    Custom Agent SDK    │
└───────────────────────────┬─────────────────────────────────────┘
                            │  MCP Protocol
              ┌─────────────▼─────────────┐
              │      Transport Layer       │
              │   stdio  │  HTTP + SSE     │
              └─────────────┬─────────────┘
                            │
              ┌─────────────▼─────────────┐
              │      Auth Middleware        │
              │  JWT validation / bypass    │
              └─────────────┬─────────────┘
                            │
              ┌─────────────▼─────────────┐
              │       Tool Registry        │
              │  Register / list / route   │
              └──┬──────┬──────┬──────┬───┘
                 │      │      │      │
         ┌───────▼─┐ ┌──▼───┐ ┌▼────┐ ┌▼──────────┐
         │Financial│ │Web3  │ │Dev  │ │Healthcare  │
         │ Domain  │ │Domain│ │Tools│ │(FHIR)      │
         └────┬────┘ └──┬───┘ └──┬──┘ └─────┬──────┘
              │         │        │           │
         ┌────▼─────────▼────────▼───────────▼────┐
         │           Shared Infrastructure          │
         │   Rate Limiter · Cache · Logger · Errors │
         └──────────────────────────────────────────┘
              │         │        │           │
    Alpha   Alchemy  GitHub    HAPI FHIR
    Vantage  OpenSea  API      Sandbox
    CoinGecko Blur
```

### 3.2 Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **Transport Layer** | Abstracts stdio vs HTTP+SSE; exposes a uniform interface to the tool registry |
| **Auth Middleware** | Validates JWT on every tool invocation; can be bypassed with `AUTH_DISABLED=true` in dev |
| **Tool Registry** | Maintains a map of tool name → handler; routes incoming MCP tool calls to the correct domain; produces the tool list for `list-tools` MCP response |
| **Domain Modules** | Self-contained modules that register tools, define Zod schemas, and call external APIs |
| **Rate Limiter** | Token-bucket per domain; prevents runaway API calls against free-tier external services |
| **Response Cache** | LRU + TTL in-memory cache (node-cache); keyed by `domain:tool:inputHash` |
| **Logger** | Structured JSON output; records tool name, domain, latency, status on every call |
| **Error Classes** | Typed domain errors (AuthError, DomainUnavailableError, UpstreamError, ValidationError); each maps to a consistent MCP error response |

---

## 4. Data Flow

### 4.1 Successful Tool Call (stdio transport)

```
1. Claude Desktop sends MCP call_tool request (JSON over stdin)
2. Transport layer deserializes the request
3. Auth middleware extracts JWT from request metadata → validates signature + expiry
4. Tool registry looks up handler by tool name
5. Handler validates input against Zod schema → throws ValidationError on failure
6. Cache check: if cache hit, return cached response immediately
7. Rate limiter: check token bucket for domain → reject if exhausted
8. Domain handler calls external API (e.g., Alpha Vantage)
9. Response validated against output Zod schema
10. Cache write: store response with domain-appropriate TTL
11. Logger records: timestamp, domain, tool, latency, status=success
12. Tool registry returns MCP tool_result response
13. Transport layer serializes and writes to stdout
```

### 4.2 Auth Failure Flow

```
1. MCP call received
2. Auth middleware: token missing → AuthError("Token required")
3. Tool registry returns MCP error response immediately
4. Logger records: status=auth_error, no upstream API call made
```

### 4.3 Domain Startup (partial config)

```
1. Server starts; reads env vars via config.ts (Zod-validated)
2. For each domain: check required API keys present
   - Present → domain registers its tools with the tool registry
   - Missing → domain logs a startup warning; skips tool registration
3. MCP server starts; tool list reflects only active domains
4. Claude Desktop's tool list shows only available tools — no failed tool calls
```

---

## 5. Domain Architecture

Each domain follows a consistent module pattern to enable independent development and safe extension.

### 5.1 Domain Module Interface

```typescript
// Every domain exports this shape
export interface Domain {
  name: string
  isAvailable: () => boolean        // checks required env vars
  registerTools: (server: McpServer) => void  // registers tools on startup
}
```

### 5.2 Domain File Structure

```
domains/[name]/
├── index.ts         // exports Domain object; calls registerTools
├── schemas.ts       // Zod input/output schemas for all tools
├── client.ts        // typed adapter for external API(s)
└── tools/
    └── [tool-name].ts  // one file per tool; imports schema + client
```

### 5.3 Tool File Pattern

```typescript
// domains/financial/tools/stock-quote.ts
import { z } from 'zod'
import { StockQuoteInputSchema, StockQuoteOutputSchema } from '../schemas'
import { financialClient } from '../client'
import { cache } from '../../shared/cache'
import { rateLimiter } from '../../shared/rate-limiter'
import { logger } from '../../shared/logger'

export const stockQuoteTool = {
  name: 'get_stock_quote',
  description: 'Returns current price, volume, and change % for a stock ticker.',
  inputSchema: StockQuoteInputSchema,
  handler: async (input: z.infer<typeof StockQuoteInputSchema>) => {
    const cacheKey = `financial:stock_quote:${input.ticker}`
    const cached = cache.get(cacheKey)
    if (cached) return cached

    await rateLimiter.consume('financial')
    const start = Date.now()
    const result = await financialClient.getQuote(input.ticker)
    const validated = StockQuoteOutputSchema.parse(result)

    cache.set(cacheKey, validated, 60)  // TTL: 60 seconds
    logger.info({ domain: 'financial', tool: 'get_stock_quote', latency: Date.now() - start })
    return validated
  }
}
```

---

## 6. Authentication Design

### 6.1 JWT Structure

```json
{
  "header": { "alg": "HS256", "typ": "JWT" },
  "payload": {
    "sub": "user-or-client-id",
    "iat": 1713484800,
    "exp": 1716076800,
    "scope": "mcp:tools"
  }
}
```

### 6.2 Middleware Behavior

| Condition | Action |
|-----------|--------|
| `AUTH_DISABLED=true` | Skip validation; log warning at startup |
| `MCP_JWT_SECRET` not set (prod mode) | Refuse to start; exit with error |
| No token in request | Return `AuthError: Token required` |
| Expired token | Return `AuthError: Token expired` |
| Wrong signature | Return `AuthError: Token signature invalid` |
| Valid token | Pass through to tool registry |

### 6.3 Token Placement in MCP Protocol

MCP doesn't have a native auth header. Token is passed via MCP request metadata:

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_stock_quote",
    "arguments": { "ticker": "NVDA" },
    "_meta": { "authorization": "Bearer <token>" }
  }
}
```

---

## 7. Caching Strategy

| Domain | Tool | TTL | Rationale |
|--------|------|-----|-----------|
| Financial | stock quote | 60s | Market data: 1-min lag acceptable for analysis use cases |
| Financial | forex rate | 30s | Forex moves faster than equities |
| Financial | crypto price | 15s | Crypto is higher-volatility; shorter TTL |
| Financial | market news | 300s | News doesn't change frequently; preserve API quota |
| Web3 | NFT floor | 30s | Floor prices shift on each sale but no need for tick-level accuracy |
| Web3 | wallet balances | 30s | Balances change per block (~12s on ETH); 30s is reasonable |
| Web3 | AMM reserves | 15s | DeFi pools update per block |
| Developer | repo stats | 300s | GitHub stats are cached on GitHub's side too |
| Developer | PR summary | 60s | PRs can be updated; but review is usually async |
| Developer | pipeline status | 30s | CI status should be near-real-time |
| Healthcare | FHIR queries | 60s | Sandbox data is static; cache to avoid hammering |

Cache is implemented with `node-cache` (in-memory, single process). No Redis dependency for v1 — acceptable for single-process local deployment. Redis cache is ADR-006.

---

## 8. Rate Limiting

Uses a token-bucket algorithm per domain. Configured to protect free-tier external API quotas.

| Domain | Limit | Window | Behavior on exhaust |
|--------|-------|--------|---------------------|
| Financial | 24 calls | 24 hours | Structured error with time-until-reset |
| Web3 | 100 calls | 1 minute | Structured error with retry-after |
| DevTools | 1,000 calls | 1 hour | GitHub rate limit pass-through |
| Healthcare | 60 calls | 1 minute | FHIR sandbox is generous; conservative limit |

---

## 9. Error Handling

All errors are typed and produce predictable MCP error responses. No raw exceptions escape to the MCP client.

```typescript
// shared/errors.ts

class AuthError extends McpError { code = 'AUTH_ERROR' }
class ValidationError extends McpError { code = 'VALIDATION_ERROR' }
class DomainUnavailableError extends McpError { code = 'DOMAIN_UNAVAILABLE' }
class UpstreamError extends McpError { code = 'UPSTREAM_ERROR' }
class RateLimitError extends McpError { code = 'RATE_LIMITED' }
```

Each error class carries a `userMessage` (safe to show the LLM) and an optional `debugMessage` (logged server-side, never sent to client).

---

## 10. Observability

Every tool call emits a structured JSON log line:

```json
{
  "ts": "2026-04-19T10:30:00.000Z",
  "level": "info",
  "domain": "financial",
  "tool": "get_stock_quote",
  "input_hash": "a3f9c2",
  "cache_hit": false,
  "latency_ms": 143,
  "status": "success"
}
```

Errors additionally include:

```json
{
  "error_code": "UPSTREAM_ERROR",
  "upstream": "alpha_vantage",
  "upstream_status": 429
}
```

Log level controlled via `LOG_LEVEL` env var (`debug | info | warn | error`).

---

## 11. Transport Comparison

| | stdio | HTTP + SSE |
|--|-------|------------|
| **Use case** | Claude Desktop, local dev, single-user | Remote agents, hosted API, multi-client |
| **Auth** | Token in `_meta` of MCP request | Token in HTTP `Authorization` header |
| **Deployment** | `npx mcp-suite` as subprocess | PM2 / Docker, behind Nginx reverse proxy |
| **Health check** | N/A | `GET /health` endpoint |
| **v1.0 support** | Yes (primary) | Yes (secondary, `--transport http`) |

---

## 12. Package Distribution

```json
{
  "bin": {
    "mcp-suite": "./dist/index.js"
  },
  "main": "./dist/server.js",
  "types": "./dist/server.d.ts",
  "exports": {
    ".": "./dist/server.js",
    "./domains/*": "./dist/domains/*.js"
  }
}
```

Consumers can either run the server via CLI or import domain modules to compose a custom server.

---

## 13. Security Posture

| Risk | Mitigation |
|------|-----------|
| API keys leaked in logs | Logger filters env var patterns; `debugMessage` never sent to client |
| JWT secret committed to repo | `.env.example` contains placeholder; `.env` in `.gitignore` |
| Dependency supply chain attack | `npm audit` in CI; `package-lock.json` committed; no `latest` version ranges |
| SSRF via user-controlled URLs | No user-supplied URLs; all upstream endpoints hardcoded in domain clients |
| PHI exposure (healthcare) | Tools only connect to public FHIR sandbox; PHI disclaimer in tool descriptions and README |
| Prototype pollution | Zod validation on all inputs; no `Object.assign` with user data |
