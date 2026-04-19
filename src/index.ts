#!/usr/bin/env node
import { config } from './config'
import { genToken } from './auth/tokens'
import { startServer } from './server'
import type { Domain } from './types'

// Domains are registered here — each is imported only after config is loaded
// so missing keys are already handled gracefully before tool registration runs.
async function getDomains(): Promise<Domain[]> {
  const domains: Domain[] = []

  // Domains imported lazily to avoid top-level side effects during gen-token / list-tools
  const { web3Domain } = await import('./domains/web3/index')
  const { financialDomain } = await import('./domains/financial/index')
  const { devtoolsDomain } = await import('./domains/devtools/index')
  const { healthcareDomain } = await import('./domains/healthcare/index')

  domains.push(web3Domain, financialDomain, devtoolsDomain, healthcareDomain)
  return domains
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'gen-token') {
    const secret = config.MCP_JWT_SECRET
    if (!secret) {
      console.error('Error: MCP_JWT_SECRET is required to generate a token.')
      process.exit(1)
    }
    const token = await genToken(secret)
    console.log(token)
    return
  }

  if (command === 'list-tools') {
    const domains = await getDomains()
    for (const domain of domains) {
      if (!domain.isAvailable()) {
        console.log(`\n[${domain.name}] — DISABLED (missing API key)`)
        continue
      }
      console.log(`\n[${domain.name}]`)
    }
    return
  }

  await startServer(await getDomains())
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
