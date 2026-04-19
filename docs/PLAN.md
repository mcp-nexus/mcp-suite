# Technical Implementation Plan — Production MCP Server Toolkit

## Overview

A production-grade TypeScript MCP server exposing multi-domain tools to AI agents (Claude Desktop, Cursor, Windsurf, custom agents). Covers financial markets, Web3/DeFi, developer tools, and FHIR/healthcare. Ships with authentication by default — the key differentiator in a market where 38.7% of MCP servers have zero auth.

**Timeline:** 5–7 days  
**npm package name:** `mcp-suite` (or `@ayenisholah/mcp-suite`)  
**Target install:** `npx mcp-suite`

---

## Architecture

### Design Principles

1. **Domain isolation** — each domain (financial, web3, devtools, fhir) is a self-contained module; adding a new domain doesn't touch existing ones
2. **Auth on every transport** — JWT validation middleware wraps all tool calls; no unauthenticated access in production mode
3. **Fail closed** — a missing API key disables that domain's tools cleanly; server still starts and serves the other domains
4. **Schema-first** — every tool input/output defined with Zod; runtime validation before any external API call
5. **Observable** — structured JSON logs on every tool call (latency, domain, tool name, status); easy to pipe to Datadog/Loki

### System Diagram

```
Claude Desktop / Cursor / Agent
        │
        │  MCP protocol (stdio or HTTP/SSE)
        ▼
┌─────────────────────────────────────┐
│         MCP Server (main)           │
│  ┌──────────────────────────────┐   │
│  │   Auth Middleware (JWT)       │   │
│  └──────────────────────────────┘   │
│  ┌───────┐ ┌──────┐ ┌───────┐ ┌──┐ │
│  │Fin.   │ │Web3  │ │DevTools│ │HC│ │
│  │Markets│ │/DeFi │ │       │ │  │ │
│  └───┬───┘ └──┬───┘ └───┬───┘ └┬─┘ │
│      │        │          │      │   │
│  ┌───▼────────▼──────────▼──────▼─┐ │
│  │   Rate Limiter + Response Cache │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
        │        │         │       │
   Alpha    Alchemy    GitHub   FHIR
   Vantage   RPC      API      Sandbox
   / Yahoo   OpenSea
```

### Transport modes

| Mode | Use case | Config |
|------|----------|--------|
| `stdio` | Claude Desktop, local Cursor | Default; no network port needed |
| `http+sse` | Remote agents, hosted API | `--transport http --port 3000` |

---

## Project Structure

```
mcp-suite/
├── src/
│   ├── index.ts                  # Entry point; registers all domain tools
│   ├── server.ts                 # MCP server setup, transport selection
│   ├── auth/
│   │   ├── middleware.ts          # JWT validation
│   │   └── tokens.ts             # Token generation util (for testing/setup)
│   ├── domains/
│   │   ├── financial/
│   │   │   ├── index.ts           # Registers financial tools
│   │   │   ├── schemas.ts         # Zod schemas for inputs/outputs
│   │   │   ├── client.ts          # Alpha Vantage / Yahoo Finance adapter
│   │   │   └── tools/
│   │   │       ├── stock-quote.ts
│   │   │       ├── forex-rate.ts
│   │   │       ├── crypto-price.ts
│   │   │       └── market-news.ts
│   │   ├── web3/
│   │   │   ├── index.ts
│   │   │   ├── schemas.ts
│   │   │   ├── clients/
│   │   │   │   ├── opensea.ts
│   │   │   │   ├── blur.ts
│   │   │   │   └── alchemy.ts
│   │   │   └── tools/
│   │   │       ├── nft-floor.ts
│   │   │       ├── nft-sales.ts
│   │   │       ├── wallet-balances.ts
│   │   │       ├── amm-reserves.ts
│   │   │       └── dex-liquidity.ts
│   │   ├── devtools/
│   │   │   ├── index.ts
│   │   │   ├── schemas.ts
│   │   │   ├── client.ts          # GitHub API adapter (Octokit)
│   │   │   └── tools/
│   │   │       ├── repo-stats.ts
│   │   │       ├── pr-summary.ts
│   │   │       ├── pipeline-status.ts
│   │   │       └── deployment-health.ts
│   │   └── healthcare/
│   │       ├── index.ts
│   │       ├── schemas.ts
│   │       ├── client.ts          # FHIR R4 adapter (HAPI FHIR sandbox)
│   │       └── tools/
│   │           ├── patient-lookup.ts
│   │           ├── observation-query.ts
│   │           └── medication-list.ts
│   ├── shared/
│   │   ├── cache.ts               # LRU / TTL response cache (node-cache)
│   │   ├── rate-limiter.ts        # Per-domain rate limiting (token bucket)
│   │   ├── logger.ts              # Structured JSON logger
│   │   └── errors.ts             # Typed error classes
│   └── config.ts                 # Env var validation (Zod)
├── examples/
│   ├── financial-analysis.md      # Example prompts + screenshots
│   ├── web3-research.md
│   ├── devops-monitoring.md
│   └── clinical-query.md
├── demo/
│   └── record-demo.sh            # Script to run demo recording session
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Implementation Phases

### Day 1 — Foundation & Auth

**Goal:** Server starts, auth works, one tool callable end-to-end.

Tasks:
- [ ] `npm init`, tsconfig, `@modelcontextprotocol/sdk`, Zod, dependencies
- [ ] `server.ts` — MCP server scaffold, stdio transport
- [ ] `auth/middleware.ts` — JWT validation; `AUTH_DISABLED=true` dev escape hatch
- [ ] `auth/tokens.ts` — CLI command to generate test JWT: `npx mcp-suite gen-token`
- [ ] `config.ts` — Zod-validated env vars; domain tools disable cleanly if API key missing
- [ ] `shared/logger.ts` — structured JSON, tool call timing
- [ ] First tool end-to-end: `stock-quote` (Alpha Vantage free tier)
- [ ] Test with `claude_desktop_config.json` locally

**Acceptance:** `npx ts-node src/index.ts` starts; Claude Desktop calls `get_stock_quote` and gets a real response.

---

### Day 2 — Financial Markets Domain

**Goal:** All 4 financial tools working with real data.

Tools to ship:
| Tool | API | Notes |
|------|-----|-------|
| `get_stock_quote` | Alpha Vantage | Price, volume, change % |
| `get_forex_rate` | Alpha Vantage | Any currency pair |
| `get_crypto_price` | CoinGecko (free) | Top 250 coins |
| `get_market_news` | Alpha Vantage News | Ticker-filtered headlines |

Tasks:
- [ ] `financial/client.ts` — Alpha Vantage + CoinGecko adapters, typed responses
- [ ] `shared/cache.ts` — TTL cache (stock quotes: 60s, forex: 30s, crypto: 15s)
- [ ] `shared/rate-limiter.ts` — Alpha Vantage free tier: 25 calls/day guard
- [ ] Zod schemas for all 4 tool inputs/outputs
- [ ] Error handling: API down, invalid ticker, rate limit hit

---

### Day 3 — Web3 / DeFi Domain

**Goal:** NFT and DeFi tools working across ETH, Base, Arbitrum.

Tools to ship:
| Tool | API | Notes |
|------|-----|-------|
| `get_nft_floor` | OpenSea + Blur | Best floor across both markets |
| `get_nft_recent_sales` | OpenSea | Last N sales with traits |
| `get_wallet_balances` | Alchemy | Multi-chain token + NFT holdings |
| `get_amm_reserves` | Alchemy (onchain) | Uniswap V2/V3 pool state |
| `get_dex_liquidity` | Alchemy | Slippage estimates per trade size |

Tasks:
- [ ] `web3/clients/` — OpenSea, Blur, Alchemy adapters (existing code, port to module)
- [ ] Multi-chain support: ETH, Base, Arbitrum via env-configured RPC URLs
- [ ] Chain-aware caching (different TTLs per chain congestion)

---

### Day 4 — Developer Tools Domain

**Goal:** GitHub tools enabling AI-assisted DevOps workflows.

Tools to ship:
| Tool | API | Notes |
|------|-----|-------|
| `get_repo_stats` | GitHub REST | Stars, forks, open issues, language breakdown |
| `summarize_pr` | GitHub REST | PR diff, reviewers, CI status, merge readiness |
| `get_pipeline_status` | GitHub Actions | Latest workflow runs per repo |
| `get_deployment_health` | GitHub Deployments | Active environment status |

Tasks:
- [ ] `devtools/client.ts` — Octokit adapter with PAT auth
- [ ] Tool inputs: accept `owner/repo` shorthand
- [ ] Graceful handling of private repos (permission error, not crash)

---

### Day 5 — Healthcare (FHIR) Domain + Polish

**Goal:** FHIR tools working against public sandbox; server production-ready.

Tools to ship:
| Tool | API | Notes |
|------|-----|-------|
| `lookup_patient` | HAPI FHIR sandbox | Demographic search (synthetic data only) |
| `get_observations` | HAPI FHIR sandbox | Vitals, lab results by patient ID |
| `get_medications` | HAPI FHIR sandbox | Active medication list by patient ID |

HIPAA note included in README and tool descriptions: "Configured against public FHIR sandbox with synthetic data. For production PHI use: replace client with HIPAA-compliant EHR vendor endpoint and add OAuth 2.0 SMART on FHIR auth."

Polish tasks:
- [ ] `shared/errors.ts` — typed domain error classes, user-facing messages
- [ ] Tool list command: `npx mcp-suite list-tools` — prints all available tools with domain labels
- [ ] Health check endpoint (HTTP transport): `GET /health` returns domain availability
- [ ] `.env.example` with all required/optional vars documented
- [ ] `examples/` directory with sample prompts for each domain

---

### Day 6 — npm Publish + README + Demo

**Goal:** Package live on npm; demo GIF recorded; README complete.

Tasks:
- [ ] `package.json` bin entry: `"mcp-suite": "./dist/index.js"`
- [ ] Build script: `tsc && chmod +x dist/index.js`
- [ ] Publish: `npm publish --access public`
- [ ] Verify: `npx mcp-suite` works cold on a fresh machine
- [ ] Record demo GIF with `asciinema` or `terminalizer`: Claude Desktop calling tools across all 4 domains in one session
- [ ] README complete (see README spec below)

---

### Day 7 — Hosted API + Stripe (Optional stretch)

**Goal:** Deployed version with tiered rate limiting (same pattern as NFTTools).

Tasks:
- [ ] Deploy to VPS: HTTP transport, Nginx reverse proxy, PM2 process manager
- [ ] Stripe integration: free tier (25 calls/day), pro tier (10K calls/day)
- [ ] API key management: generate/revoke via CLI or web UI
- [ ] Update README with hosted API section

---

## README Specification

Structure:
1. **One-liner** — what it is in one sentence
2. **Demo GIF** — animated recording of Claude Desktop using tools across all 4 domains
3. **Install** — `npx mcp-suite` + `claude_desktop_config.json` snippet
4. **Auth setup** — `npx mcp-suite gen-token` → paste into config (prominently placed — this is the differentiator)
5. **Domain badges** — table showing which domains are available and what API keys they need
6. **Tool reference** — each tool: name, description, inputs, example output
7. **Disable a domain** — how to omit an API key to skip a domain
8. **HTTP transport** — how to run as a remote MCP server
9. **HIPAA note** — healthcare domain disclaimer and production guidance
10. **Contributing** — how to add a new domain (5-step guide)

---

## Environment Variables

```bash
# Auth
MCP_JWT_SECRET=                  # Required in production; omit to disable auth (dev only)
AUTH_DISABLED=false               # Set true for local dev

# Financial Markets
ALPHA_VANTAGE_API_KEY=            # Free tier: 25 req/day; premium for higher limits
COINGECKO_API_KEY=                # Optional; free tier works without

# Web3 / DeFi
ALCHEMY_API_KEY=                  # Required for Web3 domain
OPENSEA_API_KEY=                  # Required for NFT tools
BLUR_API_KEY=                     # Optional; falls back to OpenSea only

# Developer Tools
GITHUB_TOKEN=                     # PAT with repo:read scope

# Healthcare
FHIR_BASE_URL=https://hapi.fhir.org/baseR4  # Default: HAPI public sandbox
FHIR_AUTH_TOKEN=                  # Optional; required for production EHR endpoints

# Server
MCP_TRANSPORT=stdio               # stdio | http
MCP_PORT=3000                     # HTTP transport only
LOG_LEVEL=info                    # debug | info | warn | error
```

---

## Testing Strategy

| Layer | Tool | What |
|-------|------|------|
| Unit | Vitest | Schema validation, cache logic, rate limiter |
| Integration | Vitest + real APIs | Tool calls against live sandboxes (FHIR, GitHub) |
| Contract | Manual | Claude Desktop session covering all 4 domains |
| Package | CI | `npx mcp-suite` cold install on Ubuntu |

CI runs on every PR. Integration tests gated behind `RUN_INTEGRATION=true` env flag (not in CI by default — avoids burning free API quotas).

---

## Success Criteria

- [ ] `npx mcp-suite` installs and starts in under 10 seconds
- [ ] Claude Desktop can call tools from all 4 domains in a single session
- [ ] Demo GIF recorded and embedded in README
- [ ] Auth enabled by default; `gen-token` command works
- [ ] Server starts (with warnings) even when some domain API keys are missing
- [ ] npm package published with correct TypeScript types exported
- [ ] GitHub repo has 0 open lint/type errors in CI
