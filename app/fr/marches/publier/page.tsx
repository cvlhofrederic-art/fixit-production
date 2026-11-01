import { cookies, headers } from 'next/headers'
import type { Metadata } from 'next'
import { langueValideOuFr } from '@/lib/i18n/config'
import PublierMarcheClient from './PublierMarcheClient'

// Langue du chemin (x-locale), puis cookie : avec le seul cookie pt, encore posé après une navigation côté client,
// /fr/marches/publier/ sortait un titre PT et la canonique /pt/mercados/publicar/.
async function estPt() {
  return langueValideOuFr((await headers()).get('x-locale'), (await cookies()).get('locale')?.value) === 'pt'
}

export async function generateMetadata(): Promise<Metadata> {
  const isPt = await estPt()

  return {
    title: isPt
      ? 'Publique um pedido de orçamento'
      : 'Publier un appel d\'offres',
    description: isPt
      ? 'Descreva o seu projeto e receba orçamentos de profissionais qualificados. Gratuito e sem compromisso.'
      : 'Publiez votre projet et recevez des devis d\'artisans qualifiés. Gratuit et sans engagement.',
    alternates: {
      canonical: isPt
        ? 'https://vitfix.io/pt/mercados/publicar/'
        : 'https://vitfix.io/fr/marches/publier/',
      // Réciproque de app/pt/mercados/publicar/page.tsx (même paire pour les deux branches).
      languages: {
        'fr-FR': 'https://vitfix.io/fr/marches/publier/',
        'pt-PT': 'https://vitfix.io/pt/mercados/publicar/',
      },
    },
  }
}

export default async function PublierMarchePage() {
  const isPt = await estPt()

  return <PublierMarcheClient isPt={isPt} />
}
