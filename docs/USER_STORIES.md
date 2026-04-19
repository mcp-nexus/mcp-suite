# User Stories — Production MCP Server Toolkit

**Format:** `As a [persona], I want to [action], so that [outcome].`

Stories are organized by persona, then by epic. Each includes acceptance criteria and a priority/effort estimate.

**Priority:** P0 (must ship v1.0) | P1 (should ship v1.0) | P2 (v1.1)  
**Effort:** S (< 2hrs) | M (2–4hrs) | L (4–8hrs) | XL (8+hrs)

---

## Persona 1: Alex — AI Developer / Agent Builder

Alex builds custom AI agents for clients. Uses Claude via API and is exploring MCP to give agents real-world data access. Comfortable with TypeScript. Impatient with setup — if it takes more than an hour to get running, they'll move on.

---

### Epic: Setup & Installation

**US-01** — Install and run in under 10 minutes  
*As an AI developer, I want to run `npx mcp-suite` and have a working server in minutes, so that I can connect it to my agent workflow without a multi-hour setup.*

Acceptance criteria:
- `npx mcp-suite` downloads and starts without error
- Claude Desktop can call at least one tool within 5 minutes of install
- No global install required

**Priority:** P0 | **Effort:** M

---

**US-02** — Know exactly what to add to `claude_desktop_config.json`  
*As an AI developer, I want a copy-pasteable config snippet in the README, so that I don't have to figure out the MCP config format from scratch.*

Acceptance criteria:
- README includes a complete `claude_desktop_config.json` block
- Block includes the auth token insertion point clearly labeled
- Works on macOS and Linux paths

**Priority:** P0 | **Effort:** S

---

**US-03** — Run without API keys for unsupported domains  
*As an AI developer, I want the server to start even if I only have a GitHub token (no Alchemy, no OpenSea), so that I can start with developer tools and add other domains later.*

Acceptance criteria:
- Server starts with only `GITHUB_TOKEN` set; financial, web3, healthcare tools are absent from tool list
- Startup log shows which domains are active and which are disabled (and why)
- No error thrown; disabled domains are silently absent from Claude's tool list

**Priority:** P0 | **Effort:** M

---

### Epic: Authentication

**US-04** — Generate a test token without writing code  
*As an AI developer, I want a CLI command to generate a JWT for local testing, so that I don't have to write a token generation script before I can test auth.*

Acceptance criteria:
- `npx mcp-suite gen-token` prints a valid JWT to stdout
- Token works immediately in `claude_desktop_config.json`
- Token includes a human-readable expiry (default: 30 days)

**Priority:** P0 | **Effort:** S

---

**US-05** — Disable auth during local development  
*As an AI developer, I want to skip JWT validation during local development, so that I can iterate quickly without managing tokens.*

Acceptance criteria:
- `AUTH_DISABLED=true` in `.env` bypasses JWT validation
- Server logs a visible warning at startup when auth is disabled
- Auth-disabled mode cannot be activated in production (requires explicit env var, not a flag or config file)

**Priority:** P0 | **Effort:** S

---

**US-06** — Get a clear error when my token is wrong  
*As an AI developer, I want a useful error message when auth fails, so that I know whether my token is expired, malformed, or using the wrong secret.*

Acceptance criteria:
- Expired token → "Token expired. Run `npx mcp-suite gen-token` to get a new one."
- Wrong secret → "Token signature invalid. Check MCP_JWT_SECRET matches the generating server."
- Malformed token → "Token format invalid. Expected a JWT (three dot-separated base64 segments)."
- No stack traces in user-facing auth errors

**Priority:** P0 | **Effort:** S

---

### Epic: Financial Markets Tools

**US-07** — Get a stock quote by ticker  
*As an AI developer, I want my agent to call `get_stock_quote("NVDA")` and receive structured price data, so that I can build financial analysis agents without writing my own market data integration.*

Acceptance criteria:
- Returns: `{ ticker, price, change_pct, volume, market_cap, as_of }`
- Works for US equities (NYSE, NASDAQ)
- Returns a clear error for invalid or delisted tickers (not a crash)
- Response cached for 60 seconds

**Priority:** P0 | **Effort:** M

---

**US-08** — Get a forex exchange rate  
*As an AI developer, I want my agent to call `get_forex_rate("USD", "EUR")` and get a current rate, so that I can build multi-currency financial workflows.*

Acceptance criteria:
- Returns: `{ from, to, rate, change_24h_pct, as_of }`
- Supports any currency pair Alpha Vantage supports
- Returns a clear error for unsupported currency codes

**Priority:** P0 | **Effort:** S

---

**US-09** — Get a crypto price  
*As an AI developer, I want my agent to call `get_crypto_price("BTC")` and get current price and market cap, so that I can include crypto data in financial analysis workflows alongside equities.*

Acceptance criteria:
- Returns: `{ symbol, price_usd, market_cap_usd, change_24h_pct, rank, as_of }`
- Works for top 250 coins by market cap
- Does not require a premium API key (CoinGecko free tier)

**Priority:** P0 | **Effort:** S

---

**US-10** — Know when I'm near my API rate limit  
*As an AI developer, I want a warning when my Alpha Vantage free tier is nearly exhausted, so that I don't hit silent failures mid-demo.*

Acceptance criteria:
- When 20 of 25 daily calls are used, the next tool response includes a `_warning` field
- Warning text: "Alpha Vantage free tier: 5 calls remaining today"
- Server does not crash when limit is hit; returns a structured error with the limit message

**Priority:** P1 | **Effort:** S

---

### Epic: Developer Tools

**US-11** — Get repository stats by owner/repo  
*As an AI developer, I want my agent to call `get_repo_stats("vercel/next.js")` and get activity metrics, so that I can build competitive analysis or due diligence agents.*

Acceptance criteria:
- Accepts `"owner/repo"` format
- Returns: `{ stars, forks, open_issues, primary_language, last_commit_at, license }`
- Works for public repos without a GitHub token; private repos require token

**Priority:** P0 | **Effort:** M

---

**US-12** — Get a PR summary without reading the diff manually  
*As an AI developer, I want my agent to call `summarize_pr("owner/repo", 123)` and get a structured PR overview, so that I can build code review assistant agents.*

Acceptance criteria:
- Returns: `{ title, state, author, reviewers, review_status, ci_checks: [{name, status}], files_changed, additions, deletions, created_at, mergeable }`
- Does not return the raw diff (too large for tool output) — returns a summary of changed files
- Works on open and closed PRs

**Priority:** P0 | **Effort:** M

---

**US-13** — Check pipeline status for a branch  
*As an AI developer, I want my agent to call `get_pipeline_status("owner/repo", "main")` and see the CI status, so that I can build release readiness agents.*

Acceptance criteria:
- Returns last 5 workflow runs: `[{ workflow_name, run_id, status, conclusion, started_at, finished_at, url }]`
- If branch is omitted, defaults to the repo's default branch
- Handles repos with no GitHub Actions (returns empty array, not an error)

**Priority:** P0 | **Effort:** M

---

## Persona 2: Morgan — Enterprise Developer Tools Lead

Morgan leads a 12-person platform engineering team at a Series B SaaS company. They want to give developers internal AI tooling access to GitHub and deployment data. Their security team will reject any MCP server without authentication.

---

### Epic: Enterprise Deployment

**US-14** — Deploy as a persistent HTTP server (not stdio)  
*As an enterprise developer tools lead, I want to run the server in HTTP mode and connect multiple Claude Desktop users to it, so that my team shares one deployment instead of each person running their own process.*

Acceptance criteria:
- `MCP_TRANSPORT=http MCP_PORT=3001 npx mcp-suite` starts an HTTP+SSE server
- Multiple simultaneous Claude Desktop clients can connect and call tools independently
- Server logs show per-client tool calls

**Priority:** P1 | **Effort:** L

---

**US-15** — Check server and domain health  
*As an enterprise developer tools lead, I want a `/health` endpoint, so that my monitoring system can alert me if the server or a domain goes down.*

Acceptance criteria:
- `GET /health` returns `200` with: `{ status: "ok", domains: { financial: "active" | "disabled" | "degraded", ... } }`
- Returns `503` if no domains are active
- Response includes server uptime and version

**Priority:** P1 | **Effort:** S

---

**US-16** — List all available tools from the command line  
*As an enterprise developer tools lead, I want to run `npx mcp-suite list-tools` and see what tools are available, so that I can audit what data access my team's AI assistants will have.*

Acceptance criteria:
- Output lists tools grouped by domain: `[financial] get_stock_quote — Returns current price and volume for a stock ticker`
- Shows which domains are inactive (and why)
- Machine-readable JSON output option: `list-tools --json`

**Priority:** P1 | **Effort:** S

---

## Persona 3: Jordan — Web3 / NFT Analyst

Jordan is a full-time NFT and DeFi analyst. Uses Claude Desktop daily for research. Spends too much time switching between Claude and OpenSea tabs. Has no interest in running infrastructure — just wants it to work.

---

### Epic: NFT Market Research

**US-17** — Get NFT floor price with best-across-markets accuracy  
*As an NFT analyst, I want to call `get_nft_floor("boredapeyachtclub")` and get the best floor price across OpenSea and Blur, so that I have an accurate market picture without checking both platforms.*

Acceptance criteria:
- Returns: `{ collection, floor_opensea, floor_blur, best_floor, currency: "ETH", as_of }`
- Works by collection slug (OpenSea format)
- Supported chains: Ethereum, Base, Arbitrum
- Response cached for 30 seconds (NFT floors move slower than DeFi)

**Priority:** P0 | **Effort:** M

---

**US-18** — See recent sales to gauge market activity  
*As an NFT analyst, I want to call `get_nft_recent_sales("boredapeyachtclub", 10)` and see the last 10 sales, so that I can understand price trends and which traits are moving.*

Acceptance criteria:
- Returns: `[{ token_id, price_eth, traits: {key: value}, buyer, seller, sale_time, marketplace }]`
- `limit` param defaults to 10, max 50
- Sorted by most recent first
- Includes both OpenSea and Blur sales

**Priority:** P0 | **Effort:** M

---

**US-19** — Check a wallet's holdings across chains  
*As an NFT analyst, I want to call `get_wallet_balances("0x...")` and see all tokens and NFTs across chains in one call, so that I can research wallet holdings without switching between Etherscan tabs.*

Acceptance criteria:
- Returns: `{ address, chains: { ethereum: { tokens: [...], nfts: [...] }, base: {...}, arbitrum: {...} } }`
- Tokens include: symbol, balance, USD value (if available)
- NFTs include: collection, token_id, floor_value_eth (if available)
- ENS resolution: if address is an ENS name, resolve it first

**Priority:** P0 | **Effort:** L

---

### Epic: DeFi Research

**US-20** — Query Uniswap pool reserves  
*As an NFT analyst, I want to call `get_amm_reserves("0x...")` on a Uniswap pool, so that I can understand current liquidity depth and token price ratios.*

Acceptance criteria:
- Returns: `{ pool_address, token0: { symbol, reserve }, token1: { symbol, reserve }, price_ratio, chain, protocol }`
- Supports Uniswap V2 and V3 pools
- Supported chains: Ethereum, Base, Arbitrum

**Priority:** P1 | **Effort:** L

---

**US-21** — Estimate slippage before a large trade  
*As an NFT analyst, I want to call `get_dex_liquidity("token_address", 10000)` to see estimated slippage on a $10K swap, so that I can understand execution cost before advising on a trade.*

Acceptance criteria:
- Returns: `{ token, trade_size_usd, estimated_slippage_pct, price_impact_pct, recommended_router, chain }`
- Estimates are for best available DEX route, not just one pool
- Includes a warning if slippage > 3%

**Priority:** P1 | **Effort:** L

---

## Persona 4: Sam — Healthcare / Biotech Engineer

Sam is a senior engineer at a digital health startup building AI-assisted clinical workflows. Evaluating MCP servers to connect their AI assistant to patient data. Has compliance and security as hard constraints — will not use anything that doesn't show awareness of HIPAA.

---

### Epic: Clinical Data Access (FHIR)

**US-22** — Look up synthetic patients by demographic  
*As a healthcare engineer, I want to call `lookup_patient(name: "Smith", birth_date: "1980-01-15")` against the FHIR sandbox, so that I can prototype patient-lookup workflows using synthetic data before connecting to a real EHR.*

Acceptance criteria:
- Returns: `[{ patient_id, name, birth_date, gender, address, active }]`
- Search by any combination of: name, birth date, patient identifier
- Tool description clearly states: "FHIR sandbox only — synthetic data, no real PHI"
- Results limited to 20 by default

**Priority:** P0 | **Effort:** M

---

**US-23** — Retrieve a patient's observations (vitals and labs)  
*As a healthcare engineer, I want to call `get_observations("patient-123", category: "vital-signs")` and get structured vitals, so that I can prototype monitoring and alerting agent workflows.*

Acceptance criteria:
- Returns: `[{ observation_id, code, display, value, unit, reference_range, status, effective_time }]`
- Supported categories: `vital-signs`, `laboratory`, `survey`
- Sorted by most recent first; limit param (default 20, max 100)
- Returns empty array (not error) when patient has no matching observations

**Priority:** P0 | **Effort:** M

---

**US-24** — Get a patient's active medications  
*As a healthcare engineer, I want to call `get_medications("patient-123")` and get their current medication list, so that I can prototype medication reconciliation and interaction-checking agents.*

Acceptance criteria:
- Returns: `[{ medication_id, name, dosage, route, frequency, status, prescribed_by, start_date }]`
- Filtered to `active` status by default; `status` param to override
- Includes coded medication names (RxNorm) alongside display names

**Priority:** P0 | **Effort:** M

---

**US-25** — Understand how to replace the sandbox with a real EHR  
*As a healthcare engineer, I want clear documentation on what to change to connect the healthcare domain to a production FHIR server, so that I can adapt the reference implementation for production use without guessing.*

Acceptance criteria:
- README healthcare section includes: required env vars to override, SMART on FHIR auth pattern, note on HIPAA BAA requirement
- Code comment in `healthcare/client.ts` marks the exact line(s) to change for production
- Document points to a known production FHIR endpoint vendor (Epic, Cerner, Azure FHIR)

**Priority:** P1 | **Effort:** S (documentation only)

---

## Persona 5: Riley — Open Source Contributor

Riley is a TypeScript developer who found the project on GitHub. Wants to add a new domain (Stripe payment data, Kubernetes cluster status, etc.) and contribute it back.

---

### Epic: Extensibility

**US-26** — Add a new domain by following a documented pattern  
*As an open source contributor, I want a step-by-step guide for adding a new domain, so that I can contribute without reverse-engineering the existing domain code.*

Acceptance criteria:
- README "Contributing" section lists the exact files to create for a new domain
- An existing domain (e.g., `devtools`) is explicitly called out as the reference to copy
- Contributing guide explains how to register the domain in `index.ts`
- PR template exists with a checklist: schemas, tests, README entry, `.env.example` entry

**Priority:** P1 | **Effort:** S (documentation only)

---

**US-27** — Know what test coverage is expected for new tools  
*As an open source contributor, I want to know the minimum test requirements before opening a PR, so that I don't submit a PR that gets rejected for missing tests.*

Acceptance criteria:
- CONTRIBUTING.md states: unit tests for schema validation required; integration test against real or mock API required
- CI runs on PRs and must pass before merge
- Test file structure is shown for an existing domain as a reference

**Priority:** P1 | **Effort:** S (documentation only)

---

## Story Map Summary

| Epic | P0 Stories | P1 Stories | P2 Stories |
|------|-----------|-----------|-----------|
| Setup & Installation | US-01, US-02, US-03 | — | — |
| Authentication | US-04, US-05, US-06 | — | — |
| Financial Markets | US-07, US-08, US-09 | US-10 | — |
| Developer Tools | US-11, US-12, US-13 | — | — |
| Enterprise Deployment | — | US-14, US-15, US-16 | — |
| NFT Market Research | US-17, US-18, US-19 | — | — |
| DeFi Research | — | US-20, US-21 | — |
| Healthcare (FHIR) | US-22, US-23, US-24 | US-25 | — |
| Extensibility | — | US-26, US-27 | — |

**v1.0 scope:** All P0 stories (17 stories)  
**v1.0 stretch:** P1 stories where effort is S or M  
**v1.1:** Remaining P1 stories (DeFi, enterprise HTTP, extensibility docs)
