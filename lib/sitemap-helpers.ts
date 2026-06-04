// Shared helpers for manual sitemap generation
// Replaces Next.js generateSitemaps convention which is incompatible with
// OpenNext on Cloudflare Workers (sub-sitemaps were served empty in prod).

export interface SitemapUrl {
  url: string
  lastModified?: Date | string
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

function escapeXml(value: string): string {
  return value
    // Strip caractères de contrôle illégaux en XML 1.0 (ne peuvent être escaped)
    // Évite que Google reject le sitemap si une URL contient un \x00 obscur.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Convertit une date en ISO 8601, ou retourne null si pas de date réelle.
 *
 * Pro SEO 2026 : Google ignore (et pénalise long terme) les sitemaps qui
 * émettent un lastmod factice = date du jour à chaque crawl. Cf. John
 * Mueller 2023 : "fake lastmod is worse than no lastmod at all". Source :
 * https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
 *
 * Politique : on omet `<lastmod>` si on n'a pas de vraie date (pas de
 * fallback `new Date()`). Google parsera l'URL sans hint de fraîcheur,
 * ce qui est strictement préférable à un signal trompeur.
 */
function toIsoOrNull(value: Date | string | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function formatSitemapXml(urls: SitemapUrl[]): string {
  const entries = urls
    .map(({ url, lastModified, changeFrequency, priority }) => {
      const parts = [`    <loc>${escapeXml(url)}</loc>`]
      const iso = toIsoOrNull(lastModified)
      if (iso) parts.push(`    <lastmod>${iso}</lastmod>`)
      if (changeFrequency) parts.push(`    <changefreq>${changeFrequency}</changefreq>`)
      if (typeof priority === 'number') parts.push(`    <priority>${priority.toFixed(2)}</priority>`)
      return `  <url>\n${parts.join('\n')}\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`
}

/**
 * Formate un sitemap index. Le `<lastmod>` est OPTIONNEL au niveau de chaque
 * `<sitemap>` entry (sitemaps.org spec § 4) ; on l'omet pour ne pas envoyer
 * la date du jour systématiquement (signal pourri pour Google).
 *
 * Le caller peut passer `lastModByLoc` pour fournir des dates réelles par
 * sub-sitemap (ex: dérivées du dernier `contentUpdatedAt` de leur contenu).
 */
export function formatSitemapIndexXml(
  loc: string[],
  lastModByLoc?: Record<string, Date | string>,
): string {
  const entries = loc
    .map((u) => {
      const lastMod = lastModByLoc?.[u]
      const iso = toIsoOrNull(lastMod)
      const lastmodTag = iso ? `\n    <lastmod>${iso}</lastmod>` : ''
      return `  <sitemap>\n    <loc>${escapeXml(u)}</loc>${lastmodTag}\n  </sitemap>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`
}

export const SITEMAP_HEADERS: HeadersInit = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, s-maxage=3600',
}

// Validation stricte de l'ID de sub-sitemap dans /sitemap/[id].
// Sécurité (review #138) : accepte uniquement '0'-'4' ou '0.xml'-'4.xml'.
// Rejette '0.xml.xml', '0abc', '00', '-1', '5' → évite URLs canoniques
// dupliquées (mauvais signal SEO + canonical pollution).
export function parseSitemapId(idParam: string): number | null {
  if (!/^[0-4](\.xml)?$/.test(idParam)) return null
  return Number.parseInt(idParam, 10)
}
