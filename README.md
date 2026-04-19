# mcp-suite

A production-grade TypeScript MCP server that gives AI agents (Claude Desktop, Cursor, Windsurf, custom agents) structured access to real-world data across four domains: **financial markets**, **Web3/DeFi**, **developer tools**, and **healthcare (FHIR)**.

- Auth-first — JWT validation enabled by default
- Domain isolation — missing API keys disable one domain, not the whole server
- Response cache (LRU + TTL) and token-bucket rate limiting per domain
- Typed schemas (Zod) on every tool input and output
- Two transports: stdio (local) and HTTP + SSE (remote/hosted)

---

## Quick Start

```bash
# Run directly (no global install required)
npx mcp-suite

# Or install globally
npm install -g mcp-suite
mcp-suite
```

**Requirements:** Node.js ≥ 20, npm ≥ 10

---

## Installation

### 1. Set up environment variables

Copy `.env.example` to `.env` and fill in the keys for the domains you want to enable:

```bash
cp .env.example .env
```

```env
# Authentication (required in production)
MCP_JWT_SECRET=your-secret-here

# Financial Markets (Alpha Vantage + CoinGecko)
ALPHA_VANTAGE_API_KEY=

# Web3 / DeFi (Alchemy + OpenSea + Blur)
ALCHEMY_API_KEY=
OPENSEA_API_KEY=

# Developer Tools (GitHub)
GITHUB_TOKEN=

# Healthcare / FHIR (optional — defaults to public HAPI sandbox)
FHIR_BASE_URL=https://hapi.fhir.org/baseR4

# Server
LOG_LEVEL=info         # debug | info | warn | error
MCP_PORT=3000          # HTTP transport only
AUTH_DISABLED=false    # set true for local dev only
```

You only need keys for the domains you use. Domains with missing keys are silently disabled at startup.

### 2. Generate a development token

```bash
npx mcp-suite gen-token
# eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Add to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "mcp-suite": {
      "command": "npx",
      "args": ["mcp-suite"],
      "env": {
        "MCP_JWT_SECRET": "your-secret-here",
        "ALPHA_VANTAGE_API_KEY": "...",
        "ALCHEMY_API_KEY": "...",
        "OPENSEA_API_KEY": "...",
        "GITHUB_TOKEN": "..."
      }
    }
  }
}
```

### 4. Start as HTTP server (remote/hosted deployments)

```bash
npx mcp-suite --transport http --port 3000
```

This exposes `GET /health`, `GET /tools`, and the SSE endpoint for remote MCP clients.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `npx mcp-suite` | Start server (stdio transport, default) |
| `npx mcp-suite --transport http` | Start HTTP + SSE server |
| `npx mcp-suite gen-token` | Generate a development JWT |
| `npx mcp-suite list-tools` | Print all active tools grouped by domain |

---

## Available Tools

### Financial Markets

Powered by [Alpha Vantage](https://www.alphavantage.co/) and [CoinGecko](https://www.coingecko.com/).  
Requires: `ALPHA_VANTAGE_API_KEY`

| Tool | Description |
|------|-------------|
| `get_stock_quote` | US equity price, volume, change % |
| `get_forex_rate` | Currency pair exchange rate (ISO 4217) |
| `get_crypto_price` | Crypto price, market cap, 24h change |
| `get_market_news` | Financial headlines with sentiment scores |

**Example:**
```json
{ "tool": "get_stock_quote", "arguments": { "ticker": "NVDA" } }
```

---

### Web3 / DeFi

Powered by [Alchemy](https://www.alchemy.com/), [OpenSea](https://opensea.io/), and [Blur](https://blur.io/).  
Requires: `ALCHEMY_API_KEY`, `OPENSEA_API_KEY`

| Tool | Description |
|------|-------------|
| `get_nft_floor` | Best floor across OpenSea + Blur (ETH, Base, Arbitrum) |
| `get_nft_recent_sales` | Last N sales with traits and marketplace |
| `get_wallet_balances` | Multi-chain token + NFT holdings, ENS resolution |
| `get_amm_reserves` | Uniswap V2/V3 pool reserves and price ratio |
| `get_dex_liquidity` | Trade slippage estimates per size |

**Example:**
```json
{ "tool": "get_nft_floor", "arguments": { "collection_slug": "boredapeyachtclub" } }
```

---

### Developer Tools

Powered by the [GitHub API](https://docs.github.com/en/rest).  
Requires: `GITHUB_TOKEN`

| Tool | Description |
|------|-------------|
| `get_repo_stats` | Stars, forks, issues, language, last commit |
| `summarize_pr` | PR diff summary, reviewers, CI checks, merge status |
| `get_pipeline_status` | Latest GitHub Actions runs per branch |
| `get_deployment_health` | Active deployment URL and status |

**Example:**
```json
{ "tool": "get_pipeline_status", "arguments": { "repo": "vercel/next.js", "branch": "canary" } }
```

---

### Healthcare (FHIR)

Powered by [HAPI FHIR R4](https://hapi.fhir.org/).  
Requires: nothing (defaults to public sandbox) or `FHIR_BASE_URL` for custom endpoints.

> **HIPAA Notice:** All healthcare tools connect to a **public sandbox with synthetic data only**. No real patient health information (PHI) is accessed. For production use, replace `FHIR_BASE_URL` with a HIPAA-compliant EHR endpoint and configure appropriate SMART on FHIR OAuth 2.0 credentials.

| Tool | Description |
|------|-------------|
| `lookup_patient` | Demographic patient search |
| `get_observations` | Vitals and lab results by patient |
| `get_medications` | Active medication list by patient |

**Example:**
```json
{ "tool": "lookup_patient", "arguments": { "name": "Smith", "birth_date": "1980-01-15" } }
```

---

## Authentication

Authentication is **enabled by default**. Every tool call must carry a valid JWT.

### Production

Set `MCP_JWT_SECRET` to a strong secret. The server refuses to start in production mode without it.

### Development

**Option A — disable auth entirely (local only):**
```env
AUTH_DISABLED=true
```

**Option B — use a dev JWT:**
```bash
npx mcp-suite gen-token
```
Pass the generated token in the MCP request `_meta` field (stdio) or the `Authorization: Bearer` header (HTTP).

### JWT structure

```json
{
  "sub": "your-client-id",
  "scope": "mcp:tools",
  "iat": 1713484800,
  "exp": 1716076800
}
```

---

## Architecture

```
MCP Clients (Claude Desktop · Cursor · Windsurf · Custom Agents)
        │  MCP Protocol
┌───────▼────────────────────────────────────────┐
│  Transport Layer  (stdio  |  HTTP + SSE)        │
├────────────────────────────────────────────────┤
│  Auth Middleware  (JWT validation / bypass)     │
├────────────────────────────────────────────────┤
│  Tool Registry    (register · list · route)     │
├──────────┬──────────┬──────────┬───────────────┤
│Financial │  Web3    │ DevTools │  Healthcare   │
├──────────┴──────────┴──────────┴───────────────┤
│  Shared: Rate Limiter · Cache · Logger · Errors │
└─────────────────────────────────────────────────┘
         │           │          │          │
   Alpha Vantage  Alchemy   GitHub API  HAPI FHIR
   CoinGecko      OpenSea
                  Blur
```

- **Caching:** LRU + TTL in-process cache (node-cache). TTLs are domain-appropriate (15s for crypto, 300s for GitHub repo stats).
- **Rate limiting:** Token-bucket per domain protects free-tier API quotas.
- **Error types:** `AuthError`, `ValidationError`, `DomainUnavailableError`, `UpstreamError`, `RateLimitError` — all produce structured MCP error responses.
- **Logging:** Structured JSON on every tool call: domain, tool name, latency, cache hit, status.

---

## Adding a Domain

Each domain follows the same pattern. To add a new domain:

1. Create `src/domains/[name]/` with `index.ts`, `schemas.ts`, `client.ts`, and `tools/`
2. Export a `Domain` object:

```typescript
export const myDomain: Domain = {
  name: 'my-domain',
  isAvailable: () => !!config.MY_API_KEY,
  registerTools: (server) => { /* server.tool(...) calls */ }
}
```

3. Register it in `src/server.ts`
4. Document tools in `docs/API.md`

See `docs/TDD.md §5` and `docs/CODING_STANDARDS.md` for the full pattern.

---

## Development

```bash
git clone https://github.com/ayenisholah/mcp-suite.git
cd mcp-suite
npm install
cp .env.example .env   # fill in your API keys

npm run build          # compile TypeScript → dist/
npm run dev            # watch mode
npm run typecheck      # type check without emit
npm run lint           # ESLint
npm test               # unit tests (Vitest)
npm run test:coverage  # tests + coverage report

# Integration tests — hits real APIs, requires .env keys
RUN_INTEGRATION=true npm test
```

---

## HTTP Transport Endpoints

When running with `--transport http`:

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /health` | No | Per-domain availability status |
| `GET /tools` | Yes | All registered tools, grouped by domain |
| `POST /mcp` | Yes | MCP protocol endpoint (SSE) |

---

## Error Reference

| Code | Description |
|------|-------------|
| `AUTH_ERROR` | JWT missing, expired, or invalid signature |
| `VALIDATION_ERROR` | Input failed Zod schema validation |
| `DOMAIN_UNAVAILABLE` | Domain API key not configured at startup |
| `RATE_LIMITED` | Per-domain rate limit exceeded |
| `UPSTREAM_ERROR` | External API returned an error or timed out |

---

## License

MIT — see [LICENSE](LICENSE)

---

## Contributing

Issues and PRs welcome. Please read `docs/CODING_STANDARDS.md` before submitting.
