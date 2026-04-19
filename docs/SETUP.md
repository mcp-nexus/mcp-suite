# Developer Setup & Onboarding Guide — Production MCP Server Toolkit

**Last updated:** 2026-04-19

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| npm | 10+ | Comes with Node 20 |
| Git | Any | Pre-installed on most systems |
| Claude Desktop | Latest | For end-to-end testing |

Optional but recommended:
- `nvm` — manage multiple Node versions
- VS Code with the ESLint and Prettier extensions

---

## 1. Clone and Install

```bash
git clone https://github.com/ayenisholah/mcp-suite.git
cd mcp-suite
npm install
```

---

## 2. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in the values you have. The server starts with missing domains disabled — you don't need all API keys to get started.

**Minimum for financial domain:**

```bash
ALPHA_VANTAGE_API_KEY=your_key_here   # Free at alphavantage.co
AUTH_DISABLED=true                     # Skip JWT for local dev
```

**Minimum for Web3 domain:**

```bash
ALCHEMY_API_KEY=your_key_here         # Free at alchemy.com
OPENSEA_API_KEY=your_key_here         # Free at opensea.io/developers
AUTH_DISABLED=true
```

**Minimum for developer tools domain:**

```bash
GITHUB_TOKEN=ghp_your_token_here      # Create at github.com/settings/tokens
AUTH_DISABLED=true                     # repo:read scope is enough
```

**Healthcare domain works with no keys** — it connects to the public HAPI FHIR sandbox.

See `docs/ENV_CONFIG.md` for a full reference of every variable.

---

## 3. Build

```bash
npm run build
```

This compiles TypeScript to `dist/`. Run after any source changes before testing with Claude Desktop.

For development with auto-rebuild on save:

```bash
npm run dev
```

---

## 4. Test the Server Locally

### Verify it starts

```bash
node dist/index.js
# Should print: MCP Server started | Active domains: [financial, devtools]
```

### List available tools

```bash
npx ts-node src/index.ts list-tools
```

Output:

```
[financial]
  get_stock_quote        Returns current price and volume for a stock ticker
  get_forex_rate         Returns current exchange rate between two currencies
  get_crypto_price       Returns current price and market data for a cryptocurrency
  get_market_news        Returns recent news headlines with sentiment scores

[devtools]
  get_repo_stats         Returns GitHub repository activity metrics
  summarize_pr           Returns a structured pull request summary
  get_pipeline_status    Returns latest GitHub Actions workflow runs
  get_deployment_health  Returns active deployment status

[healthcare] (no API key required)
  lookup_patient         Search for patients by demographic (sandbox/synthetic data only)
  get_observations       Returns clinical observations for a patient
  get_medications        Returns active medication list for a patient
```

---

## 5. Connect to Claude Desktop

### Step 1 — Find your Claude Desktop config file

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

### Step 2 — Add the server

```json
{
  "mcpServers": {
    "mcp-suite": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-suite/dist/index.js"],
      "env": {
        "ALPHA_VANTAGE_API_KEY": "your_key",
        "GITHUB_TOKEN": "your_token",
        "AUTH_DISABLED": "true"
      }
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path from `pwd` in your project directory.

### Step 3 — Restart Claude Desktop

Quit and reopen Claude Desktop. The tools should appear when you open a new conversation.

### Step 4 — Test

Try these prompts:
- "What's the current price of NVDA?"
- "Show me repo stats for vercel/next.js"
- "Look up patients named Smith in the FHIR sandbox"

---

## 6. Run Tests

```bash
# Unit tests
npm test

# Unit tests with coverage
npm run test:coverage

# Integration tests (hits real APIs — run sparingly)
RUN_INTEGRATION=true npm test

# Type check only (no compilation)
npm run typecheck

# Lint
npm run lint
```

**Note:** Integration tests require the relevant API keys in `.env`. They are excluded from CI by default to preserve free-tier quotas.

---

## 7. Development Workflow

### File watching + auto-rebuild

```bash
npm run dev
```

Uses `tsc --watch`. Changes compile automatically. Restart Claude Desktop after each rebuild to pick up changes (or use HTTP transport mode — see below).

### HTTP transport mode (faster iteration)

Instead of restarting Claude Desktop on every change, run in HTTP mode and point a test agent at it:

```bash
MCP_TRANSPORT=http MCP_PORT=3001 AUTH_DISABLED=true node dist/index.js
```

Then hit it with curl for quick testing:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/tools
```

### Making a tool call via curl (HTTP mode)

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_stock_quote",
      "arguments": { "ticker": "NVDA" }
    },
    "id": 1
  }'
```

---

## 8. Project Structure Quick Reference

```
src/
├── index.ts              # Entry point (CLI flags, transport setup)
├── server.ts             # MCP server registration
├── config.ts             # Env var validation
├── auth/
│   ├── middleware.ts      # JWT validation
│   └── tokens.ts          # Token generation
├── domains/
│   ├── financial/         # Alpha Vantage + CoinGecko
│   ├── web3/              # Alchemy + OpenSea + Blur
│   ├── devtools/          # GitHub
│   └── healthcare/        # FHIR R4
└── shared/
    ├── cache.ts           # LRU + TTL cache
    ├── rate-limiter.ts    # Token bucket per domain
    ├── logger.ts          # Structured JSON logger
    └── errors.ts          # Typed error classes
```

See `docs/TDD.md` for the full architecture walkthrough.

---

## 9. Adding a New Domain

1. Create `src/domains/[your-domain]/` with the standard structure: `index.ts`, `schemas.ts`, `client.ts`, `tools/`
2. Copy `src/domains/devtools/` as a reference
3. Export a `Domain` object from `index.ts` (see `TDD.md §5.1`)
4. Import and register your domain in `src/server.ts`
5. Add required env vars to `.env.example` and `docs/ENV_CONFIG.md`
6. Write unit tests in `src/domains/[your-domain]/__tests__/`
7. Add a section to `docs/API.md`

See `CONTRIBUTING.md` for PR requirements.

---

## 10. Publishing to npm

```bash
# Build first
npm run build

# Dry run (check what will be published)
npm pack --dry-run

# Publish
npm publish --access public
```

Verify after publishing:

```bash
npx mcp-suite --version
```

---

## Common Issues

**"Module not found" on startup**

Run `npm run build` — you're running from `src/` but Claude Desktop needs compiled `dist/`.

**No tools showing in Claude Desktop**

Check Claude Desktop logs: `~/Library/Logs/Claude/mcp*.log` (macOS). Usually a path issue in `claude_desktop_config.json` or a missing API key causing all domains to be disabled.

**"Token required" errors when `AUTH_DISABLED=true`**

Check that `AUTH_DISABLED=true` is set in the same env block where the server runs — either in `.env` or inline in `claude_desktop_config.json`'s `env` object.

**HAPI FHIR sandbox slow or unresponsive**

The public sandbox occasionally has high latency. Check `https://hapi.fhir.org` status. Healthcare tools will return `UPSTREAM_ERROR` when the sandbox is down — this is expected behavior, not a bug.
