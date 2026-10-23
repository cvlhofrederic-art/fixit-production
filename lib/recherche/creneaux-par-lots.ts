// Créneaux (availability) et réservations (bookings) de la page de recherche
// (app/fr/recherche/page.tsx, reprise telle quelle par /pt/pesquisar/), demandés par lots d'identifiants.
//
// Constat du 23/10/2026 sur https://vitfix.io/pt/pesquisar/ : les deux tables étaient interrogées en une
// seule requête GET `.in('artisan_id', ids)` sur les 758 fiches PT, soit une URL d'environ 30 Ko que
// Supabase refuse en 400 (mesuré : 558 identifiants, 21,9 Ko → 200 ; 758 identifiants, 29,7 Ko → 400).
// L'erreur était ignorée : la liste s'affichait sans créneaux ni réservations, sans aucune trace.
//
// Corrections :
// - seules les fiches liées à un compte (source 'registered', user_id renseigné) peuvent avoir un agenda.
//   La page marque 'catalogue' toute fiche profiles_artisan sans user_id, et les fiches artisans_catalogue
//   (id `cat_…`) ne sont jamais dans profiles_artisan. Dans le code, availability n'est écrite que pour le
//   propriétaire du profil (POST /api/availability vérifie profiles_artisan.user_id, outils Fixy de
//   l'artisan connecté ; RLS availability_owner_write dans les migrations du dépôt), et la carte d'une
//   fiche sans compte n'affiche ni agenda ni bouton de réservation ;
// - les identifiants restants partent par lots de TAILLE_LOT_IDS au plus (environ 6 Ko d'URL), interrogés
//   en parallèle puis concaténés. Un lot en erreur est journalisé et remonté à Sentry ; les autres lots
//   restent affichés.

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Artisan } from '@/components/recherche/ArtisanCard'

/**
 * Nombre maximal d'identifiants par requête `.in('artisan_id', …)`. Un UUID pèse 39 caractères dans
 * l'URL (36 + la virgule encodée %2C) : 150 identifiants font environ 5,9 Ko, loin des 21,9 Ko qui
 * passaient encore en production.
 */
export const TAILLE_LOT_IDS = 150

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
 * Identifiants des fiches qui peuvent avoir des créneaux ou des réservations : fiches inscrites
 * (source 'registered') liées à un compte (user_id renseigné). Sans doublon, dans l'ordre d'origine.
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

function versErreurRequete(raison: unknown): ErreurRequete {
  if (raison instanceof Error) return { message: raison.message }
  return { message: String(raison) }
}

function signalerErreurLot(table: string, erreur: ErreurRequete, indexLot: number, nbLots: number, nbIds: number): void {
  console.error(`Erreur fetch ${table} (lot ${indexLot + 1}/${nbLots}, ${nbIds} identifiants) :`, erreur)
  Sentry.captureException(new Error(`recherche ${table} : ${erreur.message}`), {
    tags: { feature: 'recherche', table },
    extra: {
      code: erreur.code ?? null,
      details: erreur.details ?? null,
      hint: erreur.hint ?? null,
      lot: indexLot + 1,
      lots: nbLots,
      identifiants: nbIds,
    },
  })
}

/**
 * Lance `requete` sur chaque lot d'identifiants en parallèle et concatène les lignes dans l'ordre des
 * lots. Un lot en erreur (erreur renvoyée ou promesse rejetée) est signalé et ne compte pour aucune
 * ligne ; les lignes des autres lots sont gardées.
 */
export async function chargerParLots<T>(
  table: string,
  ids: readonly string[],
  requete: (lot: string[]) => PromiseLike<ReponseLot<T>>,
  taille: number = TAILLE_LOT_IDS,
): Promise<T[]> {
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
  reponses.forEach((reponse, indexLot) => {
    if (reponse.error) {
      signalerErreurLot(table, reponse.error, indexLot, lots.length, lots[indexLot].length)
      return
    }
    for (const ligne of reponse.data ?? []) lignes.push(ligne)
  })
  return lignes
}

/**
 * Créneaux d'un lot d'artisans. La recherche montre uniquement les créneaux RDV directs (pas les plages
 * Visite & devis, qui supposent un échange préalable avec l'artisan).
 */
export function requeteDisponibilites(client: SupabaseClient, lot: string[]) {
  return client
    .from('availability')
    .select('*')
    .in('artisan_id', lot)
    .eq('is_available', true)
    .or('slot_type.eq.rdv,slot_type.is.null')
    .order('day_of_week')
}

/** Réservations confirmées ou en attente d'un lot d'artisans, à partir de `dateDuJour` (yyyy-MM-dd). */
export function requeteReservations(client: SupabaseClient, lot: string[], dateDuJour: string) {
  return client
    .from('bookings')
    .select('*')
    .in('artisan_id', lot)
    .gte('booking_date', dateDuJour)
    .in('status', ['confirmed', 'pending'])
}
