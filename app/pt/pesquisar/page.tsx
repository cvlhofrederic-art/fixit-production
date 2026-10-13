// PT alias for /fr/recherche - renders the same search page at a Portuguese URL
export { default } from '@/app/fr/recherche/page'

import type { Metadata } from 'next'

// Phase 1 SEO PT : marque une fois (template du layout).
export const metadata: Metadata = {
  title: 'Pesquisar profissionais verificados na sua zona',
  description: 'Pesquise e compare profissionais de construção verificados na sua zona: canalizador, eletricista, pintor e mais. Orçamento grátis, sem compromisso.',
  // Pas d'alternates ici : la canonical et les hreflang (fr-FR → /fr/recherche/) viennent de layout.tsx,
  // et un alternates déclaré par la page remplacerait tout celui du layout.
}
