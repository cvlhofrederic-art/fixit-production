// Créneaux (availability) de la page de recherche (app/fr/recherche/page.tsx, reprise telle quelle par
// /pt/pesquisar/), demandés par lots d'identifiants.
//
// Constat du 23/10/2026 sur https://vitfix.io/pt/pesquisar/ (confirmé le 28/10, breadcrumbs Sentry) : les
// tables availability et bookings étaient interrogées en une seule requête GET `.in('artisan_id', ids)` sur
// les 758 fiches PT, soit une URL d'environ 30 Ko que Supabase refuse en 400 (mesuré : 558 identifiants,
// 21,9 Ko → 200 ; 758 identifiants, 29,7 Ko → 400). L'erreur était ignorée : la liste s'affichait sans
// créneaux, sans aucune trace.
//
// Corrections :
// - seules les fiches liées à un compte (source 'registered', user_id renseigné) peuvent avoir un agenda.
//   La page marque 'catalogue' toute fiche profiles_artisan sans user_id, et les fiches artisans_catalogue
//   (id `cat_…`) ne sont jamais dans profiles_artisan. Dans le code, availability n'est écrite que pour le
//   propriétaire du profil (POST /api/availability vérifie profiles_artisan.user_id, outils Fixy de
//   l'artisan connecté ; RLS availability_owner_write), et la carte d'une fiche sans compte n'affiche ni
//   agenda ni bouton de réservation ;
// - les identifiants restants partent par lots de TAILLE_LOT_IDS au plus (URL sous 4 000 caractères avec
//   l'hôte de production), interrogés en parallèle puis concaténés, avec les seules colonnes utilisées par
//   la page. Un lot en erreur est journalisé et remonté à Sentry ; les autres lots restent affichés, et la
//   page prévient le visiteur (toast) ;
// - `bookings` n'est plus lu depuis la page publique : la policy RLS « Users can view own bookings » ne
//   renvoie jamais rien à un visiteur anonyme, et un visiteur connecté n'y verrait que ses propres
//   réservations. Le filtre « disponibilités » se fonde donc sur les plages hebdomadaires seules, ce qui
//   était déjà le cas de fait pour tout visiteur anonyme. Les réservations restent côté serveur.

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Artisan } from '@/components/recherche/ArtisanCard'

/**
 * Nombre maximal d'identifiants par requête `.in('artisan_id', …)`. Un UUID pèse 39 caractères dans
 * l'URL (36 + la virgule encodée %2C) : 80 identifiants font environ 3,1 Ko, soit moins de 3,5 Ko avec le
 * reste de l'URL, sous le plafond de 4 000 caractères visé (critère d'acceptation du 28/10/2026).
 */
export const TAILLE_LOT_IDS = 80

/** Colonnes d'availability lues par la page (filtre « disponibilités » et badge « Intervention rapide »). */
export const COLONNES_DISPONIBILITES = 'id,artisan_id,day_of_week,start_time,end_time,is_available'

/** Découpe `valeurs` en lots consécutifs de `taille` éléments au plus, dans l'ordre d'origine. */
export function decouperEnLots<T>(valeurs: readonly T[], taille: number = TAILLE_LOT_IDS): T[][] {
  if (!Number.isInteger(taille) || taille < 1) {
    throw new RangeError(`Taille de lot invalide : ${taille}`)
  }
  const lots: T[][] = []
  for (let debut = 0; debut < valeurs.length; debut += taille) {
    lots.push(valeurs.slice(debut, debut + taille))
  }
  return lots
}

/**
 * Identifiants des fiches qui peuvent avoir des créneaux : fiches inscrites (source 'registered') liées à
 * un compte (user_id renseigné). Sans doublon, dans l'ordre d'origine.
 */
export function idsAvecAgenda(artisans: ReadonlyArray<Pick<Artisan, 'id' | 'source' | 'user_id'>>): string[] {
  const ids = new Set<string>()
  for (const artisan of artisans) {
    if (artisan.source === 'registered' && artisan.user_id) ids.add(artisan.id)
  }
  return Array.from(ids)
}

/** Erreur renvoyée par supabase-js (PostgrestError) ou levée pendant la requête. */
export interface ErreurRequete {
  message: string
  code?: string | null
  details?: string | null
  hint?: string | null
}

export interface ReponseLot<T> {
  data: T[] | null
  error: ErreurRequete | null
}

export interface ResultatParLots<T> {
  /** Lignes des lots réussis, dans l'ordre des lots. */
  lignes: T[]
  /** Une entrée par lot en échec (déjà journalisée et remontée à Sentry). */
  erreurs: ErreurRequete[]
}

function versErreurRequete(raison: unknown): ErreurRequete {
  if (raison instanceof Error) return { message: raison.message }
  return { message: String(raison) }
}

/**
 * Journalise une requête de recherche en échec et la remonte à Sentry (tags feature=recherche, table).
 * Ne lève jamais : l'affichage dégradé est décidé par l'appelant.
 */
export function signalerErreurRecherche(table: string, erreur: ErreurRequete, extra: Record<string, unknown> = {}): void {
  console.error(`Erreur fetch ${table} :`, erreur)
  Sentry.captureException(new Error(`recherche ${table} : ${erreur.message}`), {
    tags: { feature: 'recherche', table },
    extra: {
      code: erreur.code ?? null,
      details: erreur.details ?? null,
      hint: erreur.hint ?? null,
      ...extra,
    },
  })
}

/**
 * Lance `requete` sur chaque lot d'identifiants en parallèle et concatène les lignes dans l'ordre des
 * lots. Un lot en erreur (erreur renvoyée ou promesse rejetée) est signalé, compté dans `erreurs` et ne
 * donne aucune ligne ; les lignes des autres lots sont gardées.
 */
export async function chargerParLotsDetaille<T>(
  table: string,
  ids: readonly string[],
  requete: (lot: string[]) => PromiseLike<ReponseLot<T>>,
  taille: number = TAILLE_LOT_IDS,
): Promise<ResultatParLots<T>> {
  const lots = decouperEnLots(ids, taille)
  const reponses = await Promise.all(
    lots.map((lot) =>
      Promise.resolve()
        .then(() => requete(lot))
        .then(
          (reponse): ReponseLot<T> => reponse,
          (raison: unknown): ReponseLot<T> => ({ data: null, error: versErreurRequete(raison) }),
        ),
    ),
  )
  const lignes: T[] = []
  const erreurs: ErreurRequete[] = []
  reponses.forEach((reponse, indexLot) => {
    if (reponse.error) {
      signalerErreurRecherche(table, reponse.error, {
        lot: indexLot + 1,
        lots: lots.length,
        identifiants: lots[indexLot].length,
      })
      erreurs.push(reponse.error)
      return
    }
    for (const ligne of reponse.data ?? []) lignes.push(ligne)
  })
  return { lignes, erreurs }
}

/** Comme {@link chargerParLotsDetaille}, en ne gardant que les lignes. */
export async function chargerParLots<T>(
  table: string,
  ids: readonly string[],
  requete: (lot: string[]) => PromiseLike<ReponseLot<T>>,
  taille: number = TAILLE_LOT_IDS,
): Promise<T[]> {
  return (await chargerParLotsDetaille(table, ids, requete, taille)).lignes
}

/**
 * Créneaux d'un lot d'artisans. La recherche montre uniquement les créneaux RDV directs (pas les plages
 * Visite & devis, qui supposent un échange préalable avec l'artisan).
 */
export function requeteDisponibilites(client: SupabaseClient, lot: string[]) {
  return client
    .from('availability')
    .select(COLONNES_DISPONIBILITES)
    .in('artisan_id', lot)
    .eq('is_available', true)
    .or('slot_type.eq.rdv,slot_type.is.null')
    .order('day_of_week')
}
