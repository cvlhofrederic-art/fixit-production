import type { Metadata } from 'next'
import { buildAboutPageSchema } from '@/lib/schemas'

export const metadata: Metadata = {
  title: 'Sobre a VITFIX | A nossa missão',
  description: 'Conheça a VITFIX, a plataforma que liga particulares a profissionais verificados. A nossa missão: simplificar a reserva de serviços ao domicílio na região do Tâmega e Sousa.',
  alternates: {
    canonical: 'https://vitfix.io/pt/sobre/',
    languages: {
      'pt-PT': 'https://vitfix.io/pt/sobre/',
      'fr-FR': 'https://vitfix.io/fr/a-propos/',
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

const aboutSchema = buildAboutPageSchema({
  locale: 'pt',
  url: 'https://vitfix.io/pt/sobre/',
  homeUrl: 'https://vitfix.io/pt/',
  homeLabel: 'VITFIX',
  pageLabel: 'Sobre',
})

export default function Layout({ children }: { readonly children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }} />
      {children}
    </>
  )
}
