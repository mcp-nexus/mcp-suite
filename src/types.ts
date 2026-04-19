import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export interface Domain {
  name: string
  isAvailable: () => boolean
  registerTools: (server: McpServer) => void
}
