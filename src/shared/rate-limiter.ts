import { RateLimitError } from './errors'

interface BucketConfig {
  capacity: number
  refillAmount: number
  refillIntervalMs: number
}

interface Bucket {
  tokens: number
  lastRefillAt: number
}

const DOMAIN_CONFIGS: Record<string, BucketConfig> = {
  financial: { capacity: 24, refillAmount: 24, refillIntervalMs: 24 * 60 * 60 * 1000 },
  web3: { capacity: 100, refillAmount: 100, refillIntervalMs: 60 * 1000 },
  devtools: { capacity: 1000, refillAmount: 1000, refillIntervalMs: 60 * 60 * 1000 },
  healthcare: { capacity: 60, refillAmount: 60, refillIntervalMs: 60 * 1000 },
}

export interface RateLimiter {
  consume(domain: string): Promise<void>
}

class TokenBucketRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>()

  async consume(domain: string): Promise<void> {
    const config = DOMAIN_CONFIGS[domain]
    if (!config) return

    const now = Date.now()
    let bucket = this.buckets.get(domain)

    if (!bucket) {
      bucket = { tokens: config.capacity, lastRefillAt: now }
      this.buckets.set(domain, bucket)
    }

    const elapsed = now - bucket.lastRefillAt
    const refillCycles = Math.floor(elapsed / config.refillIntervalMs)
    if (refillCycles > 0) {
      bucket.tokens = Math.min(config.capacity, bucket.tokens + refillCycles * config.refillAmount)
      bucket.lastRefillAt = now
    }

    if (bucket.tokens < 1) {
      const msUntilRefill = config.refillIntervalMs - (now - bucket.lastRefillAt)
      throw new RateLimitError(domain, Math.max(msUntilRefill, 1000))
    }

    bucket.tokens -= 1
  }
}

export const rateLimiter: RateLimiter = new TokenBucketRateLimiter()
