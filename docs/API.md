# API Documentation — Production MCP Server Toolkit

**Version:** 1.0  
**Last updated:** 2026-04-19

---

## Overview

The MCP Server Toolkit exposes tools via the **Model Context Protocol (MCP)**. Clients (Claude Desktop, Cursor, Windsurf, custom agents) communicate via either:

- **stdio transport** — default for local use; server is spawned as a subprocess
- **HTTP + SSE transport** — for remote/hosted deployments; starts on `MCP_PORT` (default 3000)

In HTTP mode, two additional REST endpoints are available: `/health` and `/tools`.

---

## Authentication

All tool calls require a valid JWT unless `AUTH_DISABLED=true`.

### Token format

```
Authorization: Bearer <jwt>
```

In stdio mode, the token is passed via MCP request `_meta`:

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_stock_quote",
    "arguments": { "ticker": "NVDA" },
    "_meta": { "authorization": "Bearer eyJ..." }
  }
}
```

In HTTP mode, the token is in the standard `Authorization` header.

### Generate a token (development)

```bash
npx mcp-suite gen-token
# Output: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Error responses

| Code | Message |
|------|---------|
| `AUTH_ERROR` | `Token required` |
| `AUTH_ERROR` | `Token expired. Run npx mcp-suite gen-token to refresh.` |
| `AUTH_ERROR` | `Token signature invalid. Check MCP_JWT_SECRET.` |

---

## HTTP-Only Endpoints (HTTP transport)

### `GET /health`

Returns server and per-domain availability status.

**Response 200:**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "domains": {
    "financial": "active",
    "web3": "active",
    "devtools": "disabled",
    "healthcare": "active"
  }
}
```

**Response 503** (no domains active):

```json
{
  "status": "degraded",
  "domains": {
    "financial": "disabled",
    "web3": "disabled",
    "devtools": "disabled",
    "healthcare": "disabled"
  }
}
```

Domain statuses: `active` | `disabled` (missing API key) | `degraded` (circuit breaker open)

---

### `GET /tools`

Lists all registered tools, grouped by domain. Requires auth.

**Response 200:**

```json
{
  "count": 14,
  "domains": {
    "financial": [
      {
        "name": "get_stock_quote",
        "description": "Returns current price, volume, and change % for a US stock ticker.",
        "input_schema": { "type": "object", "properties": { "ticker": { "type": "string" } }, "required": ["ticker"] }
      }
    ],
    "web3": [ ... ],
    "devtools": [ ... ],
    "healthcare": [ ... ]
  }
}
```

---

## MCP Tools Reference

### Domain: Financial Markets

---

#### `get_stock_quote`

Returns current price data for a US equity ticker.

**Input:**

```json
{
  "ticker": "NVDA"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticker` | string | yes | Stock ticker symbol (e.g. `AAPL`, `TSLA`) |

**Output:**

```json
{
  "ticker": "NVDA",
  "price": 875.40,
  "change": 12.30,
  "change_pct": 1.43,
  "volume": 42100000,
  "market_cap": 2150000000000,
  "currency": "USD",
  "as_of": "2026-04-19T15:59:00Z"
}
```

**Errors:** `VALIDATION_ERROR` (invalid ticker), `UPSTREAM_ERROR` (Alpha Vantage down), `RATE_LIMITED`

**Cache TTL:** 60 seconds

---

#### `get_forex_rate`

Returns the current exchange rate between two currencies.

**Input:**

```json
{
  "from": "USD",
  "to": "EUR"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | string | yes | Source currency (ISO 4217, e.g. `USD`) |
| `to` | string | yes | Target currency (ISO 4217, e.g. `EUR`) |

**Output:**

```json
{
  "from": "USD",
  "to": "EUR",
  "rate": 0.9234,
  "change_24h_pct": -0.12,
  "as_of": "2026-04-19T16:00:00Z"
}
```

**Cache TTL:** 30 seconds

---

#### `get_crypto_price`

Returns current price and market data for a cryptocurrency.

**Input:**

```json
{
  "symbol": "BTC"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | string | yes | Coin symbol (e.g. `BTC`, `ETH`, `SOL`) |

**Output:**

```json
{
  "symbol": "BTC",
  "name": "Bitcoin",
  "price_usd": 68420.50,
  "market_cap_usd": 1347000000000,
  "change_24h_pct": 2.14,
  "volume_24h_usd": 31000000000,
  "rank": 1,
  "as_of": "2026-04-19T16:00:00Z"
}
```

**Cache TTL:** 15 seconds

---

#### `get_market_news`

Returns recent financial news headlines with sentiment scores.

**Input:**

```json
{
  "ticker": "NVDA",
  "sentiment": "bullish",
  "limit": 5
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticker` | string | no | Filter by ticker (omit for general market news) |
| `sentiment` | `"bullish" \| "bearish" \| "neutral"` | no | Filter by sentiment |
| `limit` | number | no | Number of articles (default: 10, max: 50) |

**Output:**

```json
{
  "articles": [
    {
      "title": "Nvidia beats earnings estimates for Q1 2026",
      "source": "Reuters",
      "url": "https://reuters.com/...",
      "published_at": "2026-04-18T14:00:00Z",
      "sentiment": "bullish",
      "sentiment_score": 0.82,
      "tickers_mentioned": ["NVDA"]
    }
  ],
  "as_of": "2026-04-19T16:00:00Z"
}
```

**Cache TTL:** 300 seconds

---

### Domain: Web3 / DeFi

---

#### `get_nft_floor`

Returns the best floor price for an NFT collection across OpenSea and Blur.

**Input:**

```json
{
  "collection_slug": "boredapeyachtclub",
  "chain": "ethereum"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `collection_slug` | string | yes | OpenSea collection slug |
| `chain` | `"ethereum" \| "base" \| "arbitrum"` | no | Defaults to `ethereum` |

**Output:**

```json
{
  "collection": "boredapeyachtclub",
  "chain": "ethereum",
  "floor_opensea_eth": 12.4,
  "floor_blur_eth": 12.1,
  "best_floor_eth": 12.1,
  "best_floor_usd": 828240,
  "best_floor_source": "blur",
  "as_of": "2026-04-19T16:00:00Z"
}
```

**Cache TTL:** 30 seconds

---

#### `get_nft_recent_sales`

Returns recent NFT sales for a collection.

**Input:**

```json
{
  "collection_slug": "boredapeyachtclub",
  "limit": 10
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `collection_slug` | string | yes | OpenSea collection slug |
| `limit` | number | no | Number of sales (default: 10, max: 50) |

**Output:**

```json
{
  "collection": "boredapeyachtclub",
  "sales": [
    {
      "token_id": "4211",
      "price_eth": 13.5,
      "price_usd": 922050,
      "traits": { "background": "Army Green", "hat": "Beanie" },
      "buyer": "0xabc...123",
      "seller": "0xdef...456",
      "marketplace": "blur",
      "sale_time": "2026-04-19T15:45:00Z"
    }
  ]
}
```

---

#### `get_wallet_balances`

Returns token and NFT holdings for a wallet address across chains.

**Input:**

```json
{
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "chain": "ethereum"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | string | yes | Wallet address or ENS name |
| `chain` | `"ethereum" \| "base" \| "arbitrum" \| "all"` | no | Defaults to `all` |

**Output:**

```json
{
  "address": "0xd8dA...",
  "ens": "vitalik.eth",
  "chains": {
    "ethereum": {
      "tokens": [
        { "symbol": "ETH", "balance": "12.45", "value_usd": 37352 },
        { "symbol": "USDC", "balance": "5000.00", "value_usd": 5000 }
      ],
      "nfts": [
        { "collection": "CryptoPunks", "token_id": "7804", "floor_eth": 45.2 }
      ]
    }
  }
}
```

**Cache TTL:** 30 seconds

---

#### `get_amm_reserves`

Returns current liquidity reserves for a Uniswap V2 or V3 pool.

**Input:**

```json
{
  "pool_address": "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
  "chain": "ethereum"
}
```

**Output:**

```json
{
  "pool": "0x88e6...",
  "protocol": "uniswap_v3",
  "chain": "ethereum",
  "token0": { "symbol": "USDC", "reserve": "45000000.00" },
  "token1": { "symbol": "ETH", "reserve": "1500.42" },
  "price_token1_in_token0": 29990.12,
  "fee_tier": 500,
  "as_of": "2026-04-19T16:00:00Z"
}
```

**Cache TTL:** 15 seconds

---

#### `get_dex_liquidity`

Returns liquidity depth and estimated slippage for a token trade.

**Input:**

```json
{
  "token_address": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  "trade_size_usd": 10000,
  "chain": "ethereum"
}
```

**Output:**

```json
{
  "token": "WETH",
  "trade_size_usd": 10000,
  "estimated_slippage_pct": 0.08,
  "price_impact_pct": 0.05,
  "best_route": "Uniswap V3 WETH/USDC 0.05%",
  "chain": "ethereum",
  "warning": null
}
```

If slippage > 3%, `warning` includes: `"High slippage: consider splitting into smaller trades."`

---

### Domain: Developer Tools

---

#### `get_repo_stats`

Returns GitHub repository activity metrics.

**Input:**

```json
{
  "repo": "vercel/next.js"
}
```

**Output:**

```json
{
  "repo": "vercel/next.js",
  "stars": 124500,
  "forks": 26700,
  "open_issues": 2340,
  "primary_language": "TypeScript",
  "last_commit_at": "2026-04-19T12:00:00Z",
  "license": "MIT",
  "topics": ["react", "nextjs", "javascript"]
}
```

**Cache TTL:** 300 seconds

---

#### `summarize_pr`

Returns a structured summary of a GitHub pull request.

**Input:**

```json
{
  "repo": "vercel/next.js",
  "pr_number": 71234
}
```

**Output:**

```json
{
  "number": 71234,
  "title": "feat: add React 19 concurrent rendering support",
  "state": "open",
  "author": "leerob",
  "reviewers": [{ "user": "timneutkens", "status": "approved" }],
  "ci_checks": [
    { "name": "test", "status": "success" },
    { "name": "lint", "status": "success" }
  ],
  "files_changed": 14,
  "additions": 342,
  "deletions": 89,
  "created_at": "2026-04-17T09:00:00Z",
  "mergeable": true
}
```

---

#### `get_pipeline_status`

Returns latest GitHub Actions workflow runs for a repo.

**Input:**

```json
{
  "repo": "vercel/next.js",
  "branch": "canary"
}
```

**Output:**

```json
{
  "repo": "vercel/next.js",
  "branch": "canary",
  "runs": [
    {
      "workflow": "CI",
      "run_id": 9876543,
      "status": "completed",
      "conclusion": "success",
      "started_at": "2026-04-19T11:00:00Z",
      "finished_at": "2026-04-19T11:08:00Z",
      "url": "https://github.com/vercel/next.js/actions/runs/9876543"
    }
  ]
}
```

---

#### `get_deployment_health`

Returns active deployment status for a repository environment.

**Input:**

```json
{
  "repo": "your-org/your-app",
  "environment": "production"
}
```

**Output:**

```json
{
  "repo": "your-org/your-app",
  "environment": "production",
  "status": "active",
  "deployed_at": "2026-04-19T10:00:00Z",
  "url": "https://your-app.com",
  "deployed_by": "github-actions[bot]",
  "sha": "a1b2c3d"
}
```

---

### Domain: Healthcare (FHIR)

> **Note:** All healthcare tools connect to the public HAPI FHIR R4 sandbox at `https://hapi.fhir.org/baseR4`. Data is entirely synthetic — no real patient health information (PHI). For production use, replace `FHIR_BASE_URL` with a HIPAA-compliant EHR endpoint and configure appropriate OAuth 2.0 SMART on FHIR credentials.

---

#### `lookup_patient`

Searches for patients in the FHIR server by demographic.

**Input:**

```json
{
  "name": "Smith",
  "birth_date": "1980-01-15",
  "limit": 5
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | Patient family or given name |
| `birth_date` | string | no | ISO 8601 date (`YYYY-MM-DD`) |
| `identifier` | string | no | Patient identifier (MRN, etc.) |
| `limit` | number | no | Max results (default: 10, max: 20) |

**Output:**

```json
{
  "patients": [
    {
      "patient_id": "592821",
      "name": "John Smith",
      "birth_date": "1980-01-15",
      "gender": "male",
      "active": true
    }
  ],
  "note": "FHIR sandbox data only — synthetic patients, no real PHI"
}
```

---

#### `get_observations`

Returns clinical observations (vitals or labs) for a patient.

**Input:**

```json
{
  "patient_id": "592821",
  "category": "vital-signs",
  "limit": 10
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `patient_id` | string | yes | FHIR Patient resource ID |
| `category` | `"vital-signs" \| "laboratory" \| "survey"` | no | Observation category filter |
| `code` | string | no | LOINC code filter (e.g. `8867-4` for heart rate) |
| `limit` | number | no | Max results (default: 20, max: 100) |

**Output:**

```json
{
  "patient_id": "592821",
  "observations": [
    {
      "observation_id": "obs-12345",
      "code": "8867-4",
      "display": "Heart rate",
      "value": 72,
      "unit": "beats/minute",
      "reference_range": "60-100",
      "status": "final",
      "effective_time": "2026-04-15T08:30:00Z"
    }
  ]
}
```

---

#### `get_medications`

Returns the active medication list for a patient.

**Input:**

```json
{
  "patient_id": "592821",
  "status": "active"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `patient_id` | string | yes | FHIR Patient resource ID |
| `status` | `"active" \| "stopped" \| "completed"` | no | Defaults to `active` |

**Output:**

```json
{
  "patient_id": "592821",
  "medications": [
    {
      "medication_id": "med-9876",
      "name": "Metformin 500 MG Oral Tablet",
      "rxnorm_code": "861007",
      "dosage": "500 mg",
      "route": "oral",
      "frequency": "twice daily",
      "status": "active",
      "start_date": "2024-06-01"
    }
  ]
}
```

---

## Common Error Codes

| Code | HTTP Status (HTTP mode) | Description |
|------|------------------------|-------------|
| `AUTH_ERROR` | 401 | Authentication failed |
| `VALIDATION_ERROR` | 400 | Input failed schema validation |
| `DOMAIN_UNAVAILABLE` | 503 | Domain API key not configured |
| `RATE_LIMITED` | 429 | Per-domain rate limit exceeded |
| `UPSTREAM_ERROR` | 502 | External API returned an error or timed out |
| `NOT_FOUND` | 404 | Resource not found (invalid ticker, unknown patient, etc.) |

**Error response shape (MCP):**

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Financial domain rate limit exceeded. Resets in 18 hours.",
    "domain": "financial"
  }
}
```
