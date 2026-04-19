import { beforeEach, describe, expect, it } from 'vitest'
import { RateLimitError } from './errors'
import { rateLimiter } from './rate-limiter'

// Access internals via cast to test bucket state
const limiter = rateLimiter as unknown as {
  buckets: Map<string, { tokens: number; lastRefillAt: number }>
}

describe('rateLimiter', () => {
  beforeEach(() => {
    limiter.buckets.clear()
  })

  it('allows consume within capacity', async () => {
    await expect(rateLimiter.consume('web3')).resolves.toBeUndefined()
  })

  it('throws RateLimitError when bucket is exhausted', async () => {
    // Drain the web3 bucket (capacity 100)
    const bucket = { tokens: 0, lastRefillAt: Date.now() }
    limiter.buckets.set('web3', bucket)
    await expect(rateLimiter.consume('web3')).rejects.toBeInstanceOf(RateLimitError)
  })

  it('RateLimitError includes retryAfterMs > 0', async () => {
    limiter.buckets.set('web3', { tokens: 0, lastRefillAt: Date.now() })
    try {
      await rateLimiter.consume('web3')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfterMs).toBeGreaterThan(0)
    }
  })

  it('isolates buckets per domain', async () => {
    limiter.buckets.set('financial', { tokens: 0, lastRefillAt: Date.now() })
    // financial is exhausted but web3 is fine
    await expect(rateLimiter.consume('web3')).resolves.toBeUndefined()
    await expect(rateLimiter.consume('financial')).rejects.toBeInstanceOf(RateLimitError)
  })

  it('silently passes for unknown domains', async () => {
    await expect(rateLimiter.consume('unknown-domain')).resolves.toBeUndefined()
  })

  it('refills tokens after the window elapses', async () => {
    // Simulate a bucket that was last refilled 2 minutes ago (beyond the 1-min window for web3)
    limiter.buckets.set('web3', {
      tokens: 0,
      lastRefillAt: Date.now() - 2 * 60 * 1000,
    })
    await expect(rateLimiter.consume('web3')).resolves.toBeUndefined()
  })
})
