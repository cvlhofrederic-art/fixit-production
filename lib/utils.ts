import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number, locale: string = 'fr') {
  const intlLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  // Chiffres ronds : pas de décimales si le prix est entier (ex: 60 € au lieu de 60,00 €)
  const isRound = price === Math.floor(price)
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: isRound ? 0 : 2,
    maximumFractionDigits: isRound ? 0 : 2,
  }).format(price)
}

export function formatDate(date: string, locale: string = 'fr') {
  const intlLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: 'long'
  }).format(new Date(date))
}

/**
 * Returns the correct public profile path based on org_role and locale.
 * pro_societe → /fr/societe/[slug] or /pt/empresa/[slug]
 * artisan    → /fr/artisan/[slug] or /pt/profissional/[slug]
 */
export function getProfilePath(artisan: { slug?: string | null; id: string; org_role?: string | null }, locale: string): string {
  const identifier = artisan.slug || artisan.id
  const isCompany = artisan.org_role === 'pro_societe'
  if (locale === 'pt') {
    return isCompany ? `/pt/empresa/${identifier}` : `/pt/profissional/${identifier}`
  }
  return isCompany ? `/fr/societe/${identifier}` : `/fr/artisan/${identifier}`
}

/**
 * Génère un slug URL-safe depuis un nom (company_name)
 * "Lepore Sebastien" → "leporesebastien"
 * "Électricité Martin & Fils", "Marseille" → "electricite-martin-fils-marseille"
 */
export function generateSlug(name: string, city?: string): string {
  const raw = city ? `${name} ${city}` : name
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .substring(0, 60)
}
