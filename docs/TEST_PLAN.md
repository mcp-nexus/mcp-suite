# Test Plan — Production MCP Server Toolkit

**Version:** 1.0  
**Last updated:** 2026-04-19

---

## Test Strategy Overview

| Layer | Tool | Scope | Runs in CI |
|-------|------|-------|-----------|
| Unit | Vitest | Schema validation, cache, rate limiter, error classes, auth middleware | Yes |
| Integration | Vitest + real APIs | Tool handlers against live sandboxes | No (opt-in) |
| Contract | Manual + MCP inspector | MCP protocol compliance, Claude Desktop tool list | No |
| Package | Shell + CI | `npx` cold install and startup on clean Ubuntu | Yes |
| Security | `npm audit` | Dependency vulnerability scan | Yes |

---

## 1. Unit Tests

### 1.1 Auth Middleware (`src/auth/middleware.test.ts`)

| Test Case | Input | Expected |
|-----------|-------|----------|
| Valid token passes through | Valid JWT, correct secret | `next()` called |
| Expired token rejected | JWT with past `exp` | `AuthError: Token expired` |
| Wrong secret rejected | JWT signed with different secret | `AuthError: Token signature invalid` |
| Missing token rejected | No `_meta.authorization` field | `AuthError: Token required` |
| Malformed token rejected | `"not.a.jwt"` | `AuthError: Token format invalid` |
| AUTH_DISABLED bypasses validation | `AUTH_DISABLED=true`, no token | `next()` called |
| AUTH_DISABLED does not suppress startup warning | `AUTH_DISABLED=true` | Warning logged at startup |

### 1.2 Zod Schemas (`domains/*/schemas.test.ts` — one per domain)

For each tool's input schema, test:

| Test Case | Pattern |
|-----------|---------|
| Valid input parses cleanly | Happy path input → no error |
| Required field missing | Omit each required field → `ZodError` |
| Wrong type | Pass number where string expected → `ZodError` |
| Extra fields stripped | Extra keys in input → stripped (not thrown) |
| String constraints | Empty string for ticker → `ZodError` |
| Enum values | Invalid `chain` value → `ZodError` |

### 1.3 Response Cache (`src/shared/cache.test.ts`)

| Test Case | Expected |
|-----------|----------|
| Cache miss returns `undefined` | `cache.get('missing-key')` → `undefined` |
| Cached value returned within TTL | Set + get within TTL → same value |
| Expired entry returns `undefined` | Set with TTL=1, wait 1100ms, get → `undefined` |
| LRU eviction at max capacity | Insert 1,001 items → oldest item evicted |
| Cache key isolation between domains | `financial:x` ≠ `web3:x` |

### 1.4 Rate Limiter (`src/shared/rate-limiter.test.ts`)

| Test Case | Expected |
|-----------|----------|
| Consume within limit | 24 consumes in 24h window → all succeed |
| Consume at limit | 25th consume (Alpha Vantage free tier) → `RateLimitError` |
| Window reset | Consume to limit, advance clock 24h → consume succeeds again |
| Per-domain isolation | Exhausting financial domain doesn't affect web3 |
| Error includes time-until-reset | `RateLimitError.retryAfterMs` > 0 |

### 1.5 Error Classes (`src/shared/errors.test.ts`)

| Test Case | Expected |
|-----------|----------|
| `AuthError` has code `AUTH_ERROR` | `err.code === 'AUTH_ERROR'` |
| `UpstreamError` carries upstream info | `err.upstream === 'alpha_vantage'` |
| `userMessage` never contains API key patterns | Regex scan of `userMessage` |
| All errors extend `McpError` | `err instanceof McpError` |

### 1.6 Config Validation (`src/config.test.ts`)

| Test Case | Expected |
|-----------|----------|
| Missing `MCP_JWT_SECRET` in prod mode | `process.exit(1)` with clear message |
| `AUTH_DISABLED=true` allows missing secret | Server starts with warning |
| Unknown env vars are ignored | No error |
| `MCP_PORT` non-numeric | Startup error with message |

### 1.7 Domain Availability

| Test Case | Expected |
|-----------|----------|
| Missing `ALPHA_VANTAGE_API_KEY` | `financial.isAvailable()` → false |
| Missing `ALCHEMY_API_KEY` | `web3.isAvailable()` → false |
| Missing `GITHUB_TOKEN` | `devtools.isAvailable()` → false |
| No keys needed for healthcare | `healthcare.isAvailable()` → true always |
| Disabled domain tools absent from registry | `toolRegistry.list()` excludes disabled domain |

---

## 2. Integration Tests

Run with `RUN_INTEGRATION=true npm test`. Requires valid API keys in `.env`.

### 2.1 Financial Domain (`domains/financial/__tests__/integration.test.ts`)

| Tool | Test | API Required |
|------|------|-------------|
| `get_stock_quote` | Returns valid data for `AAPL` | Alpha Vantage |
| `get_stock_quote` | Returns `NOT_FOUND` for `ZZZZZ` | Alpha Vantage |
| `get_forex_rate` | Returns rate for `USD/EUR` | Alpha Vantage |
| `get_crypto_price` | Returns data for `BTC` | CoinGecko (no key) |
| `get_market_news` | Returns articles for `NVDA` | Alpha Vantage |

### 2.2 Web3 Domain (`domains/web3/__tests__/integration.test.ts`)

| Tool | Test | API Required |
|------|------|-------------|
| `get_nft_floor` | Returns floor for `boredapeyachtclub` | OpenSea + Alchemy |
| `get_wallet_balances` | Returns holdings for Vitalik's public address | Alchemy |
| `get_amm_reserves` | Returns reserves for USDC/ETH pool | Alchemy |

### 2.3 Developer Tools Domain (`domains/devtools/__tests__/integration.test.ts`)

| Tool | Test | API Required |
|------|------|-------------|
| `get_repo_stats` | Returns stats for `vercel/next.js` (public repo) | GitHub (optional) |
| `summarize_pr` | Returns data for a known open PR | GitHub token |
| `get_pipeline_status` | Returns recent runs for public repo | GitHub (optional) |

### 2.4 Healthcare Domain (`domains/healthcare/__tests__/integration.test.ts`)

| Tool | Test | API Required |
|------|------|-------------|
| `lookup_patient` | Returns patients matching `Smith` | None (HAPI sandbox) |
| `get_observations` | Returns vitals for a known sandbox patient | None |
| `get_medications` | Returns medications for a known sandbox patient | None |

---

## 3. Contract Tests

Manual verification before each release. Run with Claude Desktop.

### 3.1 MCP Tool Discovery

- [ ] Open Claude Desktop with server configured
- [ ] Open new conversation — observe tools loading indicator appears
- [ ] Type "What tools do you have available?" — Claude lists all active domain tools
- [ ] Verify tool descriptions match `API.md`

### 3.2 Tool Call Flow (one per domain)

| Prompt | Domain | Expected |
|--------|--------|----------|
| "What's the current stock price of NVDA?" | Financial | Returns price, change %, volume |
| "What's the ETH floor for Bored Apes?" | Web3 | Returns floor from OpenSea + Blur |
| "Show me recent CI runs for vercel/next.js" | DevTools | Returns last 5 workflow runs |
| "Look up patients named James in the FHIR sandbox" | Healthcare | Returns patient list with disclaimer |

### 3.3 Auth Scenarios

- [ ] Server started without `AUTH_DISABLED` and no token in config → Claude shows auth error, not crash
- [ ] Expired JWT in config → Claude shows "Token expired" message
- [ ] Valid JWT → all tools work

### 3.4 Graceful Degradation

- [ ] Start server with only `GITHUB_TOKEN` set → only DevTools tools appear in Claude
- [ ] Start server with no keys at all → server starts, healthcare tools available, others absent
- [ ] Set Alpha Vantage key to invalid value → financial tools return upstream error, other domains unaffected

---

## 4. Package / Install Tests

Run in CI on every push to `main`.

### 4.1 Cold Install Test

```bash
# Run on clean Ubuntu 22.04 container in CI
npx mcp-suite --version
# Expected: prints version and exits cleanly
```

### 4.2 TypeScript Types Export Test

```bash
# In a separate TypeScript project
import type { Domain } from 'mcp-suite'
# Expected: no type errors; all exported types resolve
```

### 4.3 Binary Availability

```bash
which mcp-suite       # Expected: path to binary
mcp-suite list-tools  # Expected: tool list output
mcp-suite gen-token   # Expected: JWT printed to stdout
```

---

## 5. Security Tests

### 5.1 Dependency Audit (CI)

```bash
npm audit --audit-level=high
# Expected: 0 high or critical vulnerabilities
```

### 5.2 API Key Leak Prevention (Manual)

- [ ] Start server in debug log mode (`LOG_LEVEL=debug`) — verify no API key values appear in logs
- [ ] Trigger an upstream error — verify error message contains no API key values
- [ ] Check `dist/` output — no `.env` values baked into compiled output

### 5.3 Input Sanitization

Fuzz the following with unexpected inputs and verify `VALIDATION_ERROR` (not crash):
- `get_stock_quote`: `ticker = ""`, `ticker = null`, `ticker = "A".repeat(1000)`, `ticker = "<script>"`
- `get_wallet_balances`: `address = "not-an-address"`, `address = ""; DROP TABLE users; --"`
- `lookup_patient`: `name = null`, `limit = -1`, `limit = 99999`

---

## 6. Test Coverage Targets

| Layer | Target |
|-------|--------|
| Unit — shared utilities (cache, rate-limiter, errors, auth) | 90%+ |
| Unit — Zod schemas | 100% (all input/output schemas) |
| Unit — domain availability checks | 100% |
| Integration — happy paths per tool | 100% (all tools have at least one passing integration test) |

Coverage report: `npm run test:coverage` → `coverage/index.html`
