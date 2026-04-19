# Coding Standards & Style Guide — Production MCP Server Toolkit

**Last updated:** 2026-04-19

---

## Guiding Principles

1. **Explicit over implicit** — types, error codes, and tool names should be self-describing
2. **Fail visibly** — errors should be typed and surfaced clearly; no silent swallows
3. **Domain isolation** — a change in one domain should never require changes in another
4. **Schema first** — define Zod schemas before writing handler logic; the schema IS the contract

---

## TypeScript

### No `any`

```typescript
// Bad
function handleResponse(data: any) { ... }

// Good
function handleResponse(data: StockQuoteOutput) { ... }
```

Use `unknown` if the type is genuinely unknown, then narrow with Zod or type guards.

### Explicit return types on exported functions

```typescript
// Bad
export async function getStockQuote(ticker: string) { ... }

// Good
export async function getStockQuote(ticker: string): Promise<StockQuoteOutput> { ... }
```

Internal (non-exported) functions may omit return types when they're obvious.

### Prefer `type` over `interface` for data shapes

```typescript
// Preferred for tool inputs/outputs
type StockQuoteInput = z.infer<typeof StockQuoteInputSchema>

// Use interface only for extensible object contracts (e.g., Domain interface)
interface Domain {
  name: string
  isAvailable: () => boolean
  registerTools: (server: McpServer) => void
}
```

### No non-null assertions unless unavoidable

```typescript
// Bad
const key = process.env.API_KEY!

// Good — let config.ts validate and throw early
const { apiKey } = config  // config validated at startup via Zod
```

---

## File & Folder Naming

| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `stock-quote.ts`, `rate-limiter.ts` |
| Directories | kebab-case | `domains/financial/`, `shared/` |
| Test files | `*.test.ts` alongside source | `stock-quote.test.ts` |
| Integration tests | `*.integration.test.ts` | `alpha-vantage.integration.test.ts` |

---

## Zod Schemas

### Naming convention

```typescript
// Input schemas: [ToolName]InputSchema
export const StockQuoteInputSchema = z.object({ ... })

// Output schemas: [ToolName]OutputSchema
export const StockQuoteOutputSchema = z.object({ ... })

// Inferred types: named after schema without "Schema"
export type StockQuoteInput = z.infer<typeof StockQuoteInputSchema>
export type StockQuoteOutput = z.infer<typeof StockQuoteOutputSchema>
```

### All schemas live in `domains/[name]/schemas.ts`

Never define Zod schemas inline in tool files — they belong in `schemas.ts` so they can be reused and tested independently.

### Add `.describe()` to every schema field

MCP surfaces these descriptions in the tool list that AI clients use. Good descriptions improve how AI agents use the tools.

```typescript
// Bad
export const StockQuoteInputSchema = z.object({
  ticker: z.string()
})

// Good
export const StockQuoteInputSchema = z.object({
  ticker: z.string().describe("Stock ticker symbol (e.g. AAPL, TSLA, NVDA)")
})
```

---

## Tool Naming

All tool names are `snake_case` and follow the pattern `{verb}_{noun}` or `{verb}_{domain_noun}`.

```
get_stock_quote        ✓
get_nft_floor          ✓
summarize_pr           ✓
lookup_patient         ✓

stockQuote             ✗  (camelCase)
StockQuote             ✗  (PascalCase)
fetch_stock_data       ✗  (vague verb)
```

Tool names must be unique across all domains. Prefix with domain if collision risk:

```
financial_get_quote    (if two domains have a "get_quote" concept)
```

---

## Error Handling

### Never throw raw `Error` from a tool handler

```typescript
// Bad
throw new Error("Alpha Vantage API returned 429")

// Good
throw new UpstreamError("Financial domain rate limited", {
  upstream: "alpha_vantage",
  upstreamStatus: 429
})
```

### Always catch at the domain handler boundary

Domain handlers should catch all upstream errors and wrap them in typed errors. The tool registry catches all typed errors and converts to MCP error responses. No unhandled promise rejections.

```typescript
export const handler = async (input: StockQuoteInput): Promise<StockQuoteOutput> => {
  try {
    return await financialClient.getQuote(input.ticker)
  } catch (err) {
    if (err instanceof RateLimitError) throw err          // re-throw typed errors
    throw new UpstreamError("Alpha Vantage request failed", { cause: err })
  }
}
```

### Never log API keys or user input values in error messages

```typescript
// Bad
logger.error(`API call failed for key ${process.env.ALPHA_VANTAGE_API_KEY}`)

// Good
logger.error({ domain: "financial", tool: "get_stock_quote", error_code: "UPSTREAM_ERROR" })
```

---

## Logging

Use `logger` from `shared/logger.ts` — never `console.log` in production code.

```typescript
// Info on success
logger.info({ domain, tool, latency_ms: Date.now() - start, cache_hit: false, status: "success" })

// Warn for non-fatal degraded states
logger.warn({ domain, message: "Rate limit approaching", remaining: 5 })

// Error for failures (structured, no raw error messages with sensitive data)
logger.error({ domain, tool, error_code: err.code, upstream: err.upstream })
```

`console.log` is acceptable in CLI utility scripts (`auth/tokens.ts`, `index.ts` startup banner).

---

## Comments

Default: write no comments. Identifiers should be self-describing.

Write a comment only when the **why** is non-obvious:

```typescript
// Alpha Vantage returns 200 with an error message in the body instead of a 4xx status
// Must check the response shape, not just the HTTP status
if ('Error Message' in data) throw new UpstreamError(data['Error Message'])
```

Do not write:
- Comments that restate what the code does
- TODO comments without a linked issue
- Multi-paragraph block comments
- JSDoc on internal functions

---

## Imports

### Order (enforced by ESLint)

1. Node.js built-ins (`path`, `crypto`, `fs`)
2. External packages (`zod`, `@modelcontextprotocol/sdk`)
3. Internal shared modules (`../../shared/cache`)
4. Domain-local modules (`../schemas`, `./client`)

### No barrel files (`index.ts` re-exports) in `shared/`

Import directly from source files. Barrel files cause circular dependency issues as the codebase grows.

```typescript
// Bad
import { cache, rateLimiter, logger } from '../../shared'

// Good
import { cache } from '../../shared/cache'
import { rateLimiter } from '../../shared/rate-limiter'
import { logger } from '../../shared/logger'
```

---

## Testing Conventions

- Test files co-located with source: `stock-quote.test.ts` next to `stock-quote.ts`
- Use `describe` blocks matching the function/module name
- Test the contract (inputs → outputs), not implementation details
- Mock external API clients at the module level; never mock `fetch` globally
- Integration test files named `*.integration.test.ts` and gated behind `RUN_INTEGRATION=true`

```typescript
// Good test naming
describe('get_stock_quote', () => {
  it('returns price data for a valid ticker', async () => { ... })
  it('throws ValidationError for an empty ticker', async () => { ... })
  it('returns cached response within TTL window', async () => { ... })
  it('throws UpstreamError when Alpha Vantage returns 429', async () => { ... })
})
```

---

## Git & Commits

- Commit messages: imperative present tense — `add financial domain tools`, not `added` or `adding`
- One logical change per commit
- Never commit `.env` — only `.env.example`
- `dist/` is git-ignored; never commit compiled output

Branch naming:
```
feature/healthcare-fhir-tools
fix/rate-limiter-reset-window
chore/update-zod-dependency
```

---

## ESLint / Prettier Config

The project ships with `.eslintrc.json` and `.prettierrc` pre-configured. Run before committing:

```bash
npm run lint        # ESLint check
npm run lint:fix    # ESLint auto-fix
npm run format      # Prettier format
```

Pre-commit hook via `husky` + `lint-staged` runs both automatically. Do not use `--no-verify` to skip hooks.
