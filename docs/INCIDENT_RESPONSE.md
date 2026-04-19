# Incident Response Playbook — Production MCP Server Toolkit

**Last updated:** 2026-04-19

---

## Severity Levels

| Level | Definition | Response Time |
|-------|-----------|---------------|
| **P0 — Critical** | Security breach, API key leak, npm package compromised | Immediate |
| **P1 — High** | Server down, all domains unavailable | < 30 minutes |
| **P2 — Medium** | One or more domains degraded, high error rate | < 2 hours |
| **P3 — Low** | Rate limits near exhaustion, non-critical warnings | Next business day |

---

## P0: API Key or Secret Leaked

**Signs:** API key or `MCP_JWT_SECRET` appears in a public repo, log output, or error message.

### Immediate actions (within 15 minutes)

1. **Rotate the leaked credential immediately**
   - Alpha Vantage key: alphavantage.co → Account → API Key → Regenerate
   - Alchemy key: dashboard.alchemy.com → Apps → API Keys → Rotate
   - OpenSea key: opensea.io/developers → Rotate
   - GitHub token: github.com/settings/tokens → Delete, generate new
   - `MCP_JWT_SECRET`: generate new (`openssl rand -hex 32`), restart server

2. **If leaked in a public Git commit:**
   ```bash
   # Remove the commit from history (only if branch is not shared)
   git rebase -i HEAD~N  # squash or edit the commit
   
   # If already pushed to public repo:
   # - Use GitHub's secret scanning alert to confirm scope of exposure
   # - Rotate credential first, then consider history rewrite
   # - GitHub's push protection may have already blocked it
   ```

3. **Audit usage:**
   - Check Alpha Vantage/Alchemy dashboards for unexpected API call volume
   - Check GitHub audit log for unexpected repo access
   - Review server logs for unusual tool call patterns

4. **Notify:** If API keys were billed (Alchemy pro, etc.), contact the vendor to dispute unauthorized charges

5. **Update `.env.example`** to ensure the leaked value is not hardcoded anywhere as an example

---

## P0: npm Package Compromised

**Signs:** Malicious code injected via compromised npm account or dependency.

### Actions

1. **Immediately unpublish** (within 72 hours of publish):
   ```bash
   npm unpublish mcp-suite@[version]
   ```
   After 72 hours, deprecate instead:
   ```bash
   npm deprecate mcp-suite@[version] "Security issue — do not use"
   ```

2. **Rotate npm token:**
   - npmjs.com → Access Tokens → revoke all existing tokens
   - Generate new Automation token
   - Update `NPM_TOKEN` GitHub Secret

3. **Enable npm 2FA** if not already enabled

4. **Investigate:** Determine how the compromise occurred (malicious dep, account takeover, CI secret exposure)

5. **Publish a clean patched version** after investigation is complete

---

## P1: Server Down (Hosted API)

**Signs:** `/health` returns non-200, PM2 shows process `stopped` or `errored`.

### Diagnosis

```bash
# Check process status
pm2 status

# View recent error logs
pm2 logs mcp-suite --lines 100 --err

# Check if port is bound
ss -tlnp | grep 3000

# Check system resources
free -h
df -h
top -bn1 | head -20
```

### Common causes and fixes

**Process crashed on startup:**
```bash
pm2 logs mcp-suite --lines 50 --err
# Look for: missing env vars, port already in use, syntax error in dist/

# Fix: rebuild and restart
cd /opt/mcp-suite
npm run build
pm2 restart mcp-suite
```

**Port already in use:**
```bash
lsof -i :3000
kill -9 [PID]
pm2 restart mcp-suite
```

**Out of memory:**
```bash
pm2 restart mcp-suite
# Check if max_memory_restart is set correctly in ecosystem.config.js
```

**Bad deploy (code error):**
```bash
# Rollback to previous version
cd /opt/mcp-suite
git log --oneline -5
git checkout [previous-sha]
npm run build
pm2 restart mcp-suite
```

### Verify recovery

```bash
curl https://api.mcp-suite.dev/health
pm2 status
```

---

## P2: Domain Degraded (Upstream API Down or Rate Limited)

**Signs:** `/health` shows a domain as `degraded`, tool calls returning `UPSTREAM_ERROR` for a specific domain.

### Diagnosis

```bash
# Check which domain is degraded
curl https://api.mcp-suite.dev/health | jq '.domains'

# Test the upstream directly
curl "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=$ALPHA_VANTAGE_API_KEY"
```

### Domain-specific playbooks

**Financial domain — Alpha Vantage down:**
- Check: https://status.alphavantage.co
- Action: No action needed — circuit breaker handles it. Domain auto-recovers when upstream returns.
- Communicate: If impacting users, post a status update.

**Financial domain — Free tier exhausted (25 calls/day):**
- Signs: `RATE_LIMITED` error with "24 hours" retry message
- Action: Wait for daily reset (midnight UTC) OR upgrade to Alpha Vantage premium key
- Workaround: Crypto prices still work (CoinGecko free tier is much more generous)

**Web3 domain — Alchemy down:**
- Check: https://status.alchemy.com
- Action: No immediate fix; Alchemy has strong SLA. Usually resolves in < 30 minutes.
- Fallback: Consider adding Infura as backup RPC in `web3/client.ts` (v1.1 item)

**Web3 domain — OpenSea API rate limited:**
- Signs: `UPSTREAM_ERROR` on NFT tools, Blur tools still working
- Action: NFT floor tools will show Blur-only data during the outage. Update tool response to indicate partial data.
- Review: OpenSea rate limits increase with verified partner status — apply if needed.

**Healthcare domain — HAPI FHIR sandbox down:**
- Check: https://hapi.fhir.org
- Action: This is a public sandbox with no SLA — expected occasional downtime.
- Communicate: Let users know this is a sandbox limitation; point to FHIR server alternatives in README.

---

## P3: Rate Limits Near Exhaustion

**Signs:** Warning logged (`"Alpha Vantage free tier: 5 calls remaining today"`), tool responses include `_warning` field.

### Actions

- **Alpha Vantage:** If demos are planned today, use a premium API key. Free tier resets midnight UTC.
- **GitHub:** 5,000 requests/hour for authenticated requests. Unlikely to hit in normal use. If hit, check for a loop bug.
- **Alchemy:** Free tier is generous (300M compute units/month). If approaching limit, check for unbounded cache misses.

---

## Communication Templates

### Status page / GitHub issue (domain outage)

```
## Service Status Update — [DATE]

**Status:** Investigating / Degraded / Resolved

**Affected:** [Domain name] domain tools (get_stock_quote, get_forex_rate, ...)

**Impact:** Tool calls to the [domain] domain are returning errors. Other domains are unaffected.

**Cause:** [Upstream API name] is experiencing an outage. (See: [link to their status page])

**ETA:** Monitoring. Will update when upstream recovers.

**Workaround:** [If any]
```

### npm deprecation message (security)

```
Critical security vulnerability in [version]. Please upgrade to [fixed version] immediately.
See: https://github.com/ayenisholah/mcp-suite/security/advisories/[ID]
```

---

## Post-Incident Review

After every P0 or P1 incident, write a brief post-mortem:

1. **Timeline** — what happened and when
2. **Root cause** — what caused the incident
3. **Impact** — how many users affected, for how long
4. **Resolution** — what fixed it
5. **Prevention** — what change prevents recurrence

Post to `TECHNICAL_DEBT.md` if prevention requires a non-trivial engineering change.
