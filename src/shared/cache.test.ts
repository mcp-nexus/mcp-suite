import { beforeEach, describe, expect, it } from 'vitest'
import { cache } from './cache'

describe('cache', () => {
  beforeEach(() => {
    // Clear between tests by deleting known keys
  })

  it('returns undefined on cache miss', () => {
    expect(cache.get('nonexistent:key')).toBeUndefined()
  })

  it('returns the stored value on cache hit', () => {
    cache.set('test:hit', { price: 100 }, 60)
    expect(cache.get('test:hit')).toEqual({ price: 100 })
  })

  it('deletes a key', () => {
    cache.set('test:del', 'value', 60)
    cache.del('test:del')
    expect(cache.get('test:del')).toBeUndefined()
  })

  it('expires entries after TTL', async () => {
    cache.set('test:ttl', 'expires', 1)
    await new Promise((r) => setTimeout(r, 1100))
    expect(cache.get('test:ttl')).toBeUndefined()
  })

  it('isolates keys across domains', () => {
    cache.set('financial:quote:AAPL', { price: 150 }, 60)
    cache.set('web3:floor:bayc', { floor: 12 }, 60)
    expect(cache.get('financial:quote:AAPL')).toEqual({ price: 150 })
    expect(cache.get('web3:floor:bayc')).toEqual({ floor: 12 })
  })
})
