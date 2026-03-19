import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mentions Légales | VITFIX',
  description: 'Mentions légales de la plateforme VITFIX — éditeur, hébergeur, propriété intellectuelle.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://vitfix.io/fr/mentions-legales/' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
