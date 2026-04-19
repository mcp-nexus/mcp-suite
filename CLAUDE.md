# CLAUDE.md — MCP Server Toolkit

Instructions for Claude Code when working in this project.

---

## What This Project Is

A production-grade TypeScript MCP server that exposes multi-domain AI tools (financial markets, Web3/DeFi, developer tools, healthcare/FHIR) to Claude Desktop, Cursor, and custom agents. Authentication is enabled by default. Installable via `npx mcp-suite`.

Full context: `docs/TDD.md` (architecture), `docs/PRD.md` (requirements), `docs/API.md` (tool reference).

---

## Commands

```bash
npm run build          # compile TypeScript → dist/
npm run dev            # watch mode (tsc --watch)
npm run typecheck      # type check without emit
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier
npm test               # unit tests (Vitest)
npm run test:coverage  # unit tests + coverage report

# Integration tests (hits real APIs — requires API keys in .env)
RUN_INTEGRATION=true npm test

# CLI tools (after build)
node dist/index.js list-tools
node dist/index.js gen-token
```

---

## Project Structure

```
src/
├── index.ts              # Entry point, CLI flags
├── server.ts             # MCP server setup, domain registration
├── config.ts             # Env var validation (Zod)
├── auth/
│   ├── middleware.ts      # JWT validation
│   └── tokens.ts          # gen-token command
├── domains/
│   ├── financial/         # Alpha Vantage + CoinGecko
│   ├── web3/              # Alchemy + OpenSea + Blur
│   ├── devtools/          # GitHub API
│   └── healthcare/        # FHIR R4 (HAPI sandbox)
└── shared/
    ├── cache.ts           # LRU + TTL (node-cache)
    ├── rate-limiter.ts    # Token bucket per domain
    ├── logger.ts          # Structured JSON logger
    └── errors.ts          # Typed error classes
docs/                      # All planning and reference docs
```

---

## Key Conventions

- **No `any`** — use `unknown` and narrow, or infer types from Zod schemas
- **Schemas in `schemas.ts`** — never define Zod schemas inline in tool files
- **`.describe()` on every schema field** — MCP clients surface these to the LLM; missing descriptions degrade LLM usability
- **No `console.log`** in `src/domains/` or `src/shared/` — use `logger` from `shared/logger.ts`
- **Typed errors only** — throw `UpstreamError`, `ValidationError`, etc. from `shared/errors.ts`; never throw raw `Error` from a domain handler
- **No API keys in logs** — the logger must never emit env var values; pass only `error_code` and `upstream` name
- **Tool names globally unique** — across all domains; prefix with domain if collision risk (e.g., `financial_get_quote`)
- **No cross-domain imports** — `src/shared/` is the only shared layer; domain code never imports from another domain
- **Import order** — Node.js builtins → external packages → `src/shared/` → domain-local (ESLint-enforced)

Full standards: `docs/CODING_STANDARDS.md`

---

## Coding Patterns

**Typed error classes** (`src/shared/errors.ts`):

| Class | When to throw |
|-------|--------------|
| `ValidationError` | Bad input caught by Zod or business rules |
| `UpstreamError` | External API returned an error or unexpected shape |
| `RateLimitError` | Rate limiter bucket exhausted |
| `AuthError` | JWT missing, expired, or invalid |
| `DomainUnavailableError` | Domain's required API key not present at runtime |

All typed errors carry a `userMessage` (safe to return to the LLM) and a `debugMessage` (server-side only, never sent to client).

**Cache key convention** — always `domain:tool:inputHash`:
```typescript
const cacheKey = `financial:stock_quote:${input.ticker}`
```

**Every handler follows this order:**
1. Check cache → return hit
2. Call `await rateLimiter.consume('domain-name')`
3. Call `domainClient.*()` — never call `fetch` directly in a handler
4. Wrap errors in typed class, set cache, log result

**Logger structured fields** — exact shape required:
```typescript
logger.info({ domain: 'financial', tool: 'stock_quote', latency_ms: Date.now() - start, cache_hit: false, status: 'success' })
logger.error({ domain: 'financial', tool: 'stock_quote', error_code: 'UPSTREAM_ERROR', upstream: 'alpha-vantage' })
```

---

## Domain Pattern

Every domain follows the same structure. When adding a new tool to an existing domain:

1. Add Zod input/output schemas to `domains/[name]/schemas.ts`
2. Add the handler to `domains/[name]/tools/[tool-name].ts`
3. Register the tool in `domains/[name]/index.ts` via `server.tool()`
4. Document it in `docs/API.md`

When adding a new domain entirely, copy `domains/devtools/` as the reference. Every domain exports a `Domain` object:

```typescript
export const myDomain: Domain = {
  name: 'my-domain',
  isAvailable: () => !!config.MY_API_KEY,
  registerTools: (server) => { /* server.tool(...) calls */ }
}
```

Register it in `server.ts`. See `docs/TDD.md §5` and `docs/CODING_STANDARDS.md` for full details.

---

## Auth Behaviour

- Production: `MCP_JWT_SECRET` required; all tool calls validate JWT
- Development: `AUTH_DISABLED=true` skips validation (logs a warning)
- `gen-token` CLI generates a dev JWT: `node dist/index.js gen-token`
- Token goes in `claude_desktop_config.json` under the server's `env` block

---

## Testing Rules

- Unit tests co-located with source: `stock-quote.test.ts` next to `stock-quote.ts`
- Mock the domain API clients (e.g., `financialClient`), never mock `fetch` globally
- Integration tests named `*.integration.test.ts`, gated behind `RUN_INTEGRATION=true`
- New tools need: schema validation tests + at least one handler happy-path test
- Schema validation tests must cover negative cases: empty string, null, missing required field, oversized input

Full test plan: `docs/TEST_PLAN.md`

---

## Do Not

- Add Redis, a database, or any persistent-store dependency in v1.0 — see `docs/adr/ADR-006-node-cache-not-redis.md`
- Change the `Cache` or `RateLimiter` interfaces in `shared/` without updating all domain callers
- Hardcode API base URLs anywhere except the domain's `client.ts`
- Skip the pre-commit hook (`--no-verify`) — fix lint/type errors instead
- Commit `.env` — only `.env.example` is tracked

---

## Self-Improvement Protocol

After every session where you encounter an error, make a fix, or receive a correction:

1. **Log the lesson** — Add it to the `## Learned Lessons` section below in this format:
   - ❌ What went wrong / what was assumed incorrectly
   - ✅ What the correct approach is
   - 📁 Context (file, feature, or pattern it applies to)

2. **Update rules** — If the lesson is general enough, promote it to the `## Rules` section as a standing instruction

3. **Never repeat a logged mistake** — Before starting any task, re-read the `## Learned Lessons` and `## Rules` sections

---

## Rules

- At the end of EVERY task or session, check if any errors occurred or corrections were made. If yes, update `## Learned Lessons` before closing.
- If the user says "note that", "remember", or "don't do that again", immediately update the relevant section of this file.

---

## Learned Lessons
<!-- Auto-updated after each session. Format: date | context | mistake → fix -->
