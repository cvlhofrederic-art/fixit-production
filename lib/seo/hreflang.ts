/**
 * Pro SEO 2026 — hreflang centralisé pour toutes les pages du site.
 *
 * Politique unique (Google Search Central 2026) :
 *   - Codes BCP 47 régionalisés : fr-FR, pt-PT (cible explicite France vs Canada,
 *     Portugal vs Brésil). en/nl/es restent génériques (un seul marché chacun).
 *   - x-default → https://vitfix.io/ TOUJOURS (le root sert de fallback pour les
 *     locales non listées via geo-redirect + Vary: Accept-Language).
 *   - Cross-locale : chaque entry pointe vers l'équivalent dans l'autre locale,
 *     ou un hub si l'équivalent n'existe pas (fallback explicite et stable).
 *
 * Sources :
 *   - developers.google.com/search/docs/specialty/international/managing-multi-regional-sites
 *   - developers.google.com/search/docs/specialty/international/localized-versions
 *   - developers.google.com/search/blog/2013/04/x-default-hreflang-for-international-pages
 */

import type { Metadata } from 'next'

const BASE_URL = 'https://vitfix.io'

export type LocaleAlternate = {
  /** URL FR équivalente (page ou hub /fr/) */
  fr: string
  /** URL PT équivalente (page ou hub /pt/) */
  pt: string
  /** URL EN équivalente (page ou hub /en/). Optionnel si EN passif. */
  en?: string
}

/**
 * Construit un objet `alternates` Next.js Metadata complet et conforme.
 *
 * @param canonical - URL canonique self-référente de la page courante.
 * @param alternates - URLs équivalentes par locale. Au minimum fr + pt.
 *
 * @example
 *   alternates: buildAlternates(
 *     `${BASE_URL}/fr/services/${slug}/`,
 *     { fr: `${BASE_URL}/fr/services/${slug}/`,
 *       pt: `${BASE_URL}/pt/servicos/`,
 *       en: `${BASE_URL}/en/` }
 *   )
 */
export function buildAlternates(
  canonical: string,
  alternates: LocaleAlternate,
): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {
    'fr-FR': alternates.fr,
    'pt-PT': alternates.pt,
    'x-default': BASE_URL + '/',
  }
  if (alternates.en) {
    languages['en'] = alternates.en
  }
  return {
    canonical,
    languages,
  }
}

/** Helper raccourci pour pages PT-first (cidade, urgencia, etc.) */
export function buildPtAlternates(
  slug: string,
  ptPath: string,
  frFallback: string = '/fr/',
): NonNullable<Metadata['alternates']> {
  return buildAlternates(`${BASE_URL}${ptPath}${slug}/`, {
    pt: `${BASE_URL}${ptPath}${slug}/`,
    fr: `${BASE_URL}${frFallback}`,
    en: `${BASE_URL}/en/`,
  })
}

/** Helper raccourci pour pages FR-first (services, ville, etc.) */
export function buildFrAlternates(
  slug: string,
  frPath: string,
  ptFallback: string = '/pt/',
): NonNullable<Metadata['alternates']> {
  return buildAlternates(`${BASE_URL}${frPath}${slug}/`, {
    fr: `${BASE_URL}${frPath}${slug}/`,
    pt: `${BASE_URL}${ptFallback}`,
    en: `${BASE_URL}/en/`,
  })
}
