# Environment Configuration Reference — Production MCP Server Toolkit

**Last updated:** 2026-04-19

---

## How to Configure

1. Copy `.env.example` to `.env` in the project root
2. Fill in the values for the domains you want to enable
3. The server starts cleanly with missing domain keys — those domains are simply disabled

**Never commit `.env`** — it is in `.gitignore`. Only `.env.example` is committed.

---

## Variable Reference

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MCP_JWT_SECRET` | Yes (prod) | — | Secret key for signing and verifying JWTs. Min 32 characters. Generate with: `openssl rand -hex 32`. Server refuses to start in production mode without this. |
| `AUTH_DISABLED` | No | `false` | Set to `true` to skip JWT validation. **For local development only.** Server logs a visible warning at startup when this is true. Never set in production. |

**How to get `MCP_JWT_SECRET`:**

```bash
openssl rand -hex 32
# Example output: a3f9c2e1b4d8f7a6c5e2d1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0
```

---

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MCP_TRANSPORT` | No | `stdio` | Transport mode. `stdio` for Claude Desktop / local agents. `http` for remote/hosted API. |
| `MCP_PORT` | No | `3000` | HTTP port. Only used when `MCP_TRANSPORT=http`. |
| `NODE_ENV` | No | `development` | Set to `production` on hosted deployments. Affects error verbosity and auth enforcement. |
| `LOG_LEVEL` | No | `info` | Log verbosity. Options: `debug` \| `info` \| `warn` \| `error`. Use `warn` in production to reduce log volume. |

---

### Domain: Financial Markets

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ALPHA_VANTAGE_API_KEY` | Yes* | — | API key for Alpha Vantage. Powers `get_stock_quote`, `get_forex_rate`, `get_market_news`. Free tier: 25 requests/day. Get a key at [alphavantage.co](https://alphavantage.co/support/#api-key). If not set, financial domain is disabled. |
| `COINGECKO_API_KEY` | No | — | Optional CoinGecko API key. Free tier works without a key (rate-limited but sufficient for demos). Pro key increases rate limits. Get at [coingecko.com/api](https://coingecko.com/en/api). |

*Required to enable the financial domain. Omit to disable it.

**Free vs. premium:**

| Plan | Requests/day | Notes |
|------|-------------|-------|
| Alpha Vantage Free | 25 | Sufficient for demos; will exhaust in sustained use |
| Alpha Vantage Premium | 75–1,200/min | Required for hosted API with real users |
| CoinGecko Free | ~30/min (no key) | Adequate for most use cases |

---

### Domain: Web3 / DeFi

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ALCHEMY_API_KEY` | Yes* | — | Alchemy API key for Ethereum, Base, and Arbitrum RPC access and NFT data. Powers `get_wallet_balances`, `get_amm_reserves`, `get_dex_liquidity`. Free tier: 300M compute units/month. Get at [alchemy.com](https://alchemy.com). |
| `OPENSEA_API_KEY` | Yes* | — | OpenSea API key for NFT collection and sales data. Powers `get_nft_floor`, `get_nft_recent_sales`. Get at [docs.opensea.io](https://docs.opensea.io/reference/api-keys). |
| `BLUR_API_KEY` | No | — | Blur marketplace API key. Optional — if not set, `get_nft_floor` returns OpenSea-only data with a note indicating Blur is unavailable. Get at [blur.io/developer](https://blur.io). |
| `ETH_RPC_URL` | No | Alchemy default | Override Ethereum RPC URL (e.g., to use Infura or a private node). Default: constructed from `ALCHEMY_API_KEY`. |
| `BASE_RPC_URL` | No | Alchemy default | Override Base chain RPC URL. |
| `ARBITRUM_RPC_URL` | No | Alchemy default | Override Arbitrum RPC URL. |

*Both `ALCHEMY_API_KEY` and `OPENSEA_API_KEY` required to enable the Web3 domain.

---

### Domain: Developer Tools

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | Yes* | — | GitHub Personal Access Token with `repo:read` scope. Powers all developer tools. Required for private repo access and higher rate limits (5,000 req/hr vs 60/hr unauthenticated). Create at [github.com/settings/tokens](https://github.com/settings/tokens) → Tokens (classic) → `repo` scope. |

*Required to enable the developer tools domain. Without a token, GitHub rate limits are severely restrictive (60 req/hr) and the domain is disabled.

**Minimum token permissions:**

```
repo → read:repo   (public and private repo data)
```

Do not grant write permissions — the server only reads data.

---

### Domain: Healthcare (FHIR)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FHIR_BASE_URL` | No | `https://hapi.fhir.org/baseR4` | Base URL of the FHIR R4 server. Default is the public HAPI FHIR sandbox (synthetic data, no PHI). Override with your organization's FHIR endpoint for production use. |
| `FHIR_AUTH_TOKEN` | No | — | Bearer token for FHIR server authentication. Not required for the public HAPI sandbox. Required for production EHR endpoints (Epic, Cerner, Azure FHIR). See SMART on FHIR OAuth 2.0 docs for your vendor. |

**Healthcare domain requires no keys to start** — the public sandbox is accessible without credentials.

**For production EHR access:**
1. Replace `FHIR_BASE_URL` with your EHR vendor's FHIR endpoint
2. Obtain OAuth 2.0 SMART on FHIR credentials from your vendor
3. Configure `FHIR_AUTH_TOKEN` with a valid access token (or implement token refresh in `healthcare/client.ts`)
4. Ensure you have a signed Business Associate Agreement (BAA) before processing real PHI

---

## Complete `.env.example`

```bash
# ── Authentication ────────────────────────────────────────────
# Required in production. Generate: openssl rand -hex 32
MCP_JWT_SECRET=

# Set to true for local development only. Never use in production.
AUTH_DISABLED=false

# ── Server ────────────────────────────────────────────────────
# stdio (default, for Claude Desktop) or http (for remote/hosted)
MCP_TRANSPORT=stdio

# Only used when MCP_TRANSPORT=http
MCP_PORT=3000

# debug | info | warn | error
LOG_LEVEL=info

# ── Financial Markets Domain ──────────────────────────────────
# Free: 25 req/day | https://alphavantage.co/support/#api-key
ALPHA_VANTAGE_API_KEY=

# Optional — free tier works without a key
COINGECKO_API_KEY=

# ── Web3 / DeFi Domain ───────────────────────────────────────
# https://dashboard.alchemyapi.io
ALCHEMY_API_KEY=

# https://docs.opensea.io/reference/api-keys
OPENSEA_API_KEY=

# Optional — NFT floor falls back to OpenSea-only without this
BLUR_API_KEY=

# Override RPC URLs (optional — defaults use ALCHEMY_API_KEY)
# ETH_RPC_URL=
# BASE_RPC_URL=
# ARBITRUM_RPC_URL=

# ── Developer Tools Domain ────────────────────────────────────
# repo:read scope | https://github.com/settings/tokens
GITHUB_TOKEN=

# ── Healthcare Domain (no keys required for sandbox) ─────────
# Default: https://hapi.fhir.org/baseR4 (synthetic data, no PHI)
# FHIR_BASE_URL=https://hapi.fhir.org/baseR4
# FHIR_AUTH_TOKEN=
```

---

## Startup Behavior by Configuration

| Keys Present | Domains Active |
|-------------|---------------|
| None | Healthcare only |
| `ALPHA_VANTAGE_API_KEY` only | Financial + Healthcare |
| `GITHUB_TOKEN` only | DevTools + Healthcare |
| `ALCHEMY_API_KEY` + `OPENSEA_API_KEY` only | Web3 + Healthcare |
| All keys | Financial + Web3 + DevTools + Healthcare |

Missing domain keys produce a startup warning:

```
[WARN] Financial domain disabled — ALPHA_VANTAGE_API_KEY not set
[WARN] Web3 domain disabled — ALCHEMY_API_KEY not set
[INFO] Active domains: healthcare, devtools
```
