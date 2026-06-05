import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pesquisar Profissionais : VITFIX',
  description: 'Encontre um profissional verificado na sua zona. Canalizador, eletricista, pintor e mais.',
  alternates: {
    canonical: 'https://vitfix.io/pt/pesquisar/',
    languages: {
      'pt-PT': 'https://vitfix.io/pt/pesquisar/',
      'fr-FR': 'https://vitfix.io/fr/recherche/',
      'en': 'https://vitfix.io/en/',
      'x-default': 'https://vitfix.io/',
    },
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
