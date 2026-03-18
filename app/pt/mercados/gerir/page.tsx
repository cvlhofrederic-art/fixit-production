import type { Metadata } from 'next'
import GererMarcheClient from '@/app/marches/gerer/GererMarcheClient'

export const metadata: Metadata = {
  title: 'Gerir o meu pedido de orçamento',
  description: 'Acompanhe o seu pedido de orçamento e consulte as candidaturas recebidas dos profissionais.',
  alternates: {
    canonical: 'https://vitfix.io/pt/mercados/gerir/',
  },
}

export default function GerirMercadoPage() {
  return <GererMarcheClient isPt={true} />
}
