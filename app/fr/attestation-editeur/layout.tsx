import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Attestation éditeur : Logiciel de facturation conforme | VITFIX',
  description: 'Attestation individuelle de l\'éditeur Vitfix.io conformément à l\'article 88 de la loi de finances 2016 et à la loi de finances 2026 (modèle BOI-CF-COM-10-80).',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://vitfix.io/fr/attestation-editeur/' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
