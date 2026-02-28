import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.fr'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/pro/', '/syndic/', '/client/', '/admin/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
