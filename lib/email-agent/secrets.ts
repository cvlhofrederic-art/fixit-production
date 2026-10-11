import { hydraterSecrets } from '@/lib/env'

/**
 * Secrets lus de façon synchrone par les fournisseurs de boîte e-mail (Gmail, Microsoft)
 * et les routes /api/email-agent/* (process.env). Sur un Worker Cloudflare, process.env
 * n'expose pas toujours les secrets : chaque route les recopie d'abord depuis le contexte
 * Cloudflare (getSecret / getCfEnv, comme la clé Anthropic de lib/claude.ts).
 */
export const SECRETS_BOITES = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'INTERNAL_POLL_TOKEN',
  'CRON_SECRET',
  'OAUTH_TOKENS_ENCRYPTION_KEY',
] as const

export function chargerSecretsBoites(): Promise<void> {
  return hydraterSecrets(SECRETS_BOITES)
}
