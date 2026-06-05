import { cookies } from 'next/headers'
import type { Metadata } from 'next'
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
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value || 'fr'
  const isPt = locale === 'pt'

  return <GererMarcheClient isPt={isPt} />
}
