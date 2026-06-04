'use client'

import { usePathname } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { SUPPORTED_LOCALES, LOCALE_FLAGS, LOCALE_NAMES, type Locale } from '@/lib/i18n/config'
import { translateUrl } from '@/lib/i18n/url-translator'

interface LanguageSwitcherProps {
  className?: string
  compact?: boolean // Show only flags (for mobile)
}

// Pro SEO 2026 : marchés strictement séparés. On affiche un drapeau
// SEULEMENT si :
//   - c'est la locale active (drapeau "vous êtes ici"), OU
//   - la page courante a un équivalent traduit dans cette locale
//     (translateUrl retourne une URL non-null).
// Pas de fallback vers la home : on ne relie pas FR ↔ PT autrement
// que par traduction directe.

export default function LanguageSwitcher({ className = '', compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale } = useTranslation()
  const pathname = usePathname()

  const visibleLocales = SUPPORTED_LOCALES.filter(
    (loc) => loc === locale || translateUrl(pathname, loc) !== null,
  )

  // Si on est sur une page qui n'a aucun équivalent dans aucune autre locale
  // (uniquement la locale active visible), on cache complètement le switcher.
  if (visibleLocales.length <= 1) return null

  return (
    <div className={`flex items-center gap-1 ${className}`} role="radiogroup" aria-label="Language / Langue">
      {visibleLocales.map((loc: Locale) => (
        <button
          key={loc}
          onClick={() => { if (loc !== locale) setLocale(loc) }}
          className={`
            flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-all
            ${loc === locale
              ? 'bg-yellow/20 text-yellow ring-1 ring-yellow/30'
              : 'text-text-muted hover:text-dark hover:bg-warm-gray'
            }
          `}
          role="radio"
          aria-checked={loc === locale}
          aria-label={LOCALE_NAMES[loc]}
          title={LOCALE_NAMES[loc]}
        >
          <span className="text-base leading-none">{LOCALE_FLAGS[loc]}</span>
          {!compact && <span className="uppercase text-xs tracking-wide">{loc}</span>}
        </button>
      ))}
    </div>
  )
}
