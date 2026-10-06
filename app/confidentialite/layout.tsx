import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de Confidentialité | VITFIX',
  description: 'Découvrez comment VITFIX protège vos données personnelles conformément au RGPD.',
  robots: { index: true, follow: true },
  // Page servie en FR seulement, via la réécriture /fr/confidentialite/ : /confidentialite/ répond 302 géolocalisé.
  alternates: { canonical: 'https://vitfix.io/fr/confidentialite/' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
