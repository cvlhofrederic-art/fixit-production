import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pesquisar profissionais verificados na sua zona',
  description: 'Encontre um profissional verificado na sua zona. Canalizador, eletricista, pintor e mais.',
  alternates: {
    canonical: 'https://vitfix.io/pt/pesquisar/',
    // Phase 1 SEO PT : plus d'alternate en vers l'accueil EN (non réciproque), x-default sur la
    // page FR (200) et non sur / (302).
    languages: {
      'pt-PT': 'https://vitfix.io/pt/pesquisar/',
      'fr-FR': 'https://vitfix.io/fr/recherche/',
      'x-default': 'https://vitfix.io/fr/recherche/',
    },
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
