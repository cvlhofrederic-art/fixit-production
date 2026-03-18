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
  ]

  return {
    rules: [
      // Default — allow everything public
      {
        userAgent: '*',
        allow: '/',
        disallow: privateDisallow,
      },
      // AI Crawlers — explicit allow for GEO (Generative Engine Optimization)
      { userAgent: 'GPTBot', allow: '/', disallow: privateDisallow },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: privateDisallow },
      { userAgent: 'ClaudeBot', allow: '/', disallow: privateDisallow },
      { userAgent: 'anthropic-ai', allow: '/', disallow: privateDisallow },
      { userAgent: 'PerplexityBot', allow: '/', disallow: privateDisallow },
      { userAgent: 'GoogleOther', allow: '/', disallow: privateDisallow },
      { userAgent: 'cohere-ai', allow: '/', disallow: privateDisallow },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
