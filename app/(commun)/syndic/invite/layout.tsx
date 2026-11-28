import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Invitation Équipe — VITFIX Syndic',
  description: 'Acceptez votre invitation pour rejoindre un cabinet de syndic sur VITFIX.',
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://vitfix.io/syndic/invite/' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
