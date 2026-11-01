// Rota /pt/empresa/<slug> - URL canónica das empresas (Lda, SA, Unipessoal).
// Partilha a mesma lógica de renderização com /fr/artisan/[id] ; slug desconhecido : 404.
import type { Metadata } from 'next'
import { metadonneesFicheSociete, rendreFicheSociete, type ParamsFicheSociete } from '@/app/fr/societe/[slug]/fiche-societe'

export async function generateMetadata(props: ParamsFicheSociete): Promise<Metadata> {
  return metadonneesFicheSociete(props, 'pt/empresa', (slug) => ({
    title: 'Empresa',
    robots: { index: true, follow: true },
    // Canonical self-référente, sans hreflang (phase 1 SEO PT, point 1.5) : /fr/artisan/<slug>/
    // n'émet aucun alternate retour, la paire ne serait pas réciproque.
    alternates: {
      canonical: `https://vitfix.io/pt/empresa/${slug}/`,
    },
  }))
}

export default async function EmpresaPage(props: ParamsFicheSociete) {
  return rendreFicheSociete(props, 'pt/empresa')
}
