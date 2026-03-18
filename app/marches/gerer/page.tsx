import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import GererMarcheClient from './GererMarcheClient'

export const metadata: Metadata = {
  title: 'Gérer mon appel d\'offres | Fixit',
  description: 'Gérez votre appel d\'offres et consultez les candidatures reçues',
}

export default async function GererMarchePage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value || 'fr'
  const isPt = locale === 'pt'

  return <GererMarcheClient isPt={isPt} />
}
