// lib/syndic/agent-locale-resolver.ts
import type { Locale } from './agent-types'

interface UserLike {
  profile?: {
    country?: string | null
  }
}

interface ConversationLike {
  locale?: string | null
}

const VALID_LOCALES: Locale[] = ['fr', 'pt']

function isValidLocale(value: unknown): value is Locale {
  return typeof value === 'string' && VALID_LOCALES.includes(value as Locale)
}

/**
 * Résolution déterministe du locale d'un agent.
 * Ordre de priorité (de + fort à + faible) :
 *   1. Conversation existante (locale immuable une fois posé)
 *   2. user.profile.country
 *   3. uiLocale (locale courant du dashboard)
 *   4. fallback 'fr'
 */
export function resolveAgentLocale(
  user: UserLike,
  conversation: ConversationLike | undefined,
  uiLocale: string | undefined
): Locale {
  if (conversation && isValidLocale(conversation.locale)) return conversation.locale
  if (isValidLocale(user.profile?.country)) return user.profile!.country as Locale
  if (isValidLocale(uiLocale)) return uiLocale
  return 'fr'
}
