import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ArtisanProfilePage from '@/app/fr/artisan/[id]/page'
import { ficheAbsente, lireFichePublique } from '@/lib/seo/fiche-artisan'
import { getProfilePath } from '@/lib/utils'

// Fiches de société, servies par /fr/societe/[slug] et /pt/empresa/[slug] : même rendu que /fr/artisan/[id] (page
// client qui lit le slug). Un slug inconnu de profiles_artisan répond par une vraie 404 (not-found.tsx de la langue),
// et non plus par une fiche « Artisan non trouvé » servie en 200 et indexable. `origine` (« fr/societe »,
// « pt/empresa ») préfixe la trace d'une lecture Supabase en erreur.

export type ParamsFicheSociete = { params: Promise<{ slug: string }> }

// Métadonnées de la route (`metadonnees`, canonical bâtie sur l'identifiant de la route) :
// - slug inconnu : noindex, au cas où ces métadonnées accompagneraient malgré tout la 404 de la page ;
// - fiche lue : canonical vers son adresse publique, celle du sitemap et de la redirection UUID (getProfilePath) :
//   /fr/artisan/<slug|id>/ pour une fiche FR, /pt/empresa/<slug|id>/ pour une société PT, /pt/profissional/<slug|id>/
//   sinon ; cette dernière est en noindex, la page qui la reprend aussi (comme /pt/profissional/[id]) ;
// - existence illisible (panne) : rien ne change, métadonnées de la route.
export async function metadonneesFicheSociete(
  { params }: ParamsFicheSociete,
  origine: string,
  metadonnees: (slug: string) => Metadata,
): Promise<Metadata> {
  const { slug } = await params
  const lecture = await lireFichePublique(slug, origine)
  if (lecture.statut === 'absent') return { robots: { index: false, follow: false } }
  if (lecture.statut === 'indisponible') return metadonnees(slug)
  const fiche = lecture.profil
  const chemin = getProfilePath(fiche, fiche.language === 'pt' ? 'pt' : 'fr')
  const avecCanonique: Metadata = { ...metadonnees(slug), alternates: { canonical: `https://vitfix.io${chemin}/` } }
  return chemin.startsWith('/pt/profissional/') ? { ...avecCanonique, robots: { index: false, follow: false } } : avecCanonique
}

export async function rendreFicheSociete({ params }: ParamsFicheSociete, origine: string) {
  const { slug } = await params
  if (await ficheAbsente(slug, origine)) notFound()
  return <ArtisanProfilePage />
}
