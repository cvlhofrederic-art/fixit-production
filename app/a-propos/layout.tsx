import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'A propos de VITFIX | Notre mission',
  description: 'Découvrez VITFIX, la plateforme qui connecte particuliers et artisans vérifiés. Notre mission : simplifier la réservation de services à domicile.',
  openGraph: {
    title: 'A propos de VITFIX',
    description: 'La plateforme qui connecte particuliers et artisans vérifiés pour des services à domicile rapides et fiables.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
