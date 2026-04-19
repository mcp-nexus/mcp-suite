import { beforeEach, describe, expect, it } from 'vitest'
import { AuthError } from '../shared/errors'
import { validateToken } from './middleware'
import { genToken } from './tokens'

const SECRET = 'test-secret-for-unit-tests'

describe('validateToken', () => {
  beforeEach(() => {
    // Reset the warned flag between tests by reimporting is complex;
    // we'll just call with authDisabled=false for most tests
  })

  it('passes with a valid token', async () => {
    const token = await genToken(SECRET)
    await expect(validateToken(`Bearer ${token}`, SECRET, false)).resolves.toBeUndefined()
  })

  it('passes when authDisabled is true (no token required)', async () => {
    await expect(validateToken(undefined, SECRET, true)).resolves.toBeUndefined()
  })

  it('throws AuthError when token is missing', async () => {
    await expect(validateToken(undefined, SECRET, false)).rejects.toBeInstanceOf(AuthError)
  })

  it('throws AuthError for wrong secret', async () => {
    const token = await genToken('different-secret')
    await expect(validateToken(`Bearer ${token}`, SECRET, false)).rejects.toBeInstanceOf(AuthError)
  })

  it('throws AuthError for malformed token', async () => {
    await expect(validateToken('Bearer not.a.real.jwt', SECRET, false)).rejects.toBeInstanceOf(
      AuthError,
    )
  })

  it('accepts token without Bearer prefix', async () => {
    const token = await genToken(SECRET)
    await expect(validateToken(token, SECRET, false)).resolves.toBeUndefined()
  })
})
