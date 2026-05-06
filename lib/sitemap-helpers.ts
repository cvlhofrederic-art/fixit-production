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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toIso(value: Date | string | undefined): string {
  if (!value) return new Date().toISOString()
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

export function formatSitemapXml(urls: SitemapUrl[]): string {
  const entries = urls
    .map(({ url, lastModified, changeFrequency, priority }) => {
      const parts = [`    <loc>${escapeXml(url)}</loc>`]
      parts.push(`    <lastmod>${toIso(lastModified)}</lastmod>`)
      if (changeFrequency) parts.push(`    <changefreq>${changeFrequency}</changefreq>`)
      if (typeof priority === 'number') parts.push(`    <priority>${priority.toFixed(2)}</priority>`)
      return `  <url>\n${parts.join('\n')}\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`
}

export function formatSitemapIndexXml(loc: string[]): string {
  const entries = loc
    .map((u) => `  <sitemap>\n    <loc>${escapeXml(u)}</loc>\n    <lastmod>${new Date().toISOString()}</lastmod>\n  </sitemap>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`
}

export const SITEMAP_HEADERS: HeadersInit = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, s-maxage=3600',
}
