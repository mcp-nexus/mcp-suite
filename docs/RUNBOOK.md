# Infrastructure & DevOps Runbook — Production MCP Server Toolkit

**Last updated:** 2026-04-19

---

## Environments

| Environment | Purpose | Transport | Host |
|-------------|---------|-----------|------|
| **local** | Development | stdio | Developer machine |
| **hosted-api** | Public API with Stripe billing | HTTP + SSE | Hivelocity VPS (Ubuntu 22.04) |

v1.0 ships with local stdio only. This runbook covers both modes.

---

## Local Development

### Start (stdio — for Claude Desktop)

```bash
npm run build
node dist/index.js
```

Or with auto-rebuild:

```bash
npm run dev
```

### Start (HTTP — for testing remote clients)

```bash
MCP_TRANSPORT=http MCP_PORT=3001 AUTH_DISABLED=true node dist/index.js
```

### Stop

`Ctrl+C` — no daemon, no cleanup needed.

---

## CI/CD Pipeline (GitHub Actions)

### Pipeline overview

```
Push to any branch
    │
    ▼
[ci.yml] ─── typecheck ─── lint ─── unit tests ─── npm audit
    │
    (on push to main only)
    ▼
[release.yml] ─── build ─── npm pack dry-run ─── publish to npm
```

### Workflow files

**`.github/workflows/ci.yml`** — runs on every push and PR:

```yaml
name: CI
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm audit --audit-level=high
```

**`.github/workflows/release.yml`** — runs only on version tags (`v*`):

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', registry-url: 'https://registry.npmjs.org' }
      - run: npm ci
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Required GitHub Secrets

| Secret | Where to get it |
|--------|----------------|
| `NPM_TOKEN` | npmjs.com → Account → Access Tokens → Automation token |

### Triggering a release

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers the release workflow. Monitor at `github.com/ayenisholah/mcp-suite/actions`.

---

## Hosted API Deployment (VPS)

### Server specs

- Ubuntu 22.04 LTS
- Node.js 20 (via nvm)
- PM2 for process management
- Nginx as reverse proxy

### Initial server setup

```bash
# On the VPS
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
npm install -g pm2

# Clone and build
git clone https://github.com/ayenisholah/mcp-suite.git /opt/mcp-suite
cd /opt/mcp-suite
npm ci --production
npm run build

# Configure env
cp .env.example .env
# Fill in production API keys and MCP_JWT_SECRET
```

### PM2 process config

`/opt/mcp-suite/ecosystem.config.js`:

```js
module.exports = {
  apps: [{
    name: 'mcp-suite',
    script: './dist/index.js',
    env: {
      NODE_ENV: 'production',
      MCP_TRANSPORT: 'http',
      MCP_PORT: 3000,
    },
    env_file: '/opt/mcp-suite/.env',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    error_file: '/var/log/mcp-suite/error.log',
    out_file: '/var/log/mcp-suite/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
```

```bash
mkdir -p /var/log/mcp-suite
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # configure PM2 to start on boot
```

### Nginx config

`/etc/nginx/sites-available/mcp-suite`:

```nginx
server {
    listen 443 ssl http2;
    server_name api.mcp-suite.dev;

    ssl_certificate     /etc/letsencrypt/live/api.mcp-suite.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.mcp-suite.dev/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;

        # SSE support
        proxy_buffering    off;
        proxy_read_timeout 3600s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/mcp-suite /etc/nginx/sites-enabled/
certbot --nginx -d api.mcp-suite.dev
nginx -t && systemctl reload nginx
```

### Deploy new version

```bash
cd /opt/mcp-suite
git pull origin main
npm ci --production
npm run build
pm2 reload mcp-suite   # zero-downtime reload
```

### Verify deployment

```bash
curl https://api.mcp-suite.dev/health
# Expected: {"status":"ok","domains":{...}}

pm2 status
# Expected: mcp-suite online
```

---

## Monitoring & Alerting

### Check server health

```bash
# PM2 status
pm2 status

# Recent logs
pm2 logs mcp-suite --lines 50

# Error log only
tail -f /var/log/mcp-suite/error.log
```

### Key metrics to watch

| Metric | Warning | Critical | Source |
|--------|---------|----------|--------|
| Process restarts | > 2 in 1hr | > 5 in 1hr | PM2 |
| Memory | > 400MB | > 500MB (autorestart) | PM2 |
| `/health` response | > 500ms | 5xx status | Uptime monitor |
| Domain status | Any `degraded` | All `disabled` | `/health` payload |

### Recommended uptime monitor

UptimeRobot (free tier): ping `GET /health` every 5 minutes. Alert on non-200 response.

---

## Environment Configuration

See `docs/ENV_CONFIG.md` for the full variable reference.

### Production environment checklist

- [ ] `MCP_JWT_SECRET` set to a random 32-byte hex string (`openssl rand -hex 32`)
- [ ] `AUTH_DISABLED` is not set (defaults to false in production)
- [ ] All domain API keys set (or missing domains are intentional)
- [ ] `NODE_ENV=production` set
- [ ] `LOG_LEVEL=warn` (reduce log volume in production)
- [ ] `.env` file has `chmod 600` permissions

---

## npm Package Operations

### Check published package

```bash
npm view mcp-suite
npm view mcp-suite versions --json
```

### Unpublish a version (emergency only)

```bash
# Within 72 hours of publish
npm unpublish mcp-suite@1.0.0

# After 72 hours — deprecate instead
npm deprecate mcp-suite@1.0.0 "Critical security issue — upgrade to 1.0.1"
```

### Rotate npm token

1. npmjs.com → Account → Access Tokens → delete compromised token
2. Generate new Automation token
3. Update `NPM_TOKEN` in GitHub Secrets
4. Verify next CI release run succeeds

---

## Dependency Updates

```bash
# Check outdated packages
npm outdated

# Update non-breaking
npm update

# Major version upgrades — manual review required
npx npm-check-updates -u --target minor
npm install
npm test
```

Run dependency updates monthly or when `npm audit` reports a vulnerability.
