// PT alias for /fr/recherche - renders the same search page at a Portuguese URL
export { default } from '@/app/fr/recherche/page'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pesquisar profissionais | Vitfix',
  description: 'Pesquise e compare profissionais de construção disponíveis na sua zona.',
  // Pas d'alternates ici : la canonical et les hreflang (fr-FR → /fr/recherche/) viennent de layout.tsx,
  // et un alternates déclaré par la page remplacerait tout celui du layout.
}
