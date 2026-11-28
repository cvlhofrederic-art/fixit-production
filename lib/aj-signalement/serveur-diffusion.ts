// ── AJ Signalement — diffusion, côté serveur : lectures et appels communs aux routes (PR 3, lot 5) ───────────────────
//
// Importé par les routes app/api/aj-signalement/…/diffusions…, app/api/aj-signalement/cabinets/[id] et
// app/api/cron/aj-diffusion-reprise ; jamais par un composant client. Clé service (supabaseAdmin) : la RLS des tables de
// la diffusion n'a aucune politique, tout contrôle d'accès est dans les routes.
// Migration 20261113 absente : chaque lecture nomme au moins une colonne ou une fonction qu'elle crée — l'erreur de
// structure est rendue à la route, qui répond 503 base_absente (reponseErreurDiffusionQr, journalisé une fois).
//
// Profils (cahier § 4.3) : le super admin, sur instruction écrite du cabinet (HF4) ; le gestionnaire (décision H11 de
// Hugo du 11/11/2026), sur les seules copropriétés de SON cabinet qui lui sont attribuées NOMMÉMENT, jamais sur une
// copropriété « attribuée à tous » (la copropriété de test ne diffuse que par le super admin), sans instruction écrite
// (c'est le cabinet qui diffuse). Chaque route D-R1 à D-R7 applique controlerDroitDiffuserQr AVANT toute autre lecture
// (hors portée → 404, « à tous » → 403 lecture_seule ; reprise et détail : par la copropriété de LA diffusion,
// controlerDroitSurDiffusionQr) ; parametresAuteurDiffusionQr passe le profil, le compte et la fiche de la SESSION à la
// base, qui revérifie H11 (signalements_qr_diffusion_gestionnaire_autorise : 42501 → 403). Les réglages et l'activation
// du cabinet (D-R8) et le filet de reprise (D-C1) restent fermés au gestionnaire.

import type { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import type { CoupleValeursQr } from '@/lib/aj-signalement/diffusion-valeurs'
import { diffusionFigeeDepuisLigneQr, envoyerCopieCabinetDiffusionQr, type DiffusionFigeeQr } from '@/lib/aj-signalement/email'
import {
  nombresDiffusionDepuisLigneQr, type NombresDiffusionQr, type VueGestionnaireDiffusionQr,
} from '@/lib/aj-signalement/diffusion-formes'
import { envoyerDiffusionQr, type ArretEnvoiDiffusionQr } from '@/lib/aj-signalement/diffusion-envoi'
import { droitDiffuserQr } from '@/lib/aj-signalement/droits-diffusion'
import type { LangueCabinetQr, ProfilQr, TypeProfilQr } from '@/lib/aj-signalement/types'
import {
  TABLE_CABINETS_QR, TABLE_COPROPRIETES_QR, TABLE_SIGNALEMENTS_QR, journaliserRepliDiffusionQr, langueCabinetQr, porteeDuProfilQr,
  reponseErreur, reponseLectureGestionnaireQr, structureAbsenteQr, type ErreurBase, type LectureQr,
} from '@/lib/aj-signalement/serveur'

const CONTEXTE = '[AJ SIGNALEMENT]'

export const TABLE_DIFFUSIONS_QR = 'signalements_qr_diffusions'

/** Profils admis par les routes de diffusion D-R1 à D-R7 (le gestionnaire : copropriétés attribuées nommément, H11). */
export const PROFILS_DIFFUSION_QR: readonly TypeProfilQr[] = ['super_admin', 'gestionnaire']

/** Contrôle d'un droit : la route continue, ou répond tout de suite. */
export type ControleDroitDiffusionQr = { ok: true } | { ok: false; reponse: NextResponse }

const AUTORISE: ControleDroitDiffusionQr = { ok: true }
const refus = (code: string, status: number): ControleDroitDiffusionQr => ({ ok: false, reponse: reponseErreur(code, status) })

interface LigneDroitsCoproQr { id: string; cabinet_id: string | null; attribuee_a_tous: boolean | null }

/**
 * Droit « diffuser » du profil sur une copropriété (H11), contrôlé AVANT toute autre lecture de la copropriété, de ses
 * signalements ou de ses diffusions, et avant tout appel SQL : super admin, toujours ; gestionnaire (fiche active,
 * reliée au compte, non bloquée : déjà relue par controlerAccesQr) — la copropriété est lue par ses seules colonnes de
 * droits ET filtrée par le cabinet DE LA FICHE (une copropriété d'un autre cabinet, sans cabinet ou inconnue n'est
 * jamais lue), puis la portée est relue (attributions de sa fiche) et droitDiffuserQr décide : hors portée → 404
 * introuvable (comme une copropriété inconnue), « attribuée à tous » → 403 lecture_seule. Lecture refusée : structure
 * absente → 503 base_absente (journalisé une fois), sinon la traduction commune (500 journalisé avec son seul code).
 */
export async function controlerDroitDiffuserQr(profil: ProfilQr, coproprieteId: string): Promise<ControleDroitDiffusionQr> {
  if (profil.type === 'super_admin') return AUTORISE
  const ids = { gestionnaire: profil.gestionnaireId, copropriete: coproprieteId }
  const lue = await supabaseAdmin.from(TABLE_COPROPRIETES_QR).select('id, cabinet_id, attribuee_a_tous')
    .eq('id', coproprieteId).eq('cabinet_id', profil.cabinetId).maybeSingle()
  if (lue.error) return { ok: false, reponse: reponseLectureGestionnaireQr(lue.error, 'droit de diffuser : copropriété', ids) }
  const ligne = (lue.data as LigneDroitsCoproQr | null) ?? null
  if (!ligne) return refus('introuvable', 404)
  const portee = await porteeDuProfilQr(profil, [ligne])
  if (!portee.ok) return { ok: false, reponse: reponseLectureGestionnaireQr(portee.erreur, 'droit de diffuser : portée', ids) }
  const copro = { id: ligne.id, cabinetId: ligne.cabinet_id ?? null, attribueeATous: ligne.attribuee_a_tous === true }
  const droit = droitDiffuserQr('gestionnaire', copro, portee.valeur)
  if (droit === 'hors_portee') return refus('introuvable', 404)
  if (droit === 'lecture_seule') return refus('lecture_seule', 403)
  return AUTORISE
}

/**
 * Même droit pour une diffusion déjà lue (reprise D-R4, détail D-R6) : par la copropriété DE LA DIFFUSION. Gestionnaire :
 * diffusion d'un autre cabinet que celui de sa fiche → 404 sans autre lecture ; sinon controlerDroitDiffuserQr.
 */
export async function controlerDroitSurDiffusionQr(profil: ProfilQr, ligne: Record<string, unknown>): Promise<ControleDroitDiffusionQr> {
  if (profil.type === 'super_admin') return AUTORISE
  const coproprieteId = chaine(ligne.copropriete_id)
  if (!coproprieteId || chaine(ligne.cabinet_id) !== profil.cabinetId) return refus('introuvable', 404)
  return controlerDroitDiffuserQr(profil, coproprieteId)
}

/** Lecteur gestionnaire de l'historique et du détail (auteur minimisé, aucune instruction écrite) ; super admin : aucun. */
export const vueDiffusionDuProfilQr = (profil: ProfilQr): VueGestionnaireDiffusionQr | undefined =>
  (profil.type === 'gestionnaire' ? { gestionnaireId: profil.gestionnaireId } : undefined)

/** Copropriété lue pour une diffusion (fin de mission : colonne de la 20261113). */
export interface CoproprieteDiffusionQr {
  id: string
  nom: string
  actif: boolean
  cabinetId: string | null
  batiments: string[]
  /** Fin de mission prévue (H7), valeur brute de la colonne DATE ; null : aucune (relue par D-R1, relecture 3). */
  finGestionLe: string | null
}

/** Cabinet lu pour une diffusion (colonnes de réglage de la 20261113). */
export interface CabinetDiffusionQr {
  id: string
  nom: string
  identifiant: string
  langue: LangueCabinetQr
  telephones: string[]
  /** Ligne brute (réglages rendus par reglagesDiffusionDepuisLigneQr). */
  ligne: Record<string, unknown>
}

const COLONNES_COPRO_DIFFUSION_QR = 'id, nom, actif, cabinet_id, batiments, diffusion_fin_gestion_le'
export const COLONNES_CABINET_DIFFUSION_QR =
  'id, nom, identifiant, langue, diffusion_contact_email, diffusion_politique_url, diffusion_politique_verifiee_le, '
  + 'diffusion_contrat_reference, diffusion_contrat_signe_le, diffusion_telephones, diffusion_activee_le'
/** Colonnes d'une diffusion lues par les routes (valeurs figées comprises : elles ne sortent jamais telles quelles). */
const COLONNES_DIFFUSION_QR =
  'id, copropriete_id, cabinet_id, operation_id, acteur_profil, acteur_id, acteur_gestionnaire_id, instruction_reference, '
  + 'instruction_recue_le, modele, langue, fige_cabinet_nom, fige_cabinet_identifiant, fige_copropriete_nom, fige_contact_email, '
  + 'fige_politique_url, fige_expediteur, objet, texte, portee, libelle_perimetre, nb_destinataires, nb_exclus_opposition, '
  + 'copie_cabinet_le, created_at'

const chaine = (v: unknown): string => (typeof v === 'string' ? v : '')
const textes = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Une copropriété et son cabinet ; null si la copropriété n'existe pas (cabinet null : sans cabinet). */
export async function lireContexteDiffusionQr(
  coproprieteId: string,
): Promise<LectureQr<{ copropriete: CoproprieteDiffusionQr; cabinet: CabinetDiffusionQr | null } | null>> {
  const c = await supabaseAdmin.from(TABLE_COPROPRIETES_QR).select(COLONNES_COPRO_DIFFUSION_QR).eq('id', coproprieteId).maybeSingle()
  if (c.error) return { ok: false, erreur: c.error }
  const l = c.data as Record<string, unknown> | null
  if (!l) return { ok: true, valeur: null }
  const copropriete: CoproprieteDiffusionQr = {
    id: chaine(l.id), nom: chaine(l.nom), actif: l.actif === true, cabinetId: chaine(l.cabinet_id) || null, batiments: textes(l.batiments),
    finGestionLe: chaine(l.diffusion_fin_gestion_le) || null,
  }
  if (!copropriete.cabinetId) return { ok: true, valeur: { copropriete, cabinet: null } }
  const k = await lireCabinetDiffusionQr(copropriete.cabinetId)
  if (!k.ok) return k
  return { ok: true, valeur: { copropriete, cabinet: k.valeur } }
}

/** Un cabinet avec ses réglages de diffusion ; null s'il n'existe pas. */
export async function lireCabinetDiffusionQr(id: string): Promise<LectureQr<CabinetDiffusionQr | null>> {
  const { data, error } = await supabaseAdmin.from(TABLE_CABINETS_QR).select(COLONNES_CABINET_DIFFUSION_QR).eq('id', id).maybeSingle()
  if (error) return { ok: false, erreur: error }
  const l = data as Record<string, unknown> | null
  if (!l) return { ok: true, valeur: null }
  return {
    ok: true,
    valeur: { id: chaine(l.id), nom: chaine(l.nom), identifiant: chaine(l.identifiant), langue: langueCabinetQr(l.langue), telephones: textes(l.diffusion_telephones), ligne: l },
  }
}

/** Une diffusion (ligne brute) ; null si elle n'existe pas (ou a été purgée). */
export async function lireDiffusionQr(id: string): Promise<LectureQr<Record<string, unknown> | null>> {
  const { data, error } = await supabaseAdmin.from(TABLE_DIFFUSIONS_QR).select(COLONNES_DIFFUSION_QR).eq('id', id).maybeSingle()
  if (error) return { ok: false, erreur: error }
  return { ok: true, valeur: (data as Record<string, unknown> | null) ?? null }
}

/**
 * La diffusion déjà créée par CETTE opération (même identifiant d'opération, même copropriété, même auteur : les
 * conditions du rejeu de signalements_qr_diffusion_creer) existe-t-elle ? D-R3 la lit avant de refuser un libellé changé,
 * pour qu'un double clic ou un nouvel essai rende toujours la diffusion déjà partie, jamais un 409.
 */
export async function diffusionDeLOperationQr(operationId: string, coproprieteId: string, acteurId: string): Promise<LectureQr<boolean>> {
  const { data, error } = await supabaseAdmin.from(TABLE_DIFFUSIONS_QR).select('id')
    .eq('operation_id', operationId).eq('copropriete_id', coproprieteId).eq('acteur_id', acteurId).maybeSingle()
  if (error) return { ok: false, erreur: error }
  return { ok: true, valeur: data !== null }
}

/** Valeurs figées d'une diffusion lue (null : ligne hors forme, journalisée sans valeur). */
export function diffusionFigeeQr(ligne: Record<string, unknown>): DiffusionFigeeQr | null {
  const figee = diffusionFigeeDepuisLigneQr(ligne)
  if (!figee) logger.error(`${CONTEXTE} diffusion : valeurs figées illisibles`, { diffusionId: chaine(ligne.id) })
  return figee
}

/** Résultat d'un appel de fonction SQL. */
async function rpcQr<T>(nom: string, args: Record<string, unknown>, lire: (data: unknown) => T): Promise<LectureQr<T>> {
  const { data, error } = await supabaseAdmin.rpc(nom, args)
  if (error) return { ok: false, erreur: error as ErreurBase }
  return { ok: true, valeur: lire(data) }
}

const premiereLigne = (data: unknown): Record<string, unknown> | null =>
  (Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) ?? null : (data as Record<string, unknown> | null))

export const nombresDiffusionQr = (id: string): Promise<LectureQr<NombresDiffusionQr>> =>
  rpcQr('signalements_qr_diffusion_nombres', { p_diffusion: id }, (d) => nombresDiffusionDepuisLigneQr(premiereLigne(d)))

/** Raison pour laquelle la copropriété ne peut pas diffuser ; null : elle le peut (règle SQL unique). */
export const raisonInactiveDiffusionQr = (coproprieteId: string): Promise<LectureQr<string | null>> =>
  rpcQr('signalements_qr_diffusion_raison_inactive', { p_copropriete: coproprieteId }, (d) => (typeof d === 'string' ? d : null))

/** Couples (bâtiment, étage) bruts présents dans les signalements de la copropriété, avec le nombre d'adresses. */
export const couplesDiffusionQr = (coproprieteId: string): Promise<LectureQr<CoupleValeursQr[]>> =>
  rpcQr('signalements_qr_diffusion_valeurs', { p_copropriete: coproprieteId }, (d) => (Array.isArray(d) ? d as CoupleValeursQr[] : []))

/** Diffusions du mois civil (heure de Paris) dont au moins une personne a reçu le message (l'annonce ne compte pas). */
export const moisDiffusionQr = (coproprieteId: string): Promise<LectureQr<{ nb: number; dernierLe: string | null }>> =>
  rpcQr('signalements_qr_diffusions_mois', { p_copropriete: coproprieteId }, (d) => {
    const l = premiereLigne(d) ?? {}
    return { nb: typeof l.nb === 'number' ? l.nb : 0, dernierLe: chaine(l.dernier_le) || null }
  })

/** Le signalement appartient-il à CETTE copropriété (portée signalement, opposition à la demande écrite) ? */
export async function signalementDeLaCoproprieteQr(signalementId: string, coproprieteId: string): Promise<LectureQr<boolean>> {
  const { data, error } = await supabaseAdmin.from(TABLE_SIGNALEMENTS_QR).select('id')
    .eq('id', signalementId).eq('copropriete_id', coproprieteId).maybeSingle()
  if (error) return { ok: false, erreur: error }
  return { ok: true, valeur: data !== null }
}

/** Auteur passé aux fonctions SQL : le super admin (sans fiche), ou le gestionnaire et sa fiche (partie H11). */
export function parametresAuteurDiffusionQr(profil: ProfilQr): { p_acteur: string; p_profil: 'super_admin' | 'gestionnaire'; p_gestionnaire: string | null } {
  return profil.type === 'gestionnaire'
    ? { p_acteur: profil.userId, p_profil: 'gestionnaire', p_gestionnaire: profil.gestionnaireId }
    : { p_acteur: profil.userId, p_profil: 'super_admin', p_gestionnaire: null }
}

/**
 * Copie au cabinet (cahier § 5.6, J29, HF4 : « une copie de chaque diffusion »), DUE tant que copie_cabinet_le est NULL
 * (relecture 2 de la PR 3 : un D-R3 arrêté entre la création et la copie laissait la reprise et le filet envoyer aux
 * déclarants sans elle). Appelée par D-R3, la reprise D-R4 et le filet D-C1 juste avant les lots, quand la diffusion
 * peut encore partir. Déjà datée → rien ; sinon envoi (clé d'idempotence propre : deux envois concurrents n'en font
 * qu'un chez Resend), puis date au succès, seulement si personne ne l'a datée entre-temps. Échec : journalisé, l'envoi
 * aux déclarants continue (rend faux). Ne lève jamais.
 */
export async function envoyerCopieCabinetSiDueQr(ligne: Record<string, unknown>): Promise<boolean> {
  if (chaine(ligne.copie_cabinet_le) !== '') return false
  const figee = diffusionFigeeQr(ligne)
  if (!figee || !(await envoyerCopieCabinetDiffusionQr(figee))) return false
  const copie = await supabaseAdmin.from(TABLE_DIFFUSIONS_QR).update({ copie_cabinet_le: new Date().toISOString() })
    .eq('id', figee.id).is('copie_cabinet_le', null)
  if (copie.error) logger.warn(`${CONTEXTE} date de la copie au cabinet non écrite`, { diffusion: figee.id, code: copie.error.code })
  return true
}

/** Réponse des routes qui envoient (D-R3, D-R4) : totaux de la diffusion, et l'arrêt de cet appel s'il y en a eu un. */
export interface EnvoiRenduDiffusionQr {
  envoyes: number
  refuses: number
  /** En attente ou en cours : l'écran enchaîne la reprise tant que reste > 0. */
  reste: number
  arret: ArretEnvoiDiffusionQr | null
}

/**
 * Lots suivants d'une diffusion lue (envoyerDiffusionQr), puis ses nombres relus en base (totaux de la diffusion, pas
 * seulement de cet appel). Valeurs figées illisibles → null (journalisé ; rien n'est parti). Nombres illisibles : le
 * bilan de l'appel, journalisé.
 */
export async function envoyerEtCompterDiffusionQr(ligne: Record<string, unknown>, lotsMax?: number): Promise<EnvoiRenduDiffusionQr | null> {
  const figee = diffusionFigeeQr(ligne)
  if (!figee) return null
  const bilan = await envoyerDiffusionQr(figee, { lotsMax })
  const nombres = await nombresDiffusionQr(figee.id)
  if (!nombres.ok) {
    logger.warn(`${CONTEXTE} diffusion : nombres non relus après l’envoi`, { diffusionId: figee.id, code: nombres.erreur.code })
    return { envoyes: bilan.envoyes, refuses: bilan.refuses, reste: bilan.reste ?? 0, arret: bilan.arret }
  }
  return { envoyes: nombres.valeur.envoyes, refuses: nombres.valeur.refuses, reste: nombres.valeur.attente, arret: bilan.arret }
}

const UN_JOUR_MS = 24 * 60 * 60 * 1000

/**
 * Conservation (H10, cahier § 2.5) : purge des diffusions, oppositions et lignes périmées, au plus une fois par jour
 * (clé qr_purge_diffusion), lancée par le filet de reprise et par l'ouverture de l'historique ; son échec ne bloque
 * rien (journalisé avec son seul code).
 */
export async function purgerDiffusionsSiBesoinQr(): Promise<void> {
  if (!(await checkRateLimit('qr_purge_diffusion', 1, UN_JOUR_MS))) return
  const { error } = await supabaseAdmin.rpc('signalements_qr_diffusion_purger')
  if (!error) return
  if (structureAbsenteQr(error)) journaliserRepliDiffusionQr('purge des diffusions', error)
  else logger.warn(`${CONTEXTE} purge des diffusions non faite`, { code: error.code })
}

/** Jour civil de Paris (AAAA-MM-JJ) : une date reçue (instruction, demande écrite, contrat) ne peut pas le dépasser. */
export function aujourdhuiParisQr(maintenant: Date = new Date()): string {
  const parties = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(maintenant)
  const partie = (type: Intl.DateTimeFormatPartTypes) => parties.find((p) => p.type === type)?.value ?? ''
  return `${partie('year')}-${partie('month')}-${partie('day')}`
}
