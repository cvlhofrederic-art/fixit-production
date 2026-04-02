// PT alias for /fr/recherche — renders the same search page at a Portuguese URL
export { default } from '@/app/fr/recherche/page'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pesquisar profissionais | Vitfix',
  description: 'Pesquise e compare profissionais de construção disponíveis na sua zona.',
  alternates: { canonical: 'https://vitfix.io/pt/pesquisar' },
}
