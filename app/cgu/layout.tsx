import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conditions Générales d\'Utilisation | VITFIX',
  description: 'Consultez les conditions générales d\'utilisation de la plateforme VITFIX.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://vitfix.io/cgu/' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
