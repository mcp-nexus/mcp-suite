# ADR-003 — Use Zod for runtime input/output validation

**Date:** 2026-04-19  
**Status:** Accepted

---

## Context

TypeScript types are erased at runtime. Tool inputs arrive as raw JSON from MCP clients — we cannot trust that they match the declared TypeScript types. We need runtime validation. Options evaluated:

1. **Zod** — TypeScript-first schema validation library; types inferred from schemas
2. **Joi** — mature validation library (not TypeScript-first)
3. **Manual validation** — write validation functions by hand
4. **AJV** — JSON Schema validator (fast, but verbose schema definitions)

---

## Decision

Use Zod.

---

## Reasoning

- **Schema = type** — `z.infer<typeof Schema>` generates TypeScript types from Zod schemas, eliminating the need to maintain separate type definitions and validation schemas. One source of truth.
- **MCP SDK integration** — `@modelcontextprotocol/sdk` accepts Zod schemas directly for tool input definitions. Using Zod means the same schema serves as both the MCP tool definition and the runtime validator.
- **`.describe()` method** — Zod fields support `.describe("...")` which populates MCP tool descriptions for LLM clients. No other validator integrates this cleanly with the MCP SDK.
- **Ecosystem momentum** — Zod is the de facto standard in the TypeScript/Next.js ecosystem (used by tRPC, drizzle-orm, etc.). Contributors will recognize it immediately.

---

## Trade-offs

- **Bundle size** — Zod adds ~14KB gzipped. Acceptable for a server application; would reconsider for a frontend bundle.
- **Performance** — Zod validation is slower than AJV for high-throughput validation. At tool call rates (< 100/sec in practice), this is irrelevant.

---

## Consequences

- All tool input/output schemas defined in `domains/[name]/schemas.ts` as Zod objects
- TypeScript types inferred via `z.infer<typeof Schema>` — no duplicate type definitions
- MCP tool registration passes Zod schema directly: `server.tool(name, ZodSchema, handler)`
- All schema fields include `.describe()` text for LLM tool discovery
