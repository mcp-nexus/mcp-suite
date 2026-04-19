# ADR-001 — Use `@modelcontextprotocol/sdk` instead of raw protocol implementation

**Date:** 2026-04-19  
**Status:** Accepted

---

## Context

MCP (Model Context Protocol) is a JSON-RPC-based protocol for AI tool use. We need to implement an MCP server in TypeScript. The options were:

1. Use the official `@modelcontextprotocol/sdk` package
2. Implement the protocol manually (parse JSON-RPC, handle `tools/list` and `tools/call` methods directly)

---

## Decision

Use `@modelcontextprotocol/sdk`.

---

## Reasoning

- **Official spec compliance** — the SDK is maintained by Anthropic and stays in sync with protocol updates. A raw implementation would require tracking spec changes manually.
- **Transport abstraction** — the SDK handles both stdio and HTTP+SSE transports with the same API surface. Implementing both transports manually would add significant complexity.
- **Tool registration API** — `server.tool(name, schema, handler)` is a clean interface. The raw protocol requires manually handling `tools/list` responses, request routing, and error formatting.
- **Time to ship** — the SDK cuts implementation time for protocol plumbing by ~2–3 days, allowing focus on domain logic.

---

## Trade-offs

- **SDK version coupling** — if Anthropic makes breaking changes to the SDK, we must update. Mitigated by pinning to a specific minor version and reviewing release notes before upgrading.
- **Less control** — we can't customize low-level protocol behavior (e.g., custom message framing). Not needed for this use case.

---

## Consequences

- All tool registration uses `server.tool()` from the SDK
- Transport mode is selected via `StdioServerTransport` or `SSEServerTransport` from the SDK
- Future MCP spec changes are handled by updating the SDK version, not by editing protocol code
