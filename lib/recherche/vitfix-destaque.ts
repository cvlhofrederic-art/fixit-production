// Fiche VITFIX épinglée en tête des résultats de /pt/pesquisar/ (demande du propriétaire du
// 14/10/2026) : toujours première, quel que soit le métier, la localité ou les filtres, avec le
// numéro de téléphone visible à la place de « Agendar visita » (agenda non utilisé pour l'instant)
// et le badge « Profissional certificado ». Partie PT seulement : /fr/recherche/ n'en fait rien.
//
// La fiche est construite depuis l'entité légale du code (lib/seo/entite-pt.ts), pas depuis la
// base : aucune fiche à créer ni à maintenir dans profiles_artisan, aucune donnée inventée (nom,
// numéro et siège sont ceux publiés sur tout le site PT).

import type { Artisan } from '@/components/recherche/ArtisanCard'
import { ENTITE_PT, TELEFONE_PT_TEXTE } from '@/lib/seo/entite-pt'
import { normalizeForSearch } from '@/lib/search-categories'

/** Identifiant de la fiche épinglée (jamais un id de la base). */
export const VITFIX_DESTAQUE_ID = 'vitfix-destaque'

/**
 * Catégories de recherche (slugs FR de lib/categories.ts) qui correspondent à l'un des 21 métiers
 * publiés sur le site PT (lib/seo/pt-grelha.ts, hubs /pt/perto-de-mim/{metier}/). Une recherche sur une
 * autre catégorie (déménagement, désinsectisation, chauffage, piscine, ramonage, diagnostic…) affiche
 * la fiche VITFIX sans ligne de métier : VITFIX ne publie pas ce service en PT.
 */
export const CATEGORIAS_VITFIX_PT = new Set<string>([
  'plomberie', 'electricite', 'serrurerie', 'peinture', 'maconnerie', 'menuiserie', 'toiture', 'climatisation',
  'renovation', 'vitrerie', 'petits-travaux', 'espaces-verts', 'nettoyage', 'carrelage', 'nettoyage-copro',
  'plaquiste', 'store-banne', 'debouchage', 'metallerie',
])

/**
 * Fiche VITFIX à afficher en premier. `categoria` est le slug de catégorie résolu de la recherche
 * (ex. 'plomberie') : la fiche l'affiche comme métier s'il fait partie des métiers PT de VITFIX ;
 * sinon, et sans catégorie, aucune ligne de métier.
 */
export function cartaoVitfix(categoria?: string | null): Artisan {
  return {
    id: VITFIX_DESTAQUE_ID,
    company_name: ENTITE_PT.nome,
    bio: null,
    categories: categoria && CATEGORIAS_VITFIX_PT.has(categoria) ? [categoria] : [],
    hourly_rate: null,
    rating_avg: 0,
    rating_count: 0,
    verified: true,
    active: true,
    zone_radius_km: 0,
    city: ENTITE_PT.adresse.addressLocality,
    country: 'PT',
    source: 'vitfix',
    telephone_pro: TELEFONE_PT_TEXTE,
  }
}

/** Retire une éventuelle fiche VITFIX venue de la base (inscrit ou catalogue) pour ne pas la doubler. */
export function semFichaVitfix(lista: Artisan[]): Artisan[] {
  return lista.filter(
    (a) => a.id !== VITFIX_DESTAQUE_ID && !normalizeForSearch(a.company_name || '').includes('vitfix'),
  )
}

/** Liste affichée sur /pt/pesquisar/ : la fiche VITFIX, puis les résultats dans leur ordre d'origine. */
export function comVitfixPrimeiro(lista: Artisan[], categoria?: string | null): Artisan[] {
  return [cartaoVitfix(categoria), ...semFichaVitfix(lista)]
}
