export class McpError extends Error {
  readonly code: string
  readonly userMessage: string

  constructor(message: string, code: string, userMessage: string) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.userMessage = userMessage
    Error.captureStackTrace(this, this.constructor)
  }
}

export class AuthError extends McpError {
  constructor(userMessage: string) {
    super(userMessage, 'AUTH_ERROR', userMessage)
  }
}

export class ValidationError extends McpError {
  constructor(userMessage: string) {
    super(userMessage, 'VALIDATION_ERROR', userMessage)
  }
}

export class DomainUnavailableError extends McpError {
  constructor(domain: string) {
    const msg = `The ${domain} domain is not available. Check that required API keys are configured.`
    super(msg, 'DOMAIN_UNAVAILABLE', msg)
  }
}

export class UpstreamError extends McpError {
  readonly upstream: string
  readonly upstreamStatus?: number

  constructor(
    debugMessage: string,
    opts: { upstream: string; upstreamStatus?: number; cause?: unknown },
  ) {
    const userMessage = `Upstream service (${opts.upstream}) returned an error. Please try again.`
    super(debugMessage, 'UPSTREAM_ERROR', userMessage)
    this.upstream = opts.upstream
    this.upstreamStatus = opts.upstreamStatus
    if (opts.cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${opts.cause.stack}`
    }
  }
}

export class RateLimitError extends McpError {
  readonly retryAfterMs: number

  constructor(domain: string, retryAfterMs: number) {
    const seconds = Math.ceil(retryAfterMs / 1000)
    const msg = `Rate limit exceeded for the ${domain} domain. Retry in ${seconds}s.`
    super(msg, 'RATE_LIMITED', msg)
    this.retryAfterMs = retryAfterMs
  }
}
