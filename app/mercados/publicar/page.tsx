import type { Metadata } from 'next'
import PublierMarcheClient from '@/app/marches/publier/PublierMarcheClient'

export const metadata: Metadata = {
  title: 'Publique um pedido de orçamento | VITFIX',
  description: 'Descreva o seu projeto e receba orçamentos de profissionais qualificados próximos de si. 100% gratuito e sem compromisso.',
  alternates: {
    canonical: 'https://vitfix.io/pt/mercados/publicar/',
  },
}

export default function MercadosPublicarPage() {
  return <PublierMarcheClient isPt={true} />
}
