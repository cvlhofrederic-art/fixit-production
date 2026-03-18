import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import PublierMarcheClient from './PublierMarcheClient'

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value || 'fr'
  const isPt = locale === 'pt'

  return {
    title: isPt
      ? 'Publique um pedido de orçamento | VITFIX'
      : 'Publier un appel d\'offres | VITFIX',
    description: isPt
      ? 'Descreva o seu projeto e receba orçamentos de profissionais qualificados. Gratuito e sem compromisso.'
      : 'Publiez votre projet et recevez des devis d\'artisans qualifiés. Gratuit et sans engagement.',
    alternates: {
      canonical: isPt
        ? 'https://vitfix.io/pt/mercados/publicar/'
        : 'https://vitfix.io/fr/marches/publier/',
    },
  }
}

export default async function PublierMarchePage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value || 'fr'
  const isPt = locale === 'pt'

  return <PublierMarcheClient isPt={isPt} />
}
