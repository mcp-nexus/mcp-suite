# ADR-004 — Domain isolation architecture (vs monolithic tool registry)

**Date:** 2026-04-19  
**Status:** Accepted

---

## Context

The server exposes tools across four unrelated domains: financial markets, Web3/DeFi, developer tools, and healthcare. We need to decide how to organize this code. Two main approaches:

1. **Domain isolation** — each domain is a self-contained module with its own schemas, client adapters, and tool handlers; the main server registers each domain independently
2. **Flat tool registry** — all tools defined at the top level; one big file (or a few files) organized by function

---

## Decision

Domain isolation: each domain is a self-contained module behind a `Domain` interface.

```typescript
interface Domain {
  name: string
  isAvailable: () => boolean
  registerTools: (server: McpServer) => void
}
```

---

## Reasoning

**Graceful degradation without domain isolation is impossible:**
The server must start cleanly when only some API keys are present. With a flat registry, you'd need conditional logic scattered throughout the codebase (`if (process.env.ALCHEMY_API_KEY)` before each Web3 tool registration). With domain isolation, the `isAvailable()` check is one line per domain and the registration is either called or not.

**Independent development:**
Each domain can be developed, tested, and reviewed independently. A PR that adds a new FHIR tool only touches `domains/healthcare/`. No risk of breaking financial or Web3 tools.

**Third-party extensibility:**
The `Domain` interface is the public API for adding new domains. Contributors fork the repo, create a new domain module implementing the interface, and register it in `server.ts`. This is the pattern documented in `CODING_STANDARDS.md`.

**Testability:**
Domain modules can be unit-tested in complete isolation by passing a mock `McpServer` to `registerTools`. The tool registry tests test routing, not domain logic.

---

## Trade-offs

- **More files** — 4 domains × (index + schemas + client + N tool files) = ~25+ files vs a flat structure. Justified because each file is small and purpose-clear.
- **Slightly more boilerplate** — each new domain requires creating the directory structure and exporting a `Domain` object. The `SETUP.md` guide reduces this friction.

---

## Consequences

- `src/domains/` contains one directory per domain
- Each domain exports a `Domain` object from its `index.ts`
- `src/server.ts` imports all domains and calls `domain.registerTools(server)` if `domain.isAvailable()`
- Shared infrastructure (cache, rate limiter, logger, errors) lives in `src/shared/` and is imported by domains, never the other way around
