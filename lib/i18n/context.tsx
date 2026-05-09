'use client'

import { createContext, useContext, useCallback, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from './config'
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_LS_KEY } from './config'
import { translateUrl } from './url-translator'
import fr from '@/locales/fr.json'
import pt from '@/locales/pt.json'
import en from '@/locales/en.json'

// ─── Translation dictionaries ───
// NL and ES don't have full translations — they fall back to EN for UI
const dictionaries: Record<Locale, Record<string, unknown>> = { fr, pt, en, nl: en, es: en }

// ─── Key resolver (shared between default context and provider) ───
function resolveKey(dict: Record<string, unknown>, key: string, fallback?: string): string {
  const keys = key.split('.')
  let value: unknown = dict
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k]
    } else {
      return fallback || key
    }
  }
  return typeof value === 'string' ? value : (fallback || key)
}

// ─── Context ───
interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, fallback?: string) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key: string, fallback?: string) => resolveKey(dictionaries[DEFAULT_LOCALE], key, fallback),
})

// ─── Provider ───
export function LanguageProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const router = useRouter()

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    // Persist to cookie (1 year)
    document.cookie = `${LOCALE_COOKIE}=${newLocale};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Lax;Secure`
    // Persist to localStorage
    try { localStorage.setItem(LOCALE_LS_KEY, newLocale) } catch (e) { console.warn('[i18n] localStorage setItem failed:', e) }
    // Navigation vers l'URL équivalente dans la nouvelle locale.
    // Le translator garantit qu'on n'envoie jamais l'utilisateur sur un 404 :
    // si la page actuelle n'a pas d'équivalent connu, on retombe sur la home
    // de la langue cible. Cf. lib/i18n/url-translator.ts.
    const newPath = translateUrl(window.location.pathname, newLocale)
    router.replace(newPath)
  }, [router])

  const t = useCallback((key: string, fallback?: string): string => {
    return resolveKey(dictionaries[locale], key, fallback)
  }, [locale])

  const contextValue = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  )
}

// ─── Hooks ───
export function useLocale(): Locale {
  return useContext(I18nContext).locale
}

export function useTranslation() {
  const { locale, t, setLocale } = useContext(I18nContext)
  return { locale, t, setLocale }
}
