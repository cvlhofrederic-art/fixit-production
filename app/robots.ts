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

  return {
    rules: [
      // Default - allow everything public
      {
        userAgent: '*',
        allow: '/',
        disallow: privateDisallow,
      },
      // AI Crawlers - explicit allow for GEO (Generative Engine Optimization)
      { userAgent: 'GPTBot', allow: '/', disallow: privateDisallow },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: privateDisallow },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: privateDisallow },
      { userAgent: 'ClaudeBot', allow: '/', disallow: privateDisallow },
      { userAgent: 'Claude-Web', allow: '/', disallow: privateDisallow },
      { userAgent: 'anthropic-ai', allow: '/', disallow: privateDisallow },
      { userAgent: 'PerplexityBot', allow: '/', disallow: privateDisallow },
      { userAgent: 'Perplexity-User', allow: '/', disallow: privateDisallow },
      { userAgent: 'GoogleOther', allow: '/', disallow: privateDisallow },
      { userAgent: 'Google-Extended', allow: '/', disallow: privateDisallow },
      { userAgent: 'Applebot', allow: '/', disallow: privateDisallow },
      { userAgent: 'Applebot-Extended', allow: '/', disallow: privateDisallow },
      { userAgent: 'Bytespider', allow: '/', disallow: privateDisallow },
      { userAgent: 'cohere-ai', allow: '/', disallow: privateDisallow },
      { userAgent: 'cohere-training-data-crawler', allow: '/', disallow: privateDisallow },
      { userAgent: 'Meta-ExternalAgent', allow: '/', disallow: privateDisallow },
      { userAgent: 'meta-externalagent', allow: '/', disallow: privateDisallow },
      { userAgent: 'MistralAI-User', allow: '/', disallow: privateDisallow },
      { userAgent: 'Diffbot', allow: '/', disallow: privateDisallow },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
