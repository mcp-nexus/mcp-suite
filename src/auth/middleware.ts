import { jwtVerify } from 'jose'
import { AuthError } from '../shared/errors'
import { logger } from '../shared/logger'

let authDisabledWarned = false

export async function validateToken(
  authHeader: string | undefined,
  secret: string,
  authDisabled: boolean,
): Promise<void> {
  if (authDisabled) {
    if (!authDisabledWarned) {
      logger.warn({ msg: 'AUTH_DISABLED=true — JWT validation is OFF. Do not use in production.' })
      authDisabledWarned = true
    }
    return
  }

  if (!authHeader) {
    throw new AuthError('Token required. Pass a Bearer token in the authorization field.')
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader

  try {
    const secretBytes = new TextEncoder().encode(secret)
    await jwtVerify(token, secretBytes)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('expired')) {
        throw new AuthError('Token expired. Run `npx mcp-suite gen-token` to refresh.')
      }
      if (err.message.includes('signature')) {
        throw new AuthError('Token signature invalid. Check MCP_JWT_SECRET.')
      }
    }
    throw new AuthError('Token invalid.')
  }
}
