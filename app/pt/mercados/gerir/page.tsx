import type { Metadata } from 'next'
import GererMarcheClient from '@/app/fr/marches/gerer/GererMarcheClient'

export const metadata: Metadata = {
  title: 'Gerir o meu pedido de orçamento',
  description: 'Acompanhe o seu pedido de orçamento e consulte as candidaturas recebidas dos profissionais.',
  alternates: {
    canonical: 'https://vitfix.io/pt/mercados/gerir/',
    languages: {
      'pt-PT': 'https://vitfix.io/pt/mercados/gerir/',
      'fr-FR': 'https://vitfix.io/fr/marches/gerer/',
      'x-default': 'https://vitfix.io/pt/mercados/gerir/',
    },
  },
}

export default function GerirMercadoPage() {
  return <GererMarcheClient isPt={true} />
}
