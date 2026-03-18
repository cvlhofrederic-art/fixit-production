// ─── Server-side translation helper ───
// Permet aux Server Components d'accéder aux traductions sans 'use client'
// Usage: const t = await getServerTranslation()

import { cookies } from 'next/headers'
import type { Locale } from './config'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isValidLocale } from './config'
import fr from '@/locales/fr.json'
import pt from '@/locales/pt.json'
import en from '@/locales/en.json'

// NL and ES don't have full translations — they fall back to EN for UI
const dictionaries: Record<Locale, Record<string, unknown>> = { fr, pt, en, nl: en, es: en }

export async function getServerTranslation() {
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get(LOCALE_COOKIE)?.value
  const locale: Locale = localeCookie && isValidLocale(localeCookie) ? localeCookie : DEFAULT_LOCALE

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
