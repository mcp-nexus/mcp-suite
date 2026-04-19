# ADR-005 — stdio as primary transport (HTTP+SSE as secondary)

**Date:** 2026-04-19  
**Status:** Accepted

---

## Context

MCP servers can expose tools via two transports:

1. **stdio** — the server runs as a subprocess; the MCP client (Claude Desktop) communicates via stdin/stdout
2. **HTTP + SSE** — the server runs as a persistent HTTP process; clients connect over the network

We need to decide which to prioritize for v1.0 and what the UX implication of each choice is.

---

## Decision

stdio is the primary transport (default). HTTP+SSE is supported as a secondary transport via `MCP_TRANSPORT=http`.

---

## Reasoning

**stdio matches the primary use case:**
The target user for v1.0 is a developer running Claude Desktop locally. Claude Desktop spawns MCP servers as subprocesses using stdio. This requires no network configuration, no port management, and works immediately via `npx mcp-suite`.

**stdio simplifies local auth:**
In HTTP mode, auth tokens need to be in HTTP headers — requiring the developer to configure their HTTP client. In stdio mode, the token goes in `claude_desktop_config.json` alongside the server config. One place to configure everything.

**npx + stdio = zero infrastructure:**
`npx mcp-suite` downloads and runs the package as a subprocess. The user doesn't need to manage a running server process, ports, or Nginx. The server starts when Claude Desktop starts and stops when it stops. This is the "5-minute install" experience required to get GitHub stars from developers who try it.

**HTTP for hosted API is a stretch goal:**
The hosted API with Stripe billing (Day 7, if time allows) requires HTTP. By making HTTP a flag (`--transport http`), we can ship HTTP support without making it the default burden for every user.

---

## Trade-offs

- **stdio is single-client** — each Claude Desktop instance spawns its own server process. Two users can't share one stdio server. Mitigated by HTTP mode for hosted deployments.
- **stdio makes hot-reloading harder** — changes require Claude Desktop to restart the subprocess. HTTP mode allows `pm2 reload` without client restart. Developers who prefer HTTP can use it during development.

---

## Consequences

- Default startup: `node dist/index.js` starts a stdio server
- HTTP mode: `MCP_TRANSPORT=http MCP_PORT=3000 node dist/index.js`
- `claude_desktop_config.json` uses the `"command"` + `"args"` format (stdio)
- `GET /health` and `GET /tools` REST endpoints exist only in HTTP mode
- PM2 deployment (Runbook) uses HTTP mode
