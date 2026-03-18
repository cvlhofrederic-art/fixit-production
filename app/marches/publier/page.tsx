import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import PublierMarcheClient from './PublierMarcheClient'

export const metadata: Metadata = {
  title: 'Publier un appel d\'offres | Fixit',
  description: 'Publiez votre projet et recevez des devis d\'artisans qualifies',
}

export default async function PublierMarchePage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value || 'fr'
  const isPt = locale === 'pt'

  return <PublierMarcheClient isPt={isPt} />
}
