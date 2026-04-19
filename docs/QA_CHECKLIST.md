# QA Checklist — Production MCP Server Toolkit

**Last updated:** 2026-04-19

Use this checklist before every npm publish and any time the README or demo materials are updated.

---

## Pre-Release Checklist

### Code Quality

- [ ] `npm run typecheck` — zero TypeScript errors
- [ ] `npm run lint` — zero ESLint errors or warnings
- [ ] `npm run test` — all unit tests pass
- [ ] `npm run test:coverage` — shared utilities at 90%+, schemas at 100%
- [ ] `npm audit --audit-level=high` — zero high/critical vulnerabilities
- [ ] No `console.log` in production code paths (only in CLI scripts)
- [ ] No `// TODO` comments without a linked GitHub issue
- [ ] No `.env` values committed (`git grep -i 'api_key\s*=' -- '*.ts'` returns nothing)

### Package

- [ ] `npm pack --dry-run` — inspect output; `dist/` is included, `src/` is not, no `.env` in package
- [ ] `package.json` version bumped (semver)
- [ ] `CHANGELOG.md` entry written for this version
- [ ] All exported types resolve (`import type { Domain } from 'mcp-suite'` in a fresh TS project)
- [ ] Binary works after install: `npx mcp-suite --version` prints correct version
- [ ] `npx mcp-suite gen-token` generates a valid JWT
- [ ] `npx mcp-suite list-tools` prints tool list

### Functional (all domains)

- [ ] Server starts with all keys present — all 4 domains active
- [ ] Server starts with no keys — healthcare domain active; others show startup warning
- [ ] Server starts with partial keys — only configured domains register tools

**Financial domain:**
- [ ] `get_stock_quote("AAPL")` returns price, volume, change_pct
- [ ] `get_stock_quote("ZZZZZ")` returns a `NOT_FOUND` error (not a crash)
- [ ] `get_forex_rate("USD", "EUR")` returns valid rate
- [ ] `get_crypto_price("BTC")` returns price and market cap
- [ ] `get_market_news()` returns at least one article

**Web3 domain:**
- [ ] `get_nft_floor("boredapeyachtclub")` returns floors from both OpenSea and Blur
- [ ] `get_nft_recent_sales("boredapeyachtclub", 5)` returns 5 sales
- [ ] `get_wallet_balances("vitalik.eth")` resolves ENS and returns balances

**Developer tools domain:**
- [ ] `get_repo_stats("vercel/next.js")` returns stars, forks, language
- [ ] `summarize_pr("vercel/next.js", [open PR number])` returns CI status
- [ ] `get_pipeline_status("vercel/next.js")` returns recent runs

**Healthcare domain:**
- [ ] `lookup_patient(name: "Smith")` returns patient list with FHIR sandbox disclaimer
- [ ] `get_observations([patient_id], category: "vital-signs")` returns observations
- [ ] `get_medications([patient_id])` returns medication list

### Authentication

- [ ] `AUTH_DISABLED=true` → server starts with visible warning, all tools callable
- [ ] Valid JWT → tools callable normally
- [ ] Expired JWT → returns `AuthError: Token expired` (not a crash)
- [ ] Invalid JWT → returns `AuthError: Token signature invalid`
- [ ] No token provided → returns `AuthError: Token required`

### Claude Desktop Integration

- [ ] Server entry in `claude_desktop_config.json` works on clean machine
- [ ] Tools appear in Claude's tool list after restarting Claude Desktop
- [ ] Each domain's tools are callable through a natural language prompt
- [ ] Disabled domains produce no error tools in Claude's list — they simply don't appear

### HTTP Transport Mode

- [ ] `MCP_TRANSPORT=http MCP_PORT=3001` starts server on port 3001
- [ ] `GET /health` returns 200 with domain status map
- [ ] `GET /tools` returns tool list (requires valid auth token)
- [ ] Multiple clients can call tools simultaneously without interference

### Security

- [ ] Server logs contain no API key values (test with `LOG_LEVEL=debug`)
- [ ] Upstream error messages contain no API key values
- [ ] Healthcare tool descriptions include "FHIR sandbox data only — synthetic patients, no real PHI"
- [ ] `.env` is in `.gitignore` and not in the published npm package

### README & Docs

- [ ] Demo GIF is current (reflects the latest tool names and output format)
- [ ] `claude_desktop_config.json` snippet in README is copy-pasteable and correct
- [ ] `gen-token` command in README matches actual CLI output
- [ ] Domain badge table reflects currently supported domains
- [ ] `docs/API.md` tool reference matches actual tool schemas
- [ ] `docs/ENV_CONFIG.md` lists every env var that exists in `src/config.ts`

---

## Regression Scenarios

Run after any change to shared infrastructure (cache, rate limiter, auth, error handling):

| Scenario | Steps | Expected |
|----------|-------|----------|
| Cache hit performance | Call same tool twice within TTL | Second call latency < 5ms |
| Rate limit recovery | Exhaust financial domain, wait window reset, call again | Succeeds |
| Domain failure isolation | Set invalid Alchemy key, call financial tool | Financial tool works; Web3 returns error |
| Auth + cache interaction | Call tool with valid token, then with invalid token | Invalid token rejected before cache is checked |
| Concurrent calls | 10 simultaneous calls to same tool | All return correct responses; no race conditions |

---

## Known Acceptable Failures (Not Bugs)

| Behavior | Reason |
|----------|--------|
| HAPI FHIR sandbox occasionally returns 500 or times out | Public sandbox, not SLA-backed; retry is acceptable |
| Alpha Vantage free tier: 25 calls/day exhausted during demos | Use premium key for demos; document in README |
| NFT floor returns null for very new collections | Collection not yet indexed by OpenSea/Blur; expected behavior |
