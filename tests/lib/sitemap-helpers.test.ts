import { describe, it, expect } from 'vitest'
import { formatSitemapXml, formatSitemapIndexXml } from '@/lib/sitemap-helpers'

describe('formatSitemapXml', () => {
  it('returns valid XML with declaration and urlset wrapper', () => {
    const xml = formatSitemapXml([
      { url: 'https://vitfix.io/pt/', lastModified: new Date('2026-01-01T00:00:00Z'), changeFrequency: 'daily', priority: 1.0 },
    ])
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://vitfix.io/pt/</loc>')
    expect(xml).toContain('<lastmod>2026-01-01T00:00:00.000Z</lastmod>')
    expect(xml).toContain('<changefreq>daily</changefreq>')
    expect(xml).toContain('<priority>1.00</priority>')
  })

  it('escapes special XML characters in URLs', () => {
    const xml = formatSitemapXml([{ url: 'https://vitfix.io/?q=a&b=c<>"\'' }])
    const loc = xml.match(/<loc>([^<]*)<\/loc>/)?.[1] ?? ''
    expect(loc).toBe('https://vitfix.io/?q=a&amp;b=c&lt;&gt;&quot;&apos;')
    expect(loc).not.toMatch(/&(?![a-z]+;)/)
  })

  it('handles empty url list gracefully', () => {
    const xml = formatSitemapXml([])
    expect(xml).toContain('<urlset')
    expect(xml).toContain('</urlset>')
    expect(xml).not.toContain('<url>')
  })

  it('omits optional fields when not provided', () => {
    const xml = formatSitemapXml([{ url: 'https://vitfix.io/' }])
    expect(xml).toContain('<loc>https://vitfix.io/</loc>')
    expect(xml).toContain('<lastmod>')
    expect(xml).not.toContain('<changefreq>')
    expect(xml).not.toContain('<priority>')
  })
})

describe('formatSitemapIndexXml', () => {
  it('returns sitemapindex with sitemap entries', () => {
    const xml = formatSitemapIndexXml([
      'https://vitfix.io/sitemap/0.xml',
      'https://vitfix.io/sitemap/1.xml',
    ])
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://vitfix.io/sitemap/0.xml</loc>')
    expect(xml).toContain('<loc>https://vitfix.io/sitemap/1.xml</loc>')
  })
})
