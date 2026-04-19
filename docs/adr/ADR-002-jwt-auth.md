# ADR-002 — Use JWT for authentication (vs API keys vs OAuth 2.0)

**Date:** 2026-04-19  
**Status:** Accepted

---

## Context

MCP has no native authentication mechanism in v1.0 of the spec. We need to add auth so the server is safe to deploy in enterprise environments. Three options were evaluated:

1. **JWT (JSON Web Tokens)** — stateless tokens, self-contained claims, signed with HMAC-SHA256
2. **Opaque API keys** — random strings stored in a key-value store, validated on every request
3. **OAuth 2.0** — industry-standard delegated authorization with access tokens and refresh tokens

---

## Decision

Use JWT with HMAC-SHA256 signing for v1.0.

---

## Reasoning

**JWT over API keys:**
- JWT is stateless — validation requires only the secret key, no database lookup. This is critical for v1.0 which has no database.
- `gen-token` CLI generates a usable JWT in one command without any infrastructure.
- JWT carries expiry (`exp`) natively — API keys don't expire unless you build expiry logic.
- API keys require server-side storage (Redis, DB) to validate — not appropriate for a single-process v1.0 install.

**JWT over OAuth 2.0:**
- OAuth 2.0 is the right choice for multi-user systems with third-party identity providers. That's v2.0 scope.
- OAuth requires an authorization server, redirect flows, and token endpoints — 5–10x more infrastructure than JWT.
- v1.0 use case is single-user (developer's own Claude Desktop) — OAuth is severe overkill.

---

## Trade-offs

- **No revocation** — a valid JWT cannot be revoked before its expiry without adding a blocklist (which requires storage). Mitigated by keeping token TTL short (30 days default; configurable).
- **Secret rotation requires all tokens to be re-issued** — rotating `MCP_JWT_SECRET` invalidates all existing tokens. Documented in `ENV_CONFIG.md` and `INCIDENT_RESPONSE.md`.
- **Not the MCP spec's eventual auth mechanism** — when MCP adds native auth (ADR-007), we'll migrate. JWT placement in `_meta` is already an unofficial workaround.

---

## Consequences

- Auth middleware uses `jsonwebtoken` library for signing and verification
- `gen-token` CLI wraps `jwt.sign()` with a 30-day expiry
- `MCP_JWT_SECRET` is required at startup (in production mode) — enforced in `config.ts`
- v2.0 migration path: add OAuth 2.0 as an additional auth method alongside JWT; phase out JWT for external users
