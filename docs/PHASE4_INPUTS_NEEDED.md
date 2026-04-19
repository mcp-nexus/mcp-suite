# Inputs Needed Before Phase 4–7

Phases 0–3 are complete and verified:
- ✅ Tooling: tsconfig, eslint, vitest, prettier, husky
- ✅ Shared: errors, logger, cache, rate-limiter (24 unit tests passing)
- ✅ Auth: JWT middleware + gen-token (6 tests passing)
- ✅ Server core: config, server, http-server, index (build clean)

---

## Phase 4 — Web3 / DeFi

**Required API keys:**

| Key | Where to get it | Notes |
|-----|----------------|-------|
| `ALCHEMY_API_KEY` | https://dashboard.alchemy.com → Create App | Free tier. Select "Ethereum Mainnet". Used for wallet balances, AMM reserves, DEX liquidity. |
| `OPENSEA_API_KEY` | https://docs.opensea.io/reference/api-keys → Request API Key | May require form submission. Used for NFT floor prices and recent sales. |

**Blur API:** Blur's public endpoints are used without a key for now. No action needed.

**Confirm chain support:** The plan covers Ethereum, Base, and Arbitrum. Are you using Alchemy for all three (three separate API keys / one app with multi-chain support)?

---

## Phase 5 — Financial Markets

**Required API keys:**

| Key | Where to get it | Notes |
|-----|----------------|-------|
| `ALPHA_VANTAGE_API_KEY` | https://www.alphavantage.co/support/#api-key | Free key, instant. Covers stock quotes, forex, and market news. |

**CoinGecko** (crypto prices): uses the free public API — no key needed.

**Free tier note:** Alpha Vantage free = 25 requests/day. If you want the demo to work reliably, consider the premium tier ($50/mo) or Premium plan for higher limits.

---

## Phase 6 — Developer Tools

**Required API keys:**

| Key | Where to get it | Notes |
|-----|----------------|-------|
| `GITHUB_TOKEN` | https://github.com/settings/tokens → Generate new token (classic) | Scopes: `public_repo` for public repos only, or `repo` for private. |

---

## Phase 7 — Healthcare / FHIR

**No API keys required.**

The healthcare domain connects to the public HAPI FHIR R4 sandbox (`https://hapi.fhir.org/baseR4`). It works out of the box with no credentials.

If you want to point it at a real EHR endpoint, provide:
- `FHIR_BASE_URL` — your FHIR R4 base URL
- SMART on FHIR OAuth 2.0 credentials (Phase 7 will include a placeholder for this)

---

## What to Provide

Once you have your keys, either:

1. **Add them to `.env`** — copy `.env.example` to `.env` and fill in the values, then share which ones you have so I can build and test the right domains first.

2. **Tell me which domains to prioritize** — if you only have some keys, I'll build those domains first and leave stubs for the rest.

3. **Confirm architecture questions:**
   - Alchemy: one app covering all chains, or separate apps per chain?
   - OpenSea: do you have an approved API key, or should I use the unauthenticated/limited endpoints for now?
   - Financial: free Alpha Vantage tier (25/day) or premium?
