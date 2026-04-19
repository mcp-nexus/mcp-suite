import { z } from 'zod'

const ConfigSchema = z.object({
  MCP_JWT_SECRET: z.string().optional(),
  AUTH_DISABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  ALCHEMY_API_KEY: z.string().optional(),
  OPENSEA_API_KEY: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  FHIR_BASE_URL: z.string().url().default('https://hapi.fhir.org/baseR4'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  MCP_PORT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .default('3000'),
  MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
})

export type Config = z.infer<typeof ConfigSchema>

function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env)

  if (!result.success) {
    console.error('Invalid environment configuration:')
    console.error(result.error.format())
    process.exit(1)
  }

  const cfg = result.data

  if (!cfg.AUTH_DISABLED && !cfg.MCP_JWT_SECRET) {
    console.error(
      'Error: MCP_JWT_SECRET is required in production mode.\n' +
        'Set AUTH_DISABLED=true for local development or provide MCP_JWT_SECRET.',
    )
    process.exit(1)
  }

  return cfg
}

export const config = loadConfig()
