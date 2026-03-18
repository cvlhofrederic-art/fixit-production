// ─── i18n Configuration ───
export const SUPPORTED_LOCALES = ['fr', 'pt', 'en', 'nl', 'es'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

// Locales with full site translations vs landing-page-only locales
export const FULL_LOCALES = ['fr', 'pt', 'en'] as const
export type FullLocale = (typeof FULL_LOCALES)[number]
// NL and ES only have investor landing pages — UI falls back to EN
export function getUiLocale(locale: Locale): FullLocale {
  if (locale === 'nl' || locale === 'es') return 'en'
  return locale as FullLocale
}

export const DEFAULT_LOCALE: Locale = 'pt'

export const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'Fran\u00e7ais',
  pt: 'Portugu\u00eas',
  en: 'English',
  nl: 'Nederlands',
  es: 'Espa\u00f1ol',
}

export const LOCALE_FLAGS: Record<Locale, string> = {
  fr: '\ud83c\uddeb\ud83c\uddf7',
  pt: '\ud83c\uddf5\ud83c\uddf9',
  en: '\ud83c\uddec\ud83c\udde7',
  nl: '\ud83c\uddf3\ud83c\uddf1',
  es: '\ud83c\uddea\ud83c\uddf8',
}

export const LOCALE_COOKIE = 'locale'
export const LOCALE_LS_KEY = 'vitfix_locale'

export function isValidLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale)
}

/**
 * Detect locale from URL pathname.
 * Returns the locale if found at start of path, otherwise null.
 */
export function getLocaleFromPathname(pathname: string): Locale | null {
  for (const locale of SUPPORTED_LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale
    }
  }
  return null
}

/**
 * Strip locale prefix from pathname.
 * /fr/recherche → /recherche
 * /pt/pro/dashboard → /pro/dashboard
 * /recherche → /recherche (unchanged)
 */
export function stripLocaleFromPathname(pathname: string): string {
  for (const locale of SUPPORTED_LOCALES) {
    if (pathname === `/${locale}`) return '/'
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1)
  }
  return pathname
}

/**
 * Add locale prefix to a pathname.
 * /recherche → /fr/recherche
 */
export function addLocaleToPathname(pathname: string, locale: Locale): string {
  if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) return pathname
  return `/${locale}${pathname.startsWith('/') ? '' : '/'}${pathname}`
}

// ── Locale-specific formats ──
export function getLocaleFormats(locale: Locale) {
  // NL and ES investor pages target Portugal — use same formats as EN (EUR, Portuguese postal codes, +351)
  if (locale === 'nl' || locale === 'es') {
    return getLocaleFormats('en')
  }
  if (locale === 'en') {
    // EN targets Portugal (Porto) — same formats as PT (EUR, IVA, +351)
    return {
      postalCodeLabel: 'Postal code',
      postalCodePlaceholder: '4000-001',
      postalCodeRegex: /^\d{4}-\d{3}$/,
      phoneLabel: 'Phone',
      phonePrefix: '+351',
      phoneRegex: /^(\+351)?9\d{8}$/,
      phoneLandlineRegex: /^(\+351)?2\d{8}$/,
      taxIdLabel: 'NIF',
      taxIdPlaceholder: '123456789',
      taxIdRegex: /^\d{9}$/,
      taxLabel: 'VAT',
      taxRate: 0.23,
      taxRateReduced: 0.06,
      taxRateIntermediate: 0.13,
      taxInclLabel: 'incl. VAT',
      taxExclLabel: 'excl. VAT',
      thousandsSep: ',',
      decimalSep: '.',
      currencyFormat: (v: number) => `\u20ac${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
      addressLabels: { street: 'Address', city: 'City', district: 'District', postalCode: 'Postal code' },
      dateLongFormat: (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      holidays: [
        '01-01', '04-25', '05-01', '06-10', '08-15', '10-05', '11-01', '12-01', '12-08', '12-25'
      ],
    }
  }
  if (locale === 'pt') {
    return {
      postalCodeLabel: 'Código postal',
      postalCodePlaceholder: '1000-001',
      postalCodeRegex: /^\d{4}-\d{3}$/,
      phoneLabel: 'Telemóvel',
      phonePrefix: '+351',
      phoneRegex: /^(\+351)?9\d{8}$/,
      phoneLandlineRegex: /^(\+351)?2\d{8}$/,
      taxIdLabel: 'NIF',
      taxIdPlaceholder: '123456789',
      taxIdRegex: /^\d{9}$/,
      taxLabel: 'IVA',
      taxRate: 0.23,
      taxRateReduced: 0.06,
      taxRateIntermediate: 0.13,
      taxInclLabel: 'c/ IVA',
      taxExclLabel: 's/ IVA',
      thousandsSep: '.',
      decimalSep: ',',
      currencyFormat: (v: number) => `${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`,
      addressLabels: { street: 'Morada', city: 'Cidade', district: 'Distrito', postalCode: 'Código postal' },
      dateLongFormat: (d: Date) => d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }),
      holidays: [
        '01-01', '04-25', '05-01', '06-10', '08-15', '10-05', '11-01', '12-01', '12-08', '12-25'
      ],
    }
  }
  // Default: French
  return {
    postalCodeLabel: 'Code postal',
    postalCodePlaceholder: '75001',
    postalCodeRegex: /^\d{5}$/,
    phoneLabel: 'Téléphone',
    phonePrefix: '+33',
    phoneRegex: /^(\+33|0)[1-9]\d{8}$/,
    phoneLandlineRegex: /^(\+33|0)[1-5]\d{8}$/,
    taxIdLabel: 'SIRET',
    taxIdPlaceholder: '12345678901234',
    taxIdRegex: /^\d{14}$/,
    taxLabel: 'TVA',
    taxRate: 0.20,
    taxRateReduced: 0.055,
    taxRateIntermediate: 0.10,
    taxInclLabel: 'TTC',
    taxExclLabel: 'HT',
    thousandsSep: ' ',
    decimalSep: ',',
    currencyFormat: (v: number) => `${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`,
    addressLabels: { street: 'Adresse', city: 'Ville', district: 'Département', postalCode: 'Code postal' },
    dateLongFormat: (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    holidays: [
      '01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'
    ],
  }
}
