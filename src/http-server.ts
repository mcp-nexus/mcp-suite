import http from 'http'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import type { Domain } from './types'
import { createServer } from './server'
import { logger } from './shared/logger'

export async function createHttpServer(domains: Domain[], port: number): Promise<void> {
  const mcpServer = await createServer(domains)

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)

    if (req.method === 'GET' && url.pathname === '/health') {
      const domainStatus: Record<string, string> = {}
      for (const d of domains) {
        domainStatus[d.name] = d.isAvailable() ? 'active' : 'disabled'
      }
      const allDisabled = Object.values(domainStatus).every((s) => s === 'disabled')
      res.writeHead(allDisabled ? 503 : 200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          status: allDisabled ? 'degraded' : 'ok',
          version: '1.0.0',
          domains: domainStatus,
        }),
      )
      return
    }

    if (req.method === 'GET' && url.pathname === '/sse') {
      const transport = new SSEServerTransport('/messages', res)
      await mcpServer.connect(transport)
      return
    }

    if (req.method === 'POST' && url.pathname === '/messages') {
      // Handled by SSE transport
      return
    }

    res.writeHead(404)
    res.end()
  })

  await new Promise<void>((resolve) => httpServer.listen(port, resolve))
  logger.info({ msg: 'MCP HTTP server started', transport: 'http', port })
}
