import type { Metadata } from 'next'
import { buildAboutPageSchema } from '@/lib/schemas'

export const metadata: Metadata = {
  title: 'À propos de VITFIX | Notre mission',
  description: 'Découvrez VITFIX, la plateforme qui connecte particuliers et artisans vérifiés. Notre mission : simplifier la réservation de services à domicile.',
  alternates: {
    canonical: 'https://vitfix.io/fr/a-propos/',
    languages: {
      'fr': 'https://vitfix.io/fr/a-propos/',
      'pt': 'https://vitfix.io/pt/sobre/',
      'x-default': 'https://vitfix.io/fr/a-propos/',
    },
  },
  openGraph: {
    title: 'À propos de VITFIX',
    description: 'La plateforme qui connecte particuliers et artisans vérifiés pour des services à domicile rapides et fiables.',
    type: 'website',
    url: 'https://vitfix.io/fr/a-propos/',
    siteName: 'VITFIX',
    locale: 'fr_FR',
  },
}

const aboutSchema = buildAboutPageSchema({
  locale: 'fr',
  url: 'https://vitfix.io/fr/a-propos/',
  homeUrl: 'https://vitfix.io/fr/',
  homeLabel: 'VITFIX',
  pageLabel: 'À propos',
})

export default function Layout({ children }: { readonly children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }} />
      {children}
    </>
  )
}
