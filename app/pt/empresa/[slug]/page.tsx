// Rota /pt/empresa/<slug> — URL canónica das empresas (Lda, SA, Unipessoal).
// Partilha a mesma lógica de renderização com /fr/artisan/[id].
export { default } from '@/app/fr/artisan/[id]/page'

import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Empresa | Vitfix`,
    robots: { index: true, follow: true },
  }
}
