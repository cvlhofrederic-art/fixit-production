import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sobre a VITFIX | A nossa missão',
  description: 'Conheça a VITFIX, a plataforma que liga particulares a profissionais verificados. A nossa missão: simplificar a reserva de serviços ao domicílio na região do Tâmega e Sousa.',
  alternates: {
    canonical: 'https://vitfix.io/pt/sobre/',
    languages: {
      'pt': 'https://vitfix.io/pt/sobre/',
      'fr': 'https://vitfix.io/fr/a-propos/',
      'x-default': 'https://vitfix.io/pt/sobre/',
    },
  },
  openGraph: {
    title: 'Sobre a VITFIX',
    description: 'A plataforma que liga particulares a profissionais verificados para serviços rápidos e fiáveis ao domicílio.',
    type: 'website',
    url: 'https://vitfix.io/pt/sobre/',
    siteName: 'VITFIX',
    locale: 'pt_PT',
  },
}

// AboutPage schema PT — pointe via mainEntity.@id vers l'Organization
// globale (entity SEO 2026 Knowledge Graph linking).
const aboutSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': 'https://vitfix.io/pt/sobre/#aboutpage',
  url: 'https://vitfix.io/pt/sobre/',
  inLanguage: 'pt-PT',
  mainEntity: { '@id': 'https://vitfix.io/#business' },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
      { '@type': 'ListItem', position: 2, name: 'Sobre', item: 'https://vitfix.io/pt/sobre/' },
    ],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }} />
      {children}
    </>
  )
}
