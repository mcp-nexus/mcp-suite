import { SignJWT } from 'jose'

const EXPIRY_DAYS = 30

export async function genToken(secret: string): Promise<string> {
  const secretBytes = new TextEncoder().encode(secret)
  return new SignJWT({ scope: 'mcp:tools' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('dev')
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_DAYS}d`)
    .sign(secretBytes)
}
