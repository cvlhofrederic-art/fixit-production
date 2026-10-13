import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'

  const privateDisallow = [
    '/pro/',
    '/syndic/',
    '/client/',
    '/admin/',
    '/api/',
    '/auth/',
    '/coproprietaire/',
    // Locale-prefixed private paths
    '/*/pro/',
    '/*/syndic/',
    '/*/client/',
    '/*/admin/',
    '/*/api/',
    '/*/auth/',
    '/*/coproprietaire/',
    // Faceted navigation URLs (filter combinations create infinite duplicate
    // content). Per Google "Faceted Navigation Best Practices" 2026 :
    // https://developers.google.com/search/blog/2014/02/faceted-navigation-best-and-5-of-worst
    // Protège le crawl budget — empêche Googlebot d'épuiser son budget sur
    // des variantes de `?category=plomberie`, `?q=...`, `?page=2`, etc.
    '/*/recherche/*?*',
    '/*/pesquisar/*?*',
    '/recherche/*?*',
    '/pesquisar/*?*',
    // Tracking params jamais canoniques — éviter index pollution.
    '/*?utm_*',
    '/*?fbclid=*',
    '/*?gclid=*',
    '/*?ref=*',
    '/*?_branch_match_id=*',
  ]

  // Phase 1 SEO PT (point 1.7) : l'image sociale (og:image, image du JSON-LD) est servie par
  // /api/og/ ; sans cette règle, « Disallow: /api/ » la bloquait pour Googlebot. Règle plus
  // longue que « /api/ », donc prioritaire (algorithme robots.txt de Google).
  const publicAllow = ['/', '/api/og/']

  return {
    rules: [
      // Default - allow everything public
      {
        userAgent: '*',
        allow: publicAllow,
        disallow: privateDisallow,
      },
      // AI Crawlers - explicit allow for GEO (Generative Engine Optimization)
      { userAgent: 'GPTBot', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'ChatGPT-User', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'OAI-SearchBot', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'ClaudeBot', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'Claude-Web', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'anthropic-ai', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'PerplexityBot', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'Perplexity-User', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'GoogleOther', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'Google-Extended', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'Applebot', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'Applebot-Extended', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'Bytespider', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'cohere-ai', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'cohere-training-data-crawler', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'Meta-ExternalAgent', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'meta-externalagent', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'MistralAI-User', allow: publicAllow, disallow: privateDisallow },
      { userAgent: 'Diffbot', allow: publicAllow, disallow: privateDisallow },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
