import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import PageIntrouvable from '@/components/common/PageIntrouvable'
import { langueValideOuFr } from '@/lib/i18n/config'

// notFound() levé par une page commune (jeton inconnu, accès refusé…) : 404 sous le layout commun, dans la langue du
// chemin (x-locale), puis du cookie : après une navigation côté client, le cookie peut encore valoir la page quittée.
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default async function NotFound() {
  const locale = langueValideOuFr((await headers()).get('x-locale'), (await cookies()).get('locale')?.value)

  return <PageIntrouvable locale={locale} />
}
