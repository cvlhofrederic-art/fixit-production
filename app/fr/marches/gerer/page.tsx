import { cookies, headers } from 'next/headers'
import type { Metadata } from 'next'
import { langueValideOuFr } from '@/lib/i18n/config'
import GererMarcheClient from './GererMarcheClient'

export const metadata: Metadata = {
  title: 'Gérer mon appel d\'offres | Fixit',
  description: 'Gérez votre appel d\'offres et consultez les candidatures reçues',
  // Page de gestion (espace authentifié) — ne doit pas apparaître dans
  // l'index Google. canonical explicite + noindex pour clarté.
  alternates: { canonical: 'https://vitfix.io/fr/marches/gerer/' },
  robots: { index: false, follow: false },
}

export default async function GererMarchePage() {
  // Langue du chemin (x-locale), puis cookie : après une navigation côté client, le cookie peut encore valoir pt.
  const locale = langueValideOuFr((await headers()).get('x-locale'), (await cookies()).get('locale')?.value)
  const isPt = locale === 'pt'

  return <GererMarcheClient isPt={isPt} />
}
