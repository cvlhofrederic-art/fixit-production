import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ArtisanProfilePage from '@/app/fr/artisan/[id]/page'
import { ficheAbsente } from '@/lib/seo/fiche-artisan'

// Fiches de société, servies par /fr/societe/[slug] et /pt/empresa/[slug] : même rendu que /fr/artisan/[id] (page
// client qui lit le slug). Un slug inconnu de profiles_artisan répond par une vraie 404 (not-found.tsx de la langue),
// et non plus par une fiche « Artisan non trouvé » servie en 200 et indexable. `origine` (« fr/societe »,
// « pt/empresa ») préfixe la trace d'une lecture Supabase en erreur.

export type ParamsFicheSociete = { params: Promise<{ slug: string }> }

// Métadonnées de la route pour une fiche existante, ou dont l'existence n'a pas pu être lue (panne : rien ne change).
// Slug inconnu : noindex, au cas où ces métadonnées accompagneraient malgré tout la 404 de la page.
export async function metadonneesFicheSociete(
  { params }: ParamsFicheSociete,
  origine: string,
  metadonnees: (slug: string) => Metadata,
): Promise<Metadata> {
  const { slug } = await params
  if (await ficheAbsente(slug, origine)) return { robots: { index: false, follow: false } }
  return metadonnees(slug)
}

export async function rendreFicheSociete({ params }: ParamsFicheSociete, origine: string) {
  const { slug } = await params
  if (await ficheAbsente(slug, origine)) notFound()
  return <ArtisanProfilePage />
}
