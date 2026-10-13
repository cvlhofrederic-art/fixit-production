import type { Metadata } from 'next'
import { buildAboutPageSchema } from '@/lib/schemas'

export const metadata: Metadata = {
  title: 'Sobre nós: profissionais de confiança em Portugal',
  description: 'Conheça a VITFIX, a plataforma que liga particulares e profissionais de construção verificados em 22 concelhos dos distritos do Porto, Braga e Aveiro.',
  alternates: {
    canonical: 'https://vitfix.io/pt/sobre/',
    languages: {
      'pt-PT': 'https://vitfix.io/pt/sobre/',
      'fr-FR': 'https://vitfix.io/fr/a-propos/',
      'x-default': 'https://vitfix.io/fr/a-propos/',
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
