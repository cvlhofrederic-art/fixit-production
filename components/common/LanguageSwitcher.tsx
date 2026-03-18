'use client'

import { useTranslation } from '@/lib/i18n/context'
import { SUPPORTED_LOCALES, LOCALE_FLAGS, LOCALE_NAMES, type Locale } from '@/lib/i18n/config'

interface LanguageSwitcherProps {
  className?: string
  compact?: boolean // Show only flags (for mobile)
}

export default function LanguageSwitcher({ className = '', compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale } = useTranslation()

  return (
    <div className={`flex items-center gap-1 ${className}`} role="radiogroup" aria-label="Language / Langue">
      {SUPPORTED_LOCALES.map((loc: Locale) => (
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
