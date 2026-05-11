// Rota /pt/empresa/<slug> - URL canónica das empresas (Lda, SA, Unipessoal).
// Partilha a mesma lógica de renderização com /fr/artisan/[id].
export { default } from '@/app/fr/artisan/[id]/page'

import type { Metadata } from 'next'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  return {
    title: `Empresa | Vitfix`,
    robots: { index: true, follow: true },
    // Pro SEO 2026 : canonical self-référent + hreflang cross-locale
    // (la même empresa a une URL /fr/artisan/<slug>/ équivalente).
    alternates: {
      canonical: `https://vitfix.io/pt/empresa/${slug}/`,
      languages: {
        'pt-PT': `https://vitfix.io/pt/empresa/${slug}/`,
        'fr-FR': `https://vitfix.io/fr/artisan/${slug}/`,
        'x-default': 'https://vitfix.io/',
      },
    },
  }
}
