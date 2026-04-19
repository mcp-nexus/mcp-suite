# Product Requirements Document — Production MCP Server Toolkit

**Version:** 1.0  
**Status:** Approved  
**Author:** Shola Ayeni  
**Last updated:** 2026-04-19

---

## 1. Problem Statement

### For developers building with AI

AI agents and LLM tools (Claude, Cursor, Windsurf, custom agents) need real-world data to be useful — stock prices, NFT markets, CI/CD status, patient records. Today, developers must build custom API integrations from scratch for every data source, for every agent. There is no reusable, production-grade layer for this.

### For the job search

The MCP ecosystem has 21,700+ servers, but:
- 38.7% have zero authentication — not enterprise deployable
- Most target a single domain (only GitHub, only Slack, only one blockchain)
- Quality is low; few use TypeScript with proper types and input validation

A multi-domain, auth-first, well-typed MCP server toolkit is a genuine gap — and directly demonstrates the AI infrastructure engineering skills companies are hiring for in 2026.

---

## 2. Goals

### Product goals
1. Provide a single installable MCP server that gives AI agents access to financial markets, Web3/DeFi data, developer tooling, and healthcare records
2. Ship with authentication enabled by default — make it deployable in enterprise environments out of the box
3. Be the reference implementation for "how to build a production MCP server in TypeScript"

### Portfolio goals
1. Demonstrate AI infrastructure engineering ability to hiring managers at healthcare, fintech, enterprise SaaS, and AI tooling companies
2. Reach 100+ GitHub stars within 30 days of launch
3. Become discoverable when recruiters search for MCP server, TypeScript AI tools, or AI infrastructure on GitHub

---

## 3. Non-Goals (v1.0)

- Building a UI or web dashboard
- Supporting Python or languages other than TypeScript
- Real PHI (Protected Health Information) — healthcare domain uses public FHIR sandbox with synthetic data only
- Autonomous trade execution or financial transactions of any kind
- Multi-tenant API key management (deferred to hosted API v2)
- Fine-grained RBAC (role-based access control) per tool — all authenticated users have access to all tools their domain keys enable

---

## 4. Target Users

### Primary: AI Developer / Agent Builder
An engineer building a custom AI agent or LLM-powered product who needs structured, reliable data access without writing their own API integrations.

**Pain:** Spending 2–3 days wiring up APIs for every new agent project. No standard interface; every tool is a bespoke integration.

**Goal:** One command (`npx mcp-suite`) gives their agent access to real-world data across multiple domains, with typed schemas they can rely on.

**Success signal:** Agent calls a tool, gets back structured JSON, uses it in a workflow — in under an hour of setup.

---

### Secondary: Developer Tools Engineer (Enterprise)
An engineer or team lead evaluating MCP servers for internal tooling — want to give internal AI assistants access to GitHub, deployment data, or monitoring systems.

**Pain:** Existing MCP servers have no auth; deploying them internally is a security risk. Building from scratch takes weeks.

**Goal:** A server they can configure with their GitHub PAT, deploy behind their auth layer, and have running for their team same day.

**Success signal:** Internal Claude Desktop users can query CI/CD status and PR summaries without the security team raising concerns.

---

### Tertiary: Web3 / Crypto Analyst
An analyst or trader using Claude or Cursor for market research who needs real-time NFT and DeFi data without leaving their AI environment.

**Pain:** Switching between Claude and browser tabs for OpenSea floor prices, Blur bids, wallet balances. No MCP server covers both OpenSea and Blur in one place.

**Goal:** Ask Claude "what's the floor on Milady and how has it moved in the last 7 days?" and get a real answer with data.

**Success signal:** A complete NFT/DeFi research session run entirely through Claude Desktop with no manual browser tab switching.

---

### Quaternary: Healthcare / Biotech Engineer
A developer building AI tooling for clinical workflows who wants a reference implementation for FHIR-compliant MCP tooling.

**Pain:** No reference exists for how to build an MCP server that interfaces with FHIR data in a HIPAA-aware way. Starting from scratch means researching both MCP and FHIR simultaneously.

**Goal:** Fork or reference this server's healthcare domain implementation to bootstrap their production clinical AI tooling.

**Success signal:** Healthcare engineer can read the code and HIPAA notes, understand what to replace (sandbox endpoint → real EHR), and get to a production-safe implementation in 1–2 days instead of 1–2 weeks.

---

## 5. Functional Requirements

### 5.1 Authentication

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-01 | Server validates a JWT on every tool call before passing to any domain handler | P0 |
| AUTH-02 | `gen-token` CLI command generates a valid JWT for local development | P0 |
| AUTH-03 | `AUTH_DISABLED=true` env var disables auth for local development only | P0 |
| AUTH-04 | Invalid or expired JWT returns a structured error, not a crash | P0 |
| AUTH-05 | JWT secret is read from `MCP_JWT_SECRET` env var; server refuses to start in production mode if unset | P1 |

### 5.2 Domain — Financial Markets

| ID | Requirement | Priority |
|----|-------------|----------|
| FIN-01 | `get_stock_quote(ticker)` returns price, volume, change %, and market cap | P0 |
| FIN-02 | `get_forex_rate(from, to)` returns current exchange rate and 24h change | P0 |
| FIN-03 | `get_crypto_price(symbol)` returns price in USD, 24h change, market cap | P0 |
| FIN-04 | `get_market_news(ticker?, sentiment?)` returns recent headlines with sentiment scores | P1 |
| FIN-05 | All financial data cached with domain-appropriate TTLs (stock: 60s, forex: 30s, crypto: 15s) | P1 |
| FIN-06 | Alpha Vantage free tier limits (25 req/day) are tracked and surfaced as a warning before exhaustion | P1 |
| FIN-07 | If `ALPHA_VANTAGE_API_KEY` is not set, financial tools are omitted from tool list with a startup warning | P0 |

### 5.3 Domain — Web3 / DeFi

| ID | Requirement | Priority |
|----|-------------|----------|
| WEB3-01 | `get_nft_floor(collection_slug, chain?)` returns best floor price across OpenSea and Blur | P0 |
| WEB3-02 | `get_nft_recent_sales(collection_slug, limit?)` returns last N sales with price, traits, buyer/seller | P0 |
| WEB3-03 | `get_wallet_balances(address, chain?)` returns token balances and NFT holdings across ETH, Base, Arbitrum | P0 |
| WEB3-04 | `get_amm_reserves(pool_address, chain?)` returns current token reserves and price ratio for Uniswap V2/V3 pools | P1 |
| WEB3-05 | `get_dex_liquidity(token_address, trade_size_usd, chain?)` returns liquidity depth and estimated slippage | P1 |
| WEB3-06 | If `ALCHEMY_API_KEY` or `OPENSEA_API_KEY` is not set, web3 tools are omitted from tool list with a startup warning | P0 |

### 5.4 Domain — Developer Tools

| ID | Requirement | Priority |
|----|-------------|----------|
| DEV-01 | `get_repo_stats(owner_repo)` returns stars, forks, open issues, top language, last commit date | P0 |
| DEV-02 | `summarize_pr(owner_repo, pr_number)` returns PR title, diff summary, review status, CI check status | P0 |
| DEV-03 | `get_pipeline_status(owner_repo, branch?)` returns latest GitHub Actions workflow runs and their status | P0 |
| DEV-04 | `get_deployment_health(owner_repo, environment?)` returns active deployment URLs and health status | P1 |
| DEV-05 | Private repo access works when `GITHUB_TOKEN` has appropriate permissions; permission errors return a clear message | P1 |
| DEV-06 | If `GITHUB_TOKEN` is not set, developer tools are omitted from tool list with a startup warning | P0 |

### 5.5 Domain — Healthcare (FHIR)

| ID | Requirement | Priority |
|----|-------------|----------|
| HC-01 | `lookup_patient(name?, birth_date?, identifier?)` returns matching patient demographics from FHIR server | P0 |
| HC-02 | `get_observations(patient_id, category?, code?)` returns vital signs and lab results for a patient | P0 |
| HC-03 | `get_medications(patient_id)` returns active medication list for a patient | P0 |
| HC-04 | All healthcare tool descriptions include the text "FHIR sandbox data only — synthetic patients, no real PHI" | P0 |
| HC-05 | `FHIR_BASE_URL` defaults to `https://hapi.fhir.org/baseR4` (public sandbox); can be overridden for production use | P1 |
| HC-06 | Healthcare domain README section includes HIPAA guidance for replacing sandbox with production endpoint | P1 |

### 5.6 Server Behavior

| ID | Requirement | Priority |
|----|-------------|----------|
| SRV-01 | Server starts successfully even if some domain API keys are missing (missing domains are disabled with warnings) | P0 |
| SRV-02 | `npx mcp-suite` works without a global install (npx cold start) | P0 |
| SRV-03 | `--transport http --port 3000` flag starts an HTTP+SSE server for remote agent use | P1 |
| SRV-04 | `GET /health` (HTTP mode) returns JSON with per-domain availability status | P1 |
| SRV-05 | `list-tools` CLI command prints all available tools, grouped by domain, with short descriptions | P1 |
| SRV-06 | All tool calls are logged with: timestamp, domain, tool name, input summary, latency (ms), status | P1 |

---

## 6. Non-Functional Requirements

### Performance
- Tool call overhead (auth + validation + cache check): < 5ms added latency
- Cached responses: served in < 2ms
- Uncached tool calls: limited by upstream API; server adds < 10ms overhead

### Security
- JWT validation on every tool call in production mode
- No API keys logged or included in error messages
- Dependency audit (`npm audit`) passing at publish time
- No eval(), no dynamic require() with user input

### Reliability
- Domain failure (API down, rate limited) returns structured error without crashing other domains
- Circuit breaker per domain: after 5 consecutive failures, domain enters 60s cooldown
- All external HTTP calls have explicit timeouts (5s default, configurable)

### Developer Experience
- Cold start to first tool call: < 60 seconds (including `npx` download time)
- All public types exported; consumers get full TypeScript autocomplete
- `.env.example` documents every variable with inline comments
- `npx mcp-suite gen-token` generates a working JWT in one command

---

## 7. Success Metrics

| Metric | Target | Timeframe |
|--------|--------|-----------|
| GitHub stars | 100+ | 30 days post-launch |
| npm weekly downloads | 200+ | 30 days post-launch |
| GitHub search ranking | Top 3 for "mcp server typescript" | 30 days post-launch |
| Demo GIF views (README) | Measures engagement proxy | — |
| Recruiter inbounds from GitHub | 3+ | 45 days post-launch |
| Interview callbacks citing the project | 2+ | 60 days post-launch |

---

## 8. Launch Checklist

- [ ] npm package published and `npx mcp-suite` works
- [ ] README has demo GIF, install guide, auth setup, tool reference
- [ ] GitHub repo is public with MIT license
- [ ] CI passes: lint, type check, unit tests
- [ ] `npm audit` reports 0 high/critical vulnerabilities
- [ ] `.env.example` committed (no real API keys)
- [ ] HIPAA disclaimer present in healthcare domain docs and tool descriptions
- [ ] Announced in: relevant MCP Discord servers, r/MachineLearning, Twitter/X, LinkedIn

---

## 9. Open Questions

| Question | Status | Notes |
|----------|--------|-------|
| Best npm package name availability | **Resolved** | `mcp-suite` — unscoped, available on npm (confirmed 2026-04-19) |
| Alpha Vantage free tier sufficient for demo? | To verify | 25 calls/day; may need premium for recorded demo |
| HAPI FHIR sandbox uptime reliability | To test | Check during Day 5 — may need fallback sandbox |
| Include wash trade detection in NFT tools? | Deferred to v1.1 | Complex signal, high value for web3 domain |
