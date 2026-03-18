import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sobre Nós — VITFIX | Quem somos',
  description: 'Conheça a equipa VITFIX. Plataforma de serviços domésticos na região do Tâmega e Sousa.',
  alternates: { canonical: 'https://vitfix.io/sobre/' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
