'use client'

import { createContext, useContext, useCallback, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from './config'
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_LS_KEY } from './config'
import fr from '@/locales/fr.json'
import pt from '@/locales/pt.json'
import en from '@/locales/en.json'

// ─── Translation dictionaries ───
// NL and ES don't have full translations — they fall back to EN for UI
const dictionaries: Record<Locale, Record<string, unknown>> = { fr, pt, en, nl: en, es: en }

// ─── Context ───
interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, fallback?: string) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key: string) => key,
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
    document.cookie = `${LOCALE_COOKIE}=${newLocale};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Lax`
    // Persist to localStorage
    try { localStorage.setItem(LOCALE_LS_KEY, newLocale) } catch (e) { console.warn('[i18n] localStorage setItem failed:', e) }
    // Client-side navigation vers l'URL avec le bon préfixe locale (pas de full page reload)
    const currentPath = window.location.pathname
    // Strip any existing locale prefix
    let cleanPath = currentPath
    if (currentPath.startsWith('/fr/') || currentPath === '/fr') {
      cleanPath = currentPath.replace(/^\/fr/, '') || '/'
    } else if (currentPath.startsWith('/pt/') || currentPath === '/pt') {
      cleanPath = currentPath.replace(/^\/pt/, '') || '/'
    } else if (currentPath.startsWith('/en/') || currentPath === '/en') {
      cleanPath = currentPath.replace(/^\/en/, '') || '/'
    } else if (currentPath.startsWith('/nl/') || currentPath === '/nl') {
      cleanPath = currentPath.replace(/^\/nl/, '') || '/'
    } else if (currentPath.startsWith('/es/') || currentPath === '/es') {
      cleanPath = currentPath.replace(/^\/es/, '') || '/'
    }
    const newPath = `/${newLocale}${cleanPath === '/' ? '/' : cleanPath}`
    router.replace(newPath)
  }, [router])

  const t = useCallback((key: string, fallback?: string): string => {
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
