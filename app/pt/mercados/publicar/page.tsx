import type { Metadata } from 'next'
import PublierMarcheClient from '@/app/fr/marches/publier/PublierMarcheClient'

export const metadata: Metadata = {
  title: 'Publique um pedido de orçamento',
  description: 'Descreva o seu projeto e receba orçamentos de profissionais qualificados próximos de si. 100% gratuito e sem compromisso.',
  alternates: {
    canonical: 'https://vitfix.io/pt/mercados/publicar/',
    languages: {
      'pt': 'https://vitfix.io/pt/mercados/publicar/',
      'fr': 'https://vitfix.io/fr/marches/publier/',
    },
  },
  openGraph: {
    title: 'Publique um pedido de orçamento | VITFIX Portugal',
    description: 'Receba propostas de profissionais certificados em menos de 2 horas. Gratuito e sem compromisso.',
    locale: 'pt_PT',
    type: 'website',
  },
}

export default function PublicarMercadoPage() {
  return <PublierMarcheClient isPt={true} />
}
