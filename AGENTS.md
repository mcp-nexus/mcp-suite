# AGENTS.md — MCP Server Toolkit

Guidance for AI agents (Claude, GPT, Gemini, or any coding assistant) working on tasks in this repository.

---

## Project Summary

This is a production TypeScript MCP (Model Context Protocol) server. It exposes structured tools to AI clients (Claude Desktop, Cursor, Windsurf, custom agents) across four data domains:

| Domain | Data sources | Key tools |
|--------|-------------|-----------|
| `financial` | Alpha Vantage, CoinGecko | stock quotes, forex rates, crypto prices, market news |
| `web3` | Alchemy, OpenSea, Blur | NFT floors, wallet balances, AMM reserves, DEX liquidity |
| `devtools` | GitHub API | repo stats, PR summaries, CI pipeline status, deployment health |
| `healthcare` | HAPI FHIR R4 sandbox | patient lookup, observations, medications |

Authentication (JWT) is enabled by default. Domains start or skip cleanly based on which API keys are present in the environment.

---

## Architecture in One Paragraph

The MCP server registers tools from each domain module at startup. Each domain is isolated — its own schemas (Zod), API client, and tool handlers — behind a `Domain` interface (`isAvailable()` + `registerTools()`). All domains share three utilities: a response cache (`node-cache`, LRU + TTL), a token-bucket rate limiter (per domain), and a structured JSON logger. Errors are typed (`AuthError`, `UpstreamError`, `ValidationError`, etc.) and never expose API keys or raw exceptions to the MCP client.

Full architecture: `docs/TDD.md`

---

## File Map

| File / folder | What it does |
|---------------|-------------|
| `src/index.ts` | CLI entry point — reads flags, selects transport, starts server |
| `src/server.ts` | Registers domains; calls `domain.registerTools(server)` for each active domain |
| `src/config.ts` | Zod-validated env var parsing; exits cleanly if required vars are missing |
| `src/auth/middleware.ts` | JWT validation applied before every tool call |
| `src/auth/tokens.ts` | `gen-token` CLI implementation |
| `src/domains/[name]/index.ts` | Exports the `Domain` object; calls `server.tool()` for each tool |
| `src/domains/[name]/schemas.ts` | All Zod input/output schemas for this domain |
| `src/domains/[name]/client.ts` | Typed adapter for external API(s) |
| `src/domains/[name]/tools/*.ts` | One file per tool — imports schema + client, handles caching |
| `src/shared/cache.ts` | `Cache` interface + `node-cache` implementation |
| `src/shared/rate-limiter.ts` | Token-bucket rate limiter, one bucket per domain |
| `src/shared/logger.ts` | Structured JSON logger (wraps `pino` or similar) |
| `src/shared/errors.ts` | Typed error classes extending `McpError` |
| `docs/` | All planning, API reference, runbook, ADRs — read before modifying behaviour |

---

## How to Add a New Tool to an Existing Domain

1. **Define schemas** in `src/domains/[name]/schemas.ts`:
   ```typescript
   export const MyToolInputSchema = z.object({
     param: z.string().describe("What this param does")
   })
   export const MyToolOutputSchema = z.object({ ... })
   export type MyToolInput = z.infer<typeof MyToolInputSchema>
   export type MyToolOutput = z.infer<typeof MyToolOutputSchema>
   ```

2. **Write the handler** in `src/domains/[name]/tools/my-tool.ts`:
   ```typescript
   export const myTool = {
     name: 'my_tool_name',
     description: 'One sentence. What it returns and from where.',
     inputSchema: MyToolInputSchema,
     handler: async (input: MyToolInput): Promise<MyToolOutput> => {
       const cacheKey = `domain:my_tool:${hash(input)}`
       const cached = cache.get<MyToolOutput>(cacheKey)
       if (cached) return cached
       await rateLimiter.consume('domain-name')
       const result = await domainClient.fetch(input)
       cache.set(cacheKey, result, TTL_SECONDS)
       logger.info({ domain: 'domain-name', tool: 'my_tool_name', ... })
       return result
     }
   }
   ```

3. **Register it** in `src/domains/[name]/index.ts`:
   ```typescript
   server.tool(myTool.name, myTool.inputSchema, myTool.handler)
   ```

4. **Add tests** in `src/domains/[name]/tools/my-tool.test.ts` — schema validation + handler happy path minimum.

5. **Document it** in `docs/API.md` under the correct domain section.

---

## How to Add a New Domain

Copy `src/domains/devtools/` as the reference. Minimum required:

1. Create `src/domains/[name]/` with: `index.ts`, `schemas.ts`, `client.ts`, `tools/`
2. Export a `Domain` object from `index.ts`:
   ```typescript
   export const myDomain: Domain = {
     name: 'my-domain',
     isAvailable: () => !!config.MY_REQUIRED_API_KEY,
     registerTools: (server) => {
       server.tool(tool1.name, tool1.inputSchema, tool1.handler)
       server.tool(tool2.name, tool2.inputSchema, tool2.handler)
     }
   }
   ```
3. Import and register in `src/server.ts`
4. Add env vars to `src/config.ts` (Zod) and `.env.example`
5. Document in `docs/API.md` and `docs/ENV_CONFIG.md`

---

## Patterns to Follow

**Cache before every external API call:**
```typescript
const cached = cache.get<OutputType>(cacheKey)
if (cached) return cached
// ... fetch
cache.set(cacheKey, result, TTL)
```

**Rate-limit before calling external API:**
```typescript
await rateLimiter.consume('domain-name')
```

**Wrap upstream errors, never let them escape raw:**
```typescript
try {
  return await client.fetch(input)
} catch (err) {
  throw new UpstreamError('Descriptive message', { upstream: 'api-name', cause: err })
}
```

**Log every tool call result:**
```typescript
logger.info({ domain, tool, latency_ms: Date.now() - start, cache_hit: false, status: 'success' })
```

---

## Patterns to Avoid

| Don't | Why |
|-------|-----|
| `throw new Error(...)` from a domain handler | Use typed errors from `shared/errors.ts` |
| `console.log(...)` in domain or shared code | Use `logger` — unstructured logs break observability |
| Define Zod schemas inline in tool files | Schemas belong in `schemas.ts` — they're shared and tested separately |
| Import one domain from another | Domains are isolated; shared utilities live in `src/shared/` only |
| Add `any` type | Use `unknown` + Zod narrowing or infer from schemas |
| Log env var values | Never — not even in debug mode |
| Add a Redis or DB dependency | In-scope only for v2.0; see `docs/adr/ADR-006-node-cache-not-redis.md` |

---

## Key Decisions Already Made

Before proposing architectural changes, check the ADRs in `docs/adr/`:

| ADR | Decision |
|-----|---------|
| ADR-001 | Use `@modelcontextprotocol/sdk` (not raw protocol) |
| ADR-002 | JWT auth (not API keys or OAuth — OAuth is v2.0) |
| ADR-003 | Zod for all schema validation (not Joi, not AJV) |
| ADR-004 | Domain isolation architecture (not flat tool registry) |
| ADR-005 | stdio as primary transport (HTTP is secondary flag) |
| ADR-006 | `node-cache` in v1.0 (Redis deferred to v2.0) |

---

## Deferred to v2.0 — Do Not Implement

These are explicitly out of scope for v1.0. Do not add them even if they seem like obvious improvements:

| Feature | Why deferred |
|---------|-------------|
| Redis / external cache | In-process `node-cache` is sufficient; see ADR-006 |
| Per-tool RBAC | JWT scopes deferred until multi-tenant use case is confirmed |
| Circuit breaker per domain | NYI — 5 consecutive failures → 60s cooldown is designed but not built |
| Infura fallback for Alchemy | Adds complexity without confirmed need |
| Wash-trade detection (web3) | Planned for v1.1 |
| OAuth 2.0 auth | Planned for v2.0; JWT covers v1.0 use cases |

Full list: `docs/TECHNICAL_DEBT.md`

---

## Transport Modes

Auth token placement differs by transport — domain code is identical, only startup changes:

| Transport | How to pass the JWT |
|-----------|-------------------|
| stdio (default) | Add to `claude_desktop_config.json` under the server's `env` block as `MCP_AUTH_TOKEN` |
| HTTP (`--http` flag) | Pass as `Authorization: Bearer <token>` request header |

In HTTP mode, `GET /health` returns domain status:
```json
{ "status": "ok", "domains": { "financial": "active", "web3": "disabled", "devtools": "active", "healthcare": "active" } }
```
Returns `503` if no domains are active. This endpoint requires no auth.

---

## Environment

Server starts cleanly with any subset of API keys. Missing domain keys disable that domain with a startup warning — no crash. Startup warning format: `[WARN] Financial domain disabled — ALPHA_VANTAGE_API_KEY not set`

| Env var | Domain it enables |
|---------|-----------------|
| `ALPHA_VANTAGE_API_KEY` | financial |
| `ALCHEMY_API_KEY` + `OPENSEA_API_KEY` | web3 |
| `GITHUB_TOKEN` | devtools |
| *(none required)* | healthcare (FHIR sandbox) |

**Healthcare note:** The FHIR domain uses the public HAPI sandbox — no keys needed, but it is not for real PHI. Production use requires replacing `FHIR_BASE_URL`, adding SMART on FHIR OAuth 2.0, and a BAA with your EHR vendor.

Full reference: `docs/ENV_CONFIG.md`

---

## Caching TTL Reference

Use these defaults when adding new tools. Override only with a documented reason:

| Domain | Tool | TTL |
|--------|------|-----|
| financial | stock quote | 60s |
| financial | forex rate | 30s |
| financial | crypto price | 15s |
| financial | market news | 300s |
| web3 | NFT floor price | 30s |
| web3 | wallet balance | 60s |
| web3 | AMM reserves | 15s |
| devtools | repo stats | 300s |
| devtools | PR summary | 120s |
| devtools | CI status | 30s |
| healthcare | patient lookup | 60s |

Source: `docs/TDD.md §7`

---

## API Quota Limits (Free Tiers)

Design tools to stay within these limits. The rate limiter protects against bursts, but daily caps are hard limits:

| API | Free tier limit |
|-----|----------------|
| Alpha Vantage | 25 requests/day |
| CoinGecko | ~50 requests/min (no key), 500/min (Pro) |
| Alchemy | 300M compute units/month |
| OpenSea | 4 requests/sec |
| GitHub (unauthenticated) | 60 requests/hr |
| GitHub (token) | 5,000 requests/hr |
| HAPI FHIR sandbox | No enforced limit (public sandbox) |

Source: `docs/ENV_CONFIG.md`

---

## Agent Self-Correction Rules

- Before writing code, check `CLAUDE.md > Learned Lessons` for patterns relevant to this task
- If an approach fails twice, stop and re-read `CLAUDE.md` before trying a third time
- When a human corrects you, treat it as a rule update — ask: "Should I add this to CLAUDE.md?"
- Prefer patterns already validated in this codebase over general knowledge

---

## Reference Docs

| Task | Read |
|------|------|
| Understand the full architecture | `docs/TDD.md` |
| Check what a tool should return | `docs/API.md` |
| Set up the dev environment | `docs/SETUP.md` |
| Write tests for a new tool | `docs/TEST_PLAN.md` |
| Deploy to VPS | `docs/RUNBOOK.md` |
| Investigate a production incident | `docs/INCIDENT_RESPONSE.md` |
| Understand a past technical decision | `docs/adr/ADR-00N-*.md` |
| See known shortcuts to avoid touching | `docs/TECHNICAL_DEBT.md` |
