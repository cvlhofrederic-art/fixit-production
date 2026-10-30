import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import PageIntrouvable from '@/components/common/PageIntrouvable'

// notFound() levé par une page commune (jeton inconnu, accès refusé…) : 404 sous le layout commun, locale du cookie.
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default async function NotFound() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value || 'fr'

  return <PageIntrouvable locale={locale} />
}
