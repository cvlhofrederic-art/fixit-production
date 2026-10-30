import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de Cookies | VITFIX',
  description: 'Informations sur les cookies utilisés par VITFIX et comment les gérer.',
  robots: { index: true, follow: true },
  // Page servie en FR seulement, via la réécriture /fr/cookies/ : /cookies/ répond 302 géolocalisé.
  alternates: { canonical: 'https://vitfix.io/fr/cookies/' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
