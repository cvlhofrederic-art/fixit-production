// ─── Server-side translation helper ───
// Permet aux Server Components d'accéder aux traductions sans 'use client'
// Usage: const t = await getServerTranslation()

import { cookies, headers } from 'next/headers'
import type { Locale } from './config'
import { DEFAULT_LOCALE, LOCALE_COOKIE, premiereLangueValide } from './config'
import fr from '@/locales/fr.json'
import pt from '@/locales/pt.json'
import en from '@/locales/en.json'

// NL and ES don't have full translations — they fall back to EN for UI
const dictionaries: Record<Locale, Record<string, unknown>> = { fr, pt, en, nl: en, es: en }

// Langue d'un rendu serveur : celle du chemin d'abord (en-tête x-locale, posé par middleware.ts sur toute requête de
// page, document comme fetch RSC d'une navigation côté client), puis le cookie. Le middleware ne pose le cookie que sur
// une navigation de document (poserCookieLangue) : après une navigation côté client vers /pt/…, il peut encore valoir
// fr, et une page qui ne lisait que lui s'affichait dans la langue de la page quittée.

export async function getServerTranslation(forceLocale?: Locale) {
  // cookies() reste appelé même avec une langue forcée : mode de rendu inchangé pour ces pages.
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get(LOCALE_COOKIE)?.value
  const localeChemin = forceLocale ? null : (await headers()).get('x-locale')
  const locale: Locale = forceLocale || premiereLangueValide(localeChemin, localeCookie) || DEFAULT_LOCALE

  const t = (key: string, fallback?: string): string => {
    const keys = key.split('.')
    let value: unknown = dictionaries[locale]
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k]
      } else {
        return fallback || key
      }
    }
    return typeof value === 'string' ? value : (fallback || key)
  }

  return { t, locale }
}
