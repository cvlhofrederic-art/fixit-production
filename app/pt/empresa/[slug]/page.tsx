// Rota /pt/empresa/<slug> - URL canónica das empresas (Lda, SA, Unipessoal).
// Partilha a mesma lógica de renderização com /fr/artisan/[id].
export { default } from '@/app/fr/artisan/[id]/page'

import type { Metadata } from 'next'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  return {
    title: 'Empresa',
    robots: { index: true, follow: true },
    // Canonical self-référente, sans hreflang (phase 1 SEO PT, point 1.5) : /fr/artisan/<slug>/
    // n'émet aucun alternate retour, la paire ne serait pas réciproque.
    alternates: {
      canonical: `https://vitfix.io/pt/empresa/${slug}/`,
    },
  }
}
