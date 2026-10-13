import type { Metadata } from 'next'
import PublierMarcheClient from '@/app/fr/marches/publier/PublierMarcheClient'
import { grafo, noFilAriane, noWebPage } from '@/lib/seo/pt-schemas'

// JSON-LD (phase 1 SEO PT, point 1.6) : WebPage + fil d'Ariane, comme les autres pages statiques PT.
const jsonLd = grafo(
  noWebPage({ url: 'https://vitfix.io/pt/mercados/publicar/', nome: 'Publique um pedido de orçamento' }),
  noFilAriane([
    { name: 'VITFIX', url: 'https://vitfix.io/pt/' },
    { name: 'Publicar pedido', url: 'https://vitfix.io/pt/mercados/publicar/' },
  ]),
)

export const metadata: Metadata = {
  title: 'Publique um pedido de orçamento',
  description: 'Descreva o seu projeto e receba orçamentos de profissionais qualificados próximos de si. 100% gratuito e sem compromisso.',
  alternates: {
    canonical: 'https://vitfix.io/pt/mercados/publicar/',
    languages: {
      'pt-PT': 'https://vitfix.io/pt/mercados/publicar/',
      'fr-FR': 'https://vitfix.io/fr/marches/publier/',
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
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublierMarcheClient isPt={true} />
    </>
  )
}
