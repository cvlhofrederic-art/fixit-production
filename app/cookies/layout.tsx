import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de Cookies | VITFIX',
  description: 'Informations sur les cookies utilisés par VITFIX et comment les gérer.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://vitfix.io/cookies/' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
