// ── AJ Signalement, côté serveur : bureaux des cabinets clients (migration 20261119) ───────────────────────────────
//
// Importé par les routes du SUPER ADMIN seulement (choix 3 : bureaux tenus par lui) : app/api/aj-signalement/cabinets/
// [id]/bureaux, bureaux/[id], et les routes des cabinets, des fiches, des copropriétés et du tableau qui portent le
// bureau. Jamais par une route d'un gestionnaire : la visibilité ne change pas (choix 5), ses réponses n'ont aucune clé
// nouvelle. Clé service (supabaseAdmin), RLS sans politique : le contrôle d'accès est fait par la route.
//   - lectures d'AFFICHAGE (avecBureaux…, nombresBureauxParCabinetQr) : ne lèvent jamais ; migration absente → réponse
//     d'avant (aucune clé de bureau), repli journalisé une fois ; autre erreur → journalisée avec son code seul ;
//   - lectures de CONTRÔLE (avant une écriture, filtres) : l'erreur est rendue, la route répond avant d'écrire
//     (structure absente → 503 base_absente ; autre → 500) — jamais un contrôle sauté en silence ;
//   - clé posée seulement quand il y a un bureau : tant qu'aucun bureau n'existe, rien ne change pour personne.
// La base reste juge (triggers bureau_requis et bureau_ferme, clés étrangères composées) ; ces contrôles refusent plus
// tôt, avec un code précis. Le nom d'un bureau n'est jamais écrit au journal ni dans un message du serveur.

import type { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import {
  FILTRE_SANS_BUREAU_QR, bureauDepuisLigneQr, bureauRequisQr, bureauResumeDepuisLigneQr, nombresBureauxQr,
  type BureauQr, type BureauResumeQr, type LigneBureauQr, type NombresBureauxQr,
} from '@/lib/aj-signalement/bureaux'
import {
  TABLE_COPROPRIETES_QR, TABLE_GESTIONNAIRES_QR, journaliserRepliBureauxQr, lireParValeursQr, reponseErreur, reponseErreurSqlQr,
  structureAbsenteQr, type ErreurBase, type LectureQr,
} from '@/lib/aj-signalement/serveur'

const CONTEXTE = '[AJ SIGNALEMENT]'

export const TABLE_BUREAUX_QR = 'signalements_qr_bureaux'
/** Colonnes d'un bureau lues par les routes. */
export const COLONNES_BUREAU_QR = 'id, cabinet_id, nom, ferme_le, created_at'

/** Table qui porte un bureau (colonne bureau_id). */
type TableRattacheeQr = typeof TABLE_GESTIONNAIRES_QR | typeof TABLE_COPROPRIETES_QR

/** Refus d'un contrôle : la réponse à rendre, avant toute écriture. */
export type RefusBureauQr = { ok: false; reponse: NextResponse }

/**
 * Réponse d'une erreur de la base sur une route des bureaux : structure absente (table, colonne, fonction de la
 * migration 20261119) → 503 base_absente, journalisé une fois ; sinon le code public (reponseErreurSqlQr : code seul).
 */
export function reponseErreurBureauxQr(erreur: ErreurBase | null | undefined, operation: string, ids: Record<string, string> = {}): NextResponse {
  if (structureAbsenteQr(erreur)) {
    journaliserRepliBureauxQr(operation, erreur)
    return reponseErreur('base_absente', 503)
  }
  return reponseErreurSqlQr(erreur, operation, ids)
}

async function lire<T>(requete: PromiseLike<{ data: unknown; error: ErreurBase | null }>): Promise<LectureQr<T[]>> {
  const { data, error } = await requete
  return error ? { ok: false, erreur: error } : { ok: true, valeur: (Array.isArray(data) ? data : []) as T[] }
}

/** Un bureau par son id ; null s'il n'existe pas. */
export async function lireBureauQr(id: string): Promise<LectureQr<LigneBureauQr | null>> {
  const { data, error } = await supabaseAdmin.from(TABLE_BUREAUX_QR).select(COLONNES_BUREAU_QR).eq('id', id).maybeSingle()
  return error ? { ok: false, erreur: error } : { ok: true, valeur: (data as LigneBureauQr | null) ?? null }
}

/** Lignes (id, bureau_id) d'une table rattachée, filtrées par une colonne, lot par lot et page par page. */
function lireRattachementsQr(table: TableRattacheeQr, colonne: 'id' | 'bureau_id', valeurs: readonly string[], actifsSeulement = false) {
  return lireParValeursQr<{ id: string; bureau_id: string | null }>(valeurs, (lot) => {
    let q = supabaseAdmin.from(table).select('id, bureau_id').in(colonne, lot)
    if (actifsSeulement) q = q.eq('actif', true)
    return q.order('id', { ascending: true })
  })
}

/**
 * Bureaux d'un cabinet, ou ces bureaux, avec leurs gestionnaires ACTIFS et leurs copropriétés ACTIVES rattachés (ceux
 * qui empêchent la fermeture) ; triés par nom. Erreur rendue (la route choisit : 503 base_absente, 500).
 */
export async function lireBureauxCompletsQr(filtre: { cabinet: string } | { ids: readonly string[] }): Promise<LectureQr<BureauQr[]>> {
  const q = supabaseAdmin.from(TABLE_BUREAUX_QR).select(COLONNES_BUREAU_QR)
  const bureaux = await lire<LigneBureauQr>('cabinet' in filtre ? q.eq('cabinet_id', filtre.cabinet) : q.in('id', [...filtre.ids]))
  if (!bureaux.ok) return bureaux
  if (bureaux.valeur.length === 0) return { ok: true, valeur: [] }
  const ids = bureaux.valeur.map((b) => b.id)
  const [fiches, copros] = await Promise.all([
    lireRattachementsQr(TABLE_GESTIONNAIRES_QR, 'bureau_id', ids, true),
    lireRattachementsQr(TABLE_COPROPRIETES_QR, 'bureau_id', ids, true),
  ])
  if (!fiches.ok) return fiches
  if (!copros.ok) return copros
  const compter = (lignes: ReadonlyArray<{ bureau_id: string | null }>) => {
    const n = new Map<string, number>()
    for (const l of lignes) if (l.bureau_id) n.set(l.bureau_id, (n.get(l.bureau_id) ?? 0) + 1)
    return n
  }
  const nbFiches = compter(fiches.valeur)
  const nbCopros = compter(copros.valeur)
  const liste = bureaux.valeur.map((b) => bureauDepuisLigneQr(b, { gestionnaires: nbFiches.get(b.id) ?? 0, coproprietes: nbCopros.get(b.id) ?? 0 }))
  liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  return { ok: true, valeur: liste }
}

/**
 * Contrôle d'un bureau choisi pour une fiche ou une copropriété de ce cabinet, AVANT d'écrire : inconnu ou d'un autre
 * cabinet → 409 a_reverifier (la clé étrangère composée le refuserait) ; fermé → 409 bureau_ferme (le trigger le
 * refuserait) ; structure absente → 503 base_absente ; autre erreur → 500.
 */
export async function controlerBureauDuCabinetQr(
  bureauId: string, cabinetId: string, operation: string, ids: Record<string, string> = {},
): Promise<{ ok: true; bureau: LigneBureauQr } | RefusBureauQr> {
  const lu = await lireBureauQr(bureauId)
  if (!lu.ok) return { ok: false, reponse: reponseErreurBureauxQr(lu.erreur, operation, { ...ids, bureau: bureauId }) }
  if (lu.valeur?.cabinet_id !== cabinetId) return { ok: false, reponse: reponseErreur('a_reverifier', 409) }
  if (lu.valeur.ferme_le) return { ok: false, reponse: reponseErreur('bureau_ferme', 409) }
  return { ok: true, bureau: lu.valeur }
}

/**
 * Une nouvelle fiche de ce cabinet doit-elle avoir un bureau (choix 2) ? Oui dès qu'il a un bureau ouvert. Migration
 * absente : non (aucun bureau ne peut exister ; repli journalisé une fois) ; autre erreur → la réponse (500), avant
 * toute écriture.
 */
export async function bureauRequisPourCabinetQr(cabinetId: string, operation: string): Promise<{ ok: true; requis: boolean } | RefusBureauQr> {
  const r = await lire<Pick<LigneBureauQr, 'ferme_le'>>(supabaseAdmin.from(TABLE_BUREAUX_QR).select('ferme_le').eq('cabinet_id', cabinetId))
  if (r.ok) return { ok: true, requis: bureauRequisQr(r.valeur) }
  if (structureAbsenteQr(r.erreur)) {
    journaliserRepliBureauxQr(operation, r.erreur)
    return { ok: true, requis: false }
  }
  return { ok: false, reponse: reponseErreurSqlQr(r.erreur, operation, { cabinet: cabinetId }) }
}

/** Bureau actuel d'une fiche ou d'une copropriété (null : aucun) ; erreur rendue (contrôle avant une écriture). */
export async function lireBureauIdQr(table: TableRattacheeQr, id: string): Promise<LectureQr<string | null>> {
  const { data, error } = await supabaseAdmin.from(table).select('bureau_id').eq('id', id).maybeSingle()
  if (error) return { ok: false, erreur: error }
  const valeur = (data as { bureau_id?: unknown } | null)?.bureau_id
  return { ok: true, valeur: typeof valeur === 'string' ? valeur : null }
}

/**
 * Bureaux portés par ces lignes, pour l'AFFICHAGE : id de la ligne → résumé de son bureau. null : structure absente
 * (repli journalisé une fois) ou erreur (journalisée, code seul) — l'appelant rend alors les lignes telles quelles.
 */
async function resumesDesLignesQr(table: TableRattacheeQr, ids: readonly string[], operation: string): Promise<Map<string, BureauResumeQr> | null> {
  const echec = (erreur: ErreurBase): null => {
    if (structureAbsenteQr(erreur)) journaliserRepliBureauxQr(operation, erreur)
    else logger.error(`${CONTEXTE} ${operation} : lecture impossible`, { code: erreur.code })
    return null
  }
  try {
    const lignes = await lireRattachementsQr(table, 'id', ids)
    if (!lignes.ok) return echec(lignes.erreur)
    const bureauIds = [...new Set(lignes.valeur.map((l) => l.bureau_id).filter((v): v is string => typeof v === 'string'))]
    const resultat = new Map<string, BureauResumeQr>()
    if (bureauIds.length === 0) return resultat
    const bureaux = await lireParValeursQr<LigneBureauQr>(bureauIds, (lot) =>
      supabaseAdmin.from(TABLE_BUREAUX_QR).select(COLONNES_BUREAU_QR).in('id', lot).order('id', { ascending: true }))
    if (!bureaux.ok) return echec(bureaux.erreur)
    const parId = new Map(bureaux.valeur.map((b) => [b.id, bureauResumeDepuisLigneQr(b)]))
    for (const l of lignes.valeur) {
      const bureau = l.bureau_id ? parId.get(l.bureau_id) : undefined
      if (bureau) resultat.set(l.id, bureau)
    }
    return resultat
  } catch (e: unknown) {
    logger.warn(`${CONTEXTE} ${operation} : lecture impossible (exception)`, { exception: e instanceof Error ? e.name : 'inconnue' })
    return null
  }
}

/** Pose `bureau` sur chaque ligne qui en a un ; les autres restent telles quelles (aucune clé nouvelle). */
function poserBureaux<T extends { id: string }>(lignes: readonly T[], bureaux: ReadonlyMap<string, BureauResumeQr> | null): T[] {
  if (!bureaux || bureaux.size === 0) return [...lignes]
  return lignes.map((l) => {
    const bureau = bureaux.get(l.id)
    return bureau ? { ...l, bureau } : l
  })
}

/** Fiches gestionnaires (vue du super admin) avec leur bureau. Ne lève jamais. */
export async function avecBureauxGestionnairesQr<T extends { id: string }>(fiches: readonly T[]): Promise<Array<T & { bureau?: BureauResumeQr }>> {
  if (fiches.length === 0) return []
  return poserBureaux(fiches, await resumesDesLignesQr(TABLE_GESTIONNAIRES_QR, fiches.map((f) => f.id), 'bureaux des fiches'))
}

/** Copropriétés (vue du SUPER ADMIN seulement) avec leur bureau. Ne lève jamais. */
export async function avecBureauxCoproprietesQr<T extends { id: string }>(copros: readonly T[]): Promise<Array<T & { bureau?: BureauResumeQr }>> {
  if (copros.length === 0) return []
  return poserBureaux(copros, await resumesDesLignesQr(TABLE_COPROPRIETES_QR, copros.map((c) => c.id), 'bureaux des copropriétés'))
}

/**
 * Nombres de bureaux par cabinet (tous si `cabinetIds` est null) : seuls les cabinets qui ont au moins un bureau sont
 * dans la table rendue. Migration absente ou erreur : table vide (journalisé), la liste des cabinets reste servie.
 */
export async function nombresBureauxParCabinetQr(cabinetIds: readonly string[] | null): Promise<Map<string, NombresBureauxQr>> {
  const resultat = new Map<string, NombresBureauxQr>()
  if (cabinetIds?.length === 0) return resultat
  try {
    const q = supabaseAdmin.from(TABLE_BUREAUX_QR).select('cabinet_id, ferme_le')
    const r = await lire<{ cabinet_id: string; ferme_le: string | null }>(cabinetIds ? q.in('cabinet_id', [...cabinetIds]) : q)
    if (!r.ok) {
      if (structureAbsenteQr(r.erreur)) journaliserRepliBureauxQr('bureaux des cabinets', r.erreur)
      else logger.error(`${CONTEXTE} bureaux des cabinets non lus`, { code: r.erreur.code })
      return resultat
    }
    const parCabinet = new Map<string, Array<{ ferme_le: string | null }>>()
    for (const b of r.valeur) parCabinet.set(b.cabinet_id, [...(parCabinet.get(b.cabinet_id) ?? []), b])
    for (const [cabinet, bureaux] of parCabinet) resultat.set(cabinet, nombresBureauxQr(bureaux))
  } catch (e: unknown) {
    logger.warn(`${CONTEXTE} bureaux des cabinets non lus (exception)`, { exception: e instanceof Error ? e.name : 'inconnue' })
  }
  return resultat
}

/**
 * Filtre ?bureau= de la liste des fiches (super admin) : un bureau (ses fiches), ou « aucun » (fiches sans bureau d'un
 * cabinet qui a un bureau ouvert : le « bureau à compléter » des fiches existantes). Erreur rendue (structure absente
 * comprise : la route répond 503, jamais une liste non filtrée).
 */
export async function filtrerFichesParBureauQr<T extends { id: string; cabinet_id: string }>(fiches: readonly T[], filtre: string): Promise<LectureQr<T[]>> {
  if (fiches.length === 0) {
    // Même sans fiche, la structure est vérifiée : un filtre impossible ne rend pas une liste vide trompeuse.
    const sonde = await lire(supabaseAdmin.from(TABLE_BUREAUX_QR).select('id').limit(1))
    return sonde.ok ? { ok: true, valeur: [] } : sonde
  }
  const lignes = await lireRattachementsQr(TABLE_GESTIONNAIRES_QR, 'id', fiches.map((f) => f.id))
  if (!lignes.ok) return lignes
  const bureauDe = new Map(lignes.valeur.map((l) => [l.id, l.bureau_id ?? null]))
  if (filtre !== FILTRE_SANS_BUREAU_QR) return { ok: true, valeur: fiches.filter((f) => bureauDe.get(f.id) === filtre) }
  const cabinets = [...new Set(fiches.map((f) => f.cabinet_id))]
  const ouverts = await lireParValeursQr<{ cabinet_id: string }>(cabinets, (lot) =>
    supabaseAdmin.from(TABLE_BUREAUX_QR).select('cabinet_id').in('cabinet_id', lot).is('ferme_le', null).order('cabinet_id', { ascending: true }))
  if (!ouverts.ok) return ouverts
  const avecBureauOuvert = new Set(ouverts.valeur.map((b) => b.cabinet_id))
  return { ok: true, valeur: fiches.filter((f) => !bureauDe.get(f.id) && avecBureauOuvert.has(f.cabinet_id)) }
}
