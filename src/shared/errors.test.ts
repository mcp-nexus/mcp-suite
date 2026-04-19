import { describe, expect, it } from 'vitest'
import {
  AuthError,
  DomainUnavailableError,
  McpError,
  RateLimitError,
  UpstreamError,
  ValidationError,
} from './errors'

describe('McpError', () => {
  it('sets name, code, and userMessage', () => {
    const err = new McpError('debug msg', 'MY_CODE', 'user msg')
    expect(err.name).toBe('McpError')
    expect(err.code).toBe('MY_CODE')
    expect(err.userMessage).toBe('user msg')
    expect(err.message).toBe('debug msg')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('AuthError', () => {
  it('has AUTH_ERROR code and name', () => {
    const err = new AuthError('Token expired')
    expect(err.code).toBe('AUTH_ERROR')
    expect(err.name).toBe('AuthError')
    expect(err.userMessage).toBe('Token expired')
  })
})

describe('ValidationError', () => {
  it('has VALIDATION_ERROR code', () => {
    const err = new ValidationError('ticker is required')
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.name).toBe('ValidationError')
  })
})

describe('DomainUnavailableError', () => {
  it('includes domain name in message', () => {
    const err = new DomainUnavailableError('financial')
    expect(err.code).toBe('DOMAIN_UNAVAILABLE')
    expect(err.userMessage).toContain('financial')
  })
})

describe('UpstreamError', () => {
  it('stores upstream and upstreamStatus', () => {
    const err = new UpstreamError('alpha vantage 429', {
      upstream: 'alpha-vantage',
      upstreamStatus: 429,
    })
    expect(err.code).toBe('UPSTREAM_ERROR')
    expect(err.upstream).toBe('alpha-vantage')
    expect(err.upstreamStatus).toBe(429)
    expect(err.userMessage).toContain('alpha-vantage')
  })

  it('appends cause stack when cause is an Error', () => {
    const cause = new Error('network timeout')
    const err = new UpstreamError('fetch failed', { upstream: 'opensea', cause })
    expect(err.stack).toContain('Caused by:')
  })
})

describe('RateLimitError', () => {
  it('includes retryAfterMs and domain in message', () => {
    const err = new RateLimitError('financial', 5000)
    expect(err.code).toBe('RATE_LIMITED')
    expect(err.retryAfterMs).toBe(5000)
    expect(err.userMessage).toContain('financial')
  })
})
