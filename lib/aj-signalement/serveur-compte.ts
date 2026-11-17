// ── AJ Signalement, côté serveur : le compte VitFix d'un gestionnaire suit sa fiche (PR 2, lot 6) ─────────────────
//
// SPEC § 2.6 et § 2.10, plan § 2.6 (décisions de Hugo du 10 et du 11/11/2026) :
//   - départ (P1-R14) : après la désactivation de la fiche (PR 1, effet immédiat : 403 acces_retire à la requête
//     suivante), le compte relié est banni (ban_duration 876000h), la date de blocage posée et journalisée
//     (gestionnaire.connexion_bloquee) ; le rôle est GARDÉ (jamais « sans rôle ») ; « Bloquer la connexion » (P2-R6)
//     relance le bannissement, idempotent ;
//   - réactivation (P1-R11 actif: true) : déblocage (ban_duration none), date effacée, journal gestionnaire.modifie
//     [connexion_bloquee_le] (aucune action nouvelle dans la liste CHECK du journal) ;
//   - effacement (P1-R11 pseudonymiser, fiche désactivée) : après la pseudonymisation (PR 1), suppression du compte
//     (deleteUser ; la clé étrangère ON DELETE SET NULL vide user_id) ;
//   - RGPD en libre-service : delete-account REFUSE pour un compte gestionnaire ou relié à une fiche (403
//     demande_au_cabinet : la demande est datée sur la fiche, journalisée et transmise au super admin sans nom ni adresse,
//     rien n'est supprimé) ; export-data ajoute sa fiche, ses attributions et son journal (12 mois), sans donnée d'une
//     autre personne.
//
// Règle de sûreté (fusion avant les migrations) : chaque lecture de user_id / connexion_bloquee_le / effacement_demande_le
// (20261112) a son repli : colonne ou table absente → l'opération de la PR 1 reste exactement la même, sans aucun appel à
// l'authentification, et le repli est journalisé une fois (journaliserRepliAccesQr). Aucune donnée personnelle au journal
// serveur : identifiants et codes seulement (jamais le message de GoTrue).

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { ROLE_GESTIONNAIRE_QR } from '@/lib/aj-signalement/acces-espace'
import { ALERTE_EFFACEMENT_DEMANDE_QR } from '@/lib/aj-signalement/email'
import {
  PAGE_POSTGREST_QR, TABLE_ATTRIBUTIONS_QR, TABLE_CABINETS_QR, TABLE_COPROPRIETES_QR, TABLE_GESTIONNAIRES_QR, TABLE_JOURNAL_QR,
  journaliserQr, journaliserRepliAccesQr, lireParValeursQr, structureAbsenteQr, type ErreurBase,
} from '@/lib/aj-signalement/serveur'
import { alerterAdministrateurQr } from '@/lib/aj-signalement/serveur-acces'

const CONTEXTE = '[AJ SIGNALEMENT]'

/** Bannissement d'un compte parti (≈ 100 ans, durée au format de GoTrue). */
export const DUREE_BANNISSEMENT_QR = '876000h'

const chaine = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

/** Rôle serveur d'un compte (app_metadata seul, jamais user_metadata). */
const roleDuCompte = (user: { app_metadata?: unknown }): string => {
  const meta = user.app_metadata
  if (typeof meta !== 'object' || meta === null) return ''
  const role = (meta as Record<string, unknown>).role
  return typeof role === 'string' ? role : ''
}

// ── Compte relié à une fiche ─────────────────────────────────────────────────

export type CompteFicheQr =
  | { etat: 'migration_absente' }
  | { etat: 'erreur' }
  | { etat: 'lu'; userId: string | null; connexionBloqueeLe: string | null }

/**
 * Compte relié à une fiche (user_id) et date de blocage, relus en base. Colonne ou table absente (20261112 non
 * appliquée) : migration_absente, journalisé une fois par opération ; autre erreur : journalisée avec son seul code.
 */
export async function lireCompteFicheQr(gestionnaireId: string, operation: string): Promise<CompteFicheQr> {
  const { data, error } = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select('user_id, connexion_bloquee_le').eq('id', gestionnaireId).maybeSingle()
  if (error) {
    if (structureAbsenteQr(error)) {
      journaliserRepliAccesQr(operation, error)
      return { etat: 'migration_absente' }
    }
    logger.error(`${CONTEXTE} compte d’une fiche non relu (${operation})`, { code: error.code, gestionnaire: gestionnaireId })
    return { etat: 'erreur' }
  }
  const ligne = (data ?? null) as { user_id?: unknown; connexion_bloquee_le?: unknown } | null
  return { etat: 'lu', userId: chaine(ligne?.user_id), connexionBloqueeLe: chaine(ligne?.connexion_bloquee_le) }
}

/** Appel à l'administration des comptes (Supabase Auth) : vrai si accepté ; refus ou exception journalisés sans message. */
async function appelAuthQr(operation: string, gestionnaireId: string, appel: () => Promise<{ error: unknown }>): Promise<boolean> {
  try {
    const { error } = await appel()
    if (!error) return true
    const statut = typeof error === 'object' && error !== null ? (error as { status?: unknown }).status : undefined
    logger.error(`${CONTEXTE} ${operation} refusé par l’authentification`, { gestionnaire: gestionnaireId, statut: typeof statut === 'number' ? statut : null })
    return false
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} ${operation} impossible`, { gestionnaire: gestionnaireId, message: e instanceof Error ? e.name : 'inconnue' })
    return false
  }
}

export interface CompteAAgirQr {
  gestionnaireId: string
  cabinetId: string
  userId: string
  /** Date de blocage déjà posée (null : aucune). */
  connexionBloqueeLe: string | null
  acteurId: string
}

/**
 * Bannit le compte relié (départ, ou relance « Bloquer la connexion ») puis pose la date de blocage et journalise
 * gestionnaire.connexion_bloquee, une seule fois (date déjà posée : rebannissement seul, idempotent). Le rôle n'est pas
 * touché. Faux si le bannissement ou la date ont échoué (la relance refait tout).
 */
export async function bloquerConnexionQr(c: CompteAAgirQr): Promise<boolean> {
  const banni = await appelAuthQr('blocage de la connexion', c.gestionnaireId,
    () => supabaseAdmin.auth.admin.updateUserById(c.userId, { ban_duration: DUREE_BANNISSEMENT_QR }))
  if (!banni) return false
  if (c.connexionBloqueeLe) return true
  const { data, error } = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).update({ connexion_bloquee_le: new Date().toISOString() })
    .eq('id', c.gestionnaireId).is('connexion_bloquee_le', null).select('id')
  if (error) {
    logger.warn(`${CONTEXTE} date de blocage non enregistrée`, { code: error.code, gestionnaire: c.gestionnaireId })
    return false
  }
  if (Array.isArray(data) && data.length > 0) {
    await journaliserQr({ action: 'gestionnaire.connexion_bloquee', cabinetId: c.cabinetId, acteurId: c.acteurId, gestionnaireId: c.gestionnaireId })
  }
  return true
}

/**
 * Débloque le compte relié (réactivation) puis efface la date de blocage, journalisé gestionnaire.modifie
 * [connexion_bloquee_le] (noms de champs seulement). Faux si le déblocage ou l'effacement de la date ont échoué : la
 * fiche reste « bloquée » (403 acces_retire) et la relance (même bouton) refait tout.
 */
export async function debloquerConnexionQr(c: CompteAAgirQr): Promise<boolean> {
  const debloque = await appelAuthQr('déblocage de la connexion', c.gestionnaireId,
    () => supabaseAdmin.auth.admin.updateUserById(c.userId, { ban_duration: 'none' }))
  if (!debloque) return false
  if (!c.connexionBloqueeLe) return true
  const { error } = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).update({ connexion_bloquee_le: null }).eq('id', c.gestionnaireId)
  if (error) {
    logger.warn(`${CONTEXTE} date de blocage non effacée`, { code: error.code, gestionnaire: c.gestionnaireId })
    return false
  }
  await journaliserQr({ action: 'gestionnaire.modifie', cabinetId: c.cabinetId, acteurId: c.acteurId, gestionnaireId: c.gestionnaireId, champs: ['connexion_bloquee_le'] })
  return true
}

/** Supprime le compte relié d'une fiche pseudonymisée (RGPD) ; faux si refusé (la relance par le même bouton le rejoue). */
export function supprimerCompteFicheQr(gestionnaireId: string, userId: string): Promise<boolean> {
  return appelAuthQr('suppression du compte', gestionnaireId, () => supabaseAdmin.auth.admin.deleteUser(userId))
}

// ── Fiche reliée au compte connecté (RGPD en libre-service) ──────────────────

const COLONNES_FICHE_DU_COMPTE_QR =
  'id, cabinet_id, nom, email, actif, created_at, adresse_confirmee_le, acces_ouvert_le, desactive_le, connexion_bloquee_le, effacement_demande_le'

interface LigneFicheDuCompteQr {
  id: string
  cabinet_id: string
  nom: string | null
  email: string | null
  actif: boolean | null
  created_at: string | null
  adresse_confirmee_le: string | null
  acces_ouvert_le: string | null
  desactive_le: string | null
  connexion_bloquee_le: string | null
  effacement_demande_le: string | null
}

type FicheDuCompteQr = { etat: 'fiche'; fiche: LigneFicheDuCompteQr } | { etat: 'aucune' } | { etat: 'erreur' }

/** Fiche reliée au compte (user_id) ; structure absente : aucune (repli journalisé une fois) ; autre erreur : erreur. */
async function ficheDuCompteQr(userId: string, operation: string): Promise<FicheDuCompteQr> {
  const { data, error } = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select(COLONNES_FICHE_DU_COMPTE_QR).eq('user_id', userId).maybeSingle()
  if (error) {
    if (structureAbsenteQr(error)) {
      journaliserRepliAccesQr(operation, error)
      return { etat: 'aucune' }
    }
    logger.warn(`${CONTEXTE} fiche du compte non relue (${operation})`, { code: error.code })
    return { etat: 'erreur' }
  }
  const fiche = (data as LigneFicheDuCompteQr | null) ?? null
  return fiche ? { etat: 'fiche', fiche } : { etat: 'aucune' }
}

/** Texte du refus de delete-account (SPEC § 2.10). */
export const MESSAGE_DEMANDE_AU_CABINET_QR = 'Votre compte AJ Signalement est géré par votre employeur : adressez votre demande au cabinet.'

/** Date la demande (première seulement), la journalise (acteur : lui-même) et prévient le super admin sans nom ni adresse. */
async function enregistrerDemandeEffacementQr(fiche: LigneFicheDuCompteQr, userId: string): Promise<void> {
  if (fiche.effacement_demande_le) return
  const { data, error } = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).update({ effacement_demande_le: new Date().toISOString() })
    .eq('id', fiche.id).is('effacement_demande_le', null).select('id')
  if (error) {
    logger.warn(`${CONTEXTE} demande d’effacement non datée`, { code: error.code, gestionnaire: fiche.id })
    return
  }
  if (!Array.isArray(data) || data.length === 0) return
  await journaliserQr({
    action: 'gestionnaire.effacement_demande', cabinetId: fiche.cabinet_id, acteurId: userId, profil: 'gestionnaire',
    acteurGestionnaireId: fiche.id, gestionnaireId: fiche.id,
  })
  await alerterAdministrateurQr(ALERTE_EFFACEMENT_DEMANDE_QR, fiche.id, 'demande d’effacement')
}

/**
 * DELETE /api/user/delete-account (libre-service) : refus pour un compte gestionnaire_signalement OU relié à une fiche,
 * AVANT toute suppression (403 demande_au_cabinet, SPEC § 2.10, RG-26). null : tout autre compte, dont la suppression
 * suit son cours (structure absente : comme aujourd'hui). Lecture en panne d'un compte non gestionnaire : 500 (on ne
 * sait pas s'il est relié ; rien n'est supprimé). Ne lève jamais.
 */
export async function refusEffacementGestionnaireQr(user: { id: string; app_metadata?: unknown }): Promise<NextResponse | null> {
  const refus = () => NextResponse.json({ error: 'demande_au_cabinet', message: MESSAGE_DEMANDE_AU_CABINET_QR }, { status: 403 })
  const gestionnaire = roleDuCompte(user) === ROLE_GESTIONNAIRE_QR
  try {
    const lue = await ficheDuCompteQr(user.id, 'fiche du compte (effacement)')
    if (lue.etat === 'erreur') return gestionnaire ? refus() : NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    if (lue.etat === 'aucune') return gestionnaire ? refus() : null
    await enregistrerDemandeEffacementQr(lue.fiche, user.id)
    return refus()
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} demande d’effacement d’un compte`, { message: e instanceof Error ? e.name : 'inconnue' })
    return gestionnaire ? refus() : NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ── Export RGPD en libre-service (GET /api/user/export-data) ─────────────────

/** Journal exporté : 12 mois (durée de conservation du journal), lu par pages de PostgREST. */
const MOIS_JOURNAL_EXPORT_QR = 12
const PAGES_JOURNAL_EXPORT_MAX_QR = 20

interface LigneJournalExportQr {
  acteur_id: string | null
  acteur_profil: string | null
  acteur_gestionnaire_id: string | null
  action: string
  copropriete_id: string | null
  champs: string[] | null
  /** Lu pour la seule règle de coproprieteNommeeQr ; jamais exporté. */
  details: Record<string, unknown> | null
  created_at: string
}

/**
 * La copropriété d'une ligne peut-elle être nommée dans l'export ? Non pour un doublon refusé hors de sa portée (SPEC
 * § 2.5 : « hors portée : aucun nom ni identifiant ») : doublon.refuse porte la copropriété EXISTANTE, que la réponse 409
 * lui a tue ; seule details.dansPortee === true (déjà nommée par cette réponse) la laisse nommer. Relecture 1 du lot 6.
 */
const coproprieteNommeeQr = (l: LigneJournalExportQr): l is LigneJournalExportQr & { copropriete_id: string } =>
  typeof l.copropriete_id === 'string' && (l.action !== 'doublon.refuse' || l.details?.dansPortee === true)

/** Auteur d'une ligne vu par le gestionnaire : lui, un collègue, le cabinet (super admin) ou le système ; jamais un nom. */
function auteurLigneQr(l: LigneJournalExportQr, ficheId: string, userId: string): 'vous' | 'collegue' | 'cabinet' | 'systeme' {
  if (l.acteur_gestionnaire_id === ficheId || l.acteur_id === userId) return 'vous'
  if (l.acteur_profil === 'gestionnaire') return 'collegue'
  return l.acteur_profil === 'systeme' ? 'systeme' : 'cabinet'
}

async function lireJournalExportQr(ficheId: string, userId: string): Promise<{ ok: true; lignes: LigneJournalExportQr[] } | { ok: false; erreur: ErreurBase }> {
  const depuis = new Date()
  depuis.setMonth(depuis.getMonth() - MOIS_JOURNAL_EXPORT_QR)
  const lignes: LigneJournalExportQr[] = []
  for (let page = 0; page < PAGES_JOURNAL_EXPORT_MAX_QR; page += 1) {
    const { data, error } = await supabaseAdmin.from(TABLE_JOURNAL_QR)
      .select('acteur_id, acteur_profil, acteur_gestionnaire_id, action, copropriete_id, champs, details, created_at')
      .or(`acteur_id.eq.${userId},acteur_gestionnaire_id.eq.${ficheId},gestionnaire_id.eq.${ficheId}`)
      .gte('created_at', depuis.toISOString())
      .order('created_at', { ascending: true }).order('id', { ascending: true })
      .range(page * PAGE_POSTGREST_QR, (page + 1) * PAGE_POSTGREST_QR - 1)
    if (error) return { ok: false, erreur: error }
    const lot = (data ?? []) as LigneJournalExportQr[]
    lignes.push(...lot)
    if (lot.length < PAGE_POSTGREST_QR) break
  }
  return { ok: true, lignes }
}

/**
 * Section aj_signalement de l'export d'un compte relié à une fiche (rôle gestionnaire, ou compte relié) : sa fiche,
 * ses attributions et les lignes du journal (12 mois) où il est l'auteur ou le sujet ; aucun identifiant, aucun nom ni
 * aucune adresse d'une autre personne, ni le nom d'une copropriété qu'un doublon refusé lui a tue (coproprieteNommeeQr).
 * L'export est journalisé (gestionnaire.exporte, acteur : lui-même). null : aucune
 * fiche, structure absente (repli journalisé une fois) ou lecture impossible (journal serveur) — la section est omise.
 * Ne lève jamais.
 */
export async function exportGestionnaireDuCompteQr(user: { id: string }): Promise<Record<string, unknown> | null> {
  try {
    const lue = await ficheDuCompteQr(user.id, 'fiche du compte (export)')
    if (lue.etat !== 'fiche') return null
    const f = lue.fiche
    const [cabinet, attributions, journal] = await Promise.all([
      supabaseAdmin.from(TABLE_CABINETS_QR).select('nom').eq('id', f.cabinet_id).maybeSingle(),
      supabaseAdmin.from(TABLE_ATTRIBUTIONS_QR).select('copropriete_id, origine, created_at').eq('gestionnaire_id', f.id),
      lireJournalExportQr(f.id, user.id),
    ])
    const erreur = cabinet.error ?? attributions.error ?? (journal.ok ? null : journal.erreur)
    if (erreur) {
      if (structureAbsenteQr(erreur)) journaliserRepliAccesQr('export du compte gestionnaire', erreur)
      else logger.warn(`${CONTEXTE} export du compte gestionnaire incomplet`, { code: erreur.code, gestionnaire: f.id })
      return null
    }
    const lignesAttributions = (attributions.data ?? []) as Array<{ copropriete_id: string; origine: string | null; created_at: string | null }>
    const lignesJournal = journal.ok ? journal.lignes : []
    const coproIds = [...new Set([
      ...lignesAttributions.map((a) => a.copropriete_id),
      ...lignesJournal.filter(coproprieteNommeeQr).map((l) => l.copropriete_id),
    ].filter((v): v is string => typeof v === 'string'))]
    const noms = new Map<string, string | null>()
    // Jusqu'à ATTRIBUTIONS_MAX_PAR_GESTIONNAIRE_QR attributions, plus les copropriétés du journal : noms lus par lots
    // filtrés et ordonnés (lireParValeursQr : URL bornée, pages de 1 000 ; un seul .in() serait tronqué par max-rows).
    const copros = await lireParValeursQr<{ id: string; nom: string | null }>(coproIds, (lot) =>
      supabaseAdmin.from(TABLE_COPROPRIETES_QR).select('id, nom').in('id', lot).order('id', { ascending: true }))
    if (copros.ok) for (const c of copros.valeur) noms.set(c.id, c.nom ?? null)
    else logger.warn(`${CONTEXTE} noms des copropriétés de l’export non lus`, { code: copros.erreur.code, gestionnaire: f.id })
    await journaliserQr({
      action: 'gestionnaire.exporte', cabinetId: f.cabinet_id, acteurId: user.id, profil: 'gestionnaire', acteurGestionnaireId: f.id, gestionnaireId: f.id,
    })
    return {
      fiche: {
        nom: f.nom, email: f.email, cabinet: (cabinet.data as { nom?: string | null } | null)?.nom ?? null, actif: f.actif === true,
        creeLe: f.created_at, adresseConfirmeeLe: f.adresse_confirmee_le, accesOuvertLe: f.acces_ouvert_le, desactiveLe: f.desactive_le,
        connexionBloqueeLe: f.connexion_bloquee_le, effacementDemandeLe: f.effacement_demande_le,
      },
      attributions: lignesAttributions.map((a) => ({ copropriete: noms.get(a.copropriete_id) ?? null, origine: a.origine, depuis: a.created_at })),
      journal: lignesJournal.map((l) => ({
        date: l.created_at, action: l.action, auteur: auteurLigneQr(l, f.id, user.id),
        copropriete: coproprieteNommeeQr(l) ? noms.get(l.copropriete_id) ?? null : null, champs: Array.isArray(l.champs) ? l.champs : [],
      })),
    }
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} export du compte gestionnaire`, { message: e instanceof Error ? e.name : 'inconnue' })
    return null
  }
}
