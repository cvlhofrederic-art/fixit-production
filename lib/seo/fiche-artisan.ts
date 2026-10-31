import { cache } from 'react'
import { logger } from '@/lib/logger'

// Lecture serveur des fiches publiques de profiles_artisan (REST Supabase, clé anon, sans cache) : métadonnées et
// JSON-LD de /fr/artisan/[id], existence des fiches de société /fr/societe/[slug] et /pt/empresa/[slug].

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 'absent' : Supabase a répondu sans ligne (identifiant inconnu). 'indisponible' : configuration absente ou
// réponse en erreur, on ne peut rien conclure sur l'existence du profil (pas de noindex sur une panne).
export type LectureProfil<T> = { statut: 'trouve'; profil: T } | { statut: 'absent' } | { statut: 'indisponible' }

// `id` : UUID ou slug. `origine` (« fr/artisan », « fr/societe »…) préfixe la trace d'une réponse en erreur.
export async function fetchArtisanProfile<T>(id: string, fields: string, origine: string): Promise<LectureProfil<T>> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { statut: 'indisponible' }
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const column = isUUID ? 'id' : 'slug'
  const url = `${SUPABASE_URL}/rest/v1/profiles_artisan?select=${encodeURIComponent(fields)}&${column}=eq.${encodeURIComponent(id)}&limit=1`

  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    logger.warn(`[${origine}] lecture Supabase en erreur`, { id, status: res.status })
    return { statut: 'indisponible' }
  }
  const rows: T[] = await res.json()
  return rows[0] ? { statut: 'trouve', profil: rows[0] } : { statut: 'absent' }
}

// Vrai seulement si Supabase répond sans ligne pour ce slug ou cet UUID : la fiche n'existe pas. Une panne, une réponse
// en erreur ou une configuration absente ne concluent rien (faux), la fiche est alors rendue comme avant. Une seule
// lecture par requête (cache de React), partagée par generateMetadata et la page.
export const ficheAbsente = cache(async (id: string, origine: string): Promise<boolean> => {
  try {
    return (await fetchArtisanProfile<{ id: string }>(id, 'id', origine)).statut === 'absent'
  } catch (error) {
    logger.warn(`[${origine}] existence de la fiche illisible`, { id, error: String(error) })
    return false
  }
})
