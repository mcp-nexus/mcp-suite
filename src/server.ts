import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { Domain } from './types'
import { logger } from './shared/logger'
import { config } from './config'

export async function createServer(domains: Domain[]): Promise<McpServer> {
  const server = new McpServer({
    name: 'mcp-suite',
    version: '1.0.0',
  })

  for (const domain of domains) {
    if (domain.isAvailable()) {
      domain.registerTools(server)
      logger.info({ msg: `Domain registered`, domain: domain.name })
    } else {
      logger.warn({
        msg: `Domain disabled — required API key(s) not set`,
        domain: domain.name,
      })
    }
  }

  return server
}

export async function startServer(domains: Domain[]): Promise<void> {
  if (config.MCP_TRANSPORT === 'http') {
    await startHttpServer(domains)
  } else {
    await startStdioServer(domains)
  }
}

async function startStdioServer(domains: Domain[]): Promise<void> {
  const server = await createServer(domains)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  logger.info({ msg: 'MCP server started', transport: 'stdio' })
}

async function startHttpServer(domains: Domain[]): Promise<void> {
  const { createHttpServer } = await import('./http-server')
  await createHttpServer(domains, config.MCP_PORT)
}
