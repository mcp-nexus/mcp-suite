# Changelog — Production MCP Server Toolkit

All notable changes to this project are documented here.

Format: `## [version] — YYYY-MM-DD` followed by `### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Security` sections as applicable.

---

## [Unreleased]

Changes staged for the next release.

---

## [1.0.0] — 2026-05-XX

Initial public release.

### Added

**Core**
- MCP server with stdio transport (primary) and HTTP + SSE transport (`--transport http`)
- JWT authentication middleware enabled by default
- `gen-token` CLI command for generating development JWTs
- `list-tools` CLI command showing all active tools grouped by domain
- `AUTH_DISABLED=true` escape hatch for local development
- `GET /health` endpoint (HTTP transport) showing per-domain availability
- Structured JSON logging with per-call latency tracking
- Domain isolation: server starts cleanly with any subset of API keys configured
- Response cache (LRU + TTL) per domain with domain-appropriate TTLs
- Token-bucket rate limiter per domain protecting free-tier API quotas
- Typed error classes: `AuthError`, `ValidationError`, `DomainUnavailableError`, `UpstreamError`, `RateLimitError`

**Financial Markets Domain**
- `get_stock_quote` — US equity price, volume, change % (Alpha Vantage)
- `get_forex_rate` — currency pair exchange rate (Alpha Vantage)
- `get_crypto_price` — crypto price, market cap, 24h change (CoinGecko)
- `get_market_news` — financial headlines with sentiment scores (Alpha Vantage)

**Web3 / DeFi Domain**
- `get_nft_floor` — best floor across OpenSea + Blur (ETH, Base, Arbitrum)
- `get_nft_recent_sales` — last N sales with traits and marketplace (OpenSea + Blur)
- `get_wallet_balances` — multi-chain token + NFT holdings, ENS resolution (Alchemy)
- `get_amm_reserves` — Uniswap V2/V3 pool reserves and price ratio (Alchemy)
- `get_dex_liquidity` — trade slippage estimates per size (Alchemy)

**Developer Tools Domain**
- `get_repo_stats` — GitHub repo stars, forks, issues, language (GitHub API)
- `summarize_pr` — PR diff summary, reviewers, CI checks, merge status (GitHub API)
- `get_pipeline_status` — latest GitHub Actions runs per branch (GitHub API)
- `get_deployment_health` — active deployment URL and status (GitHub API)

**Healthcare Domain (FHIR)**
- `lookup_patient` — demographic patient search (HAPI FHIR sandbox)
- `get_observations` — vitals and lab results by patient (HAPI FHIR sandbox)
- `get_medications` — active medication list by patient (HAPI FHIR sandbox)
- HIPAA disclaimer in all healthcare tool descriptions and README

**Package**
- `npx mcp-suite` cold-install support
- Full TypeScript types exported for library consumers
- Domain module export (`mcp-suite/domains/*`) for custom server composition

---

## Version History

| Version | Date | Summary |
|---------|------|---------|
| 1.0.0 | 2026-05-XX | Initial release |

---

## Planned (v1.1)

- HTTP transport: multi-client session isolation
- Redis-backed distributed cache (replaces node-cache for hosted API)
- Web3: wash trade detection signal on NFT sales
- Web3: Infura as Alchemy fallback RPC
- Financial: Alpha Vantage premium tier support with higher rate limits
- Healthcare: SMART on FHIR OAuth 2.0 token refresh helper
- DevTools: GitLab support alongside GitHub
- Dashboard UI (v0.1): deploy agent workers, view tool call metrics
