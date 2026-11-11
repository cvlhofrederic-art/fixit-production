// ── AJ Signalement, côté serveur : cabinets clients, fiches gestionnaires, journal ─────────────────────────────
//
// Demandes de Hugo du 10/11/2026 : chaque cabinet client (nom, chemin vitfix.io/<identifiant>/…, langue, domaines
// e-mail) et ses gestionnaires sont tenus par le super admin dans l'espace ; chaque gestionnaire reçoit les signalements
// de ses copropriétés une fois son adresse confirmée. Ce module assemble les formes publiques de ces lignes pour les
// routes app/api/aj-signalement/{cabinets,gestionnaires,journal}/* (clé service, RLS sans politique : le contrôle
// d'accès est fait par la route, controlerAccesQr). Jamais de jeton d'envoi (invite_token) dans ce qui sort d'ici.

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { lireInvitationValide, type LigneInvitation } from '@/lib/equipe/invitation-serveur'
import { lireJetonDuLien } from '@/lib/equipe/lien-invitation'
import { porteeGestionnaireQr } from '@/lib/aj-signalement/acces-espace'
import { urlConfirmationAdresseQr } from '@/lib/aj-signalement/chemin-cabinet'
import { envoyerConfirmationAdresseQr } from '@/lib/aj-signalement/email'
import { etatGestionnaireQr, nomCourtQr } from '@/lib/aj-signalement/gestionnaires'
import {
  ACTIONS_JOURNAL_QR, OBJETS_ENVOI_QR, ORIGINES_ATTRIBUTION_QR, PROFILS_ACTEUR_QR, REFUS_ENVOI_QR,
  type ActionJournalQr, type CabinetQr, type CabinetResumeQr, type EnvoiGestionnaireQr, type EvenementJournalQr, type GestionnaireQr,
  type ObjetEnvoiQr, type OrigineAttributionQr, type ProfilActeurQr, type RefusEnvoiQr,
} from '@/lib/aj-signalement/types'
import {
  TABLE_ATTRIBUTIONS_QR, TABLE_CABINETS_QR, TABLE_COPROPRIETES_QR, TABLE_DOMAINES_QR, TABLE_GESTIONNAIRES_QR, TABLE_INVITATIONS_QR,
  cabinetResumeDepuisLigneQr, compteursQr, journaliserQr, journaliserRepliAccesQr, langueCabinetQr, lireCabinetQr, lireParValeursQr,
  structureAbsenteQr, type ErreurBase,
} from '@/lib/aj-signalement/serveur'

const CONTEXTE = '[AJ SIGNALEMENT]'

type Lecture<T> = { ok: true; valeur: T } | { ok: false; erreur: ErreurBase }

const chaine = (v: unknown): string => (typeof v === 'string' ? v : '')

async function lire<T>(requete: PromiseLike<{ data: unknown; error: ErreurBase | null }>): Promise<Lecture<T[]>> {
  const { data, error } = await requete
  return error ? { ok: false, erreur: error } : { ok: true, valeur: (data ?? []) as T[] }
}

// ── Cabinets ─────────────────────────────────────────────────────────────────

interface LigneCabinetCompleteQr { id: string; nom: string | null; identifiant: string | null; langue: string | null }

/**
 * Cabinets avec domaines et compteurs ; identifiant figé dès une copropriété ou un gestionnaire (même règle que le
 * trigger de la migration). `ids` : ces cabinets seulement. Triés par nom.
 */
export async function lireCabinetsCompletsQr(ids?: readonly string[]): Promise<Lecture<CabinetQr[]>> {
  const liste = ids ? [...ids] : null
  const qCabinets = supabaseAdmin.from(TABLE_CABINETS_QR).select('id, nom, identifiant, langue')
  const cabinets = await lire<LigneCabinetCompleteQr>(liste ? qCabinets.in('id', liste) : qCabinets)
  if (!cabinets.ok) return cabinets
  if (cabinets.valeur.length === 0) return { ok: true, valeur: [] }
  const qDomaines = supabaseAdmin.from(TABLE_DOMAINES_QR).select('cabinet_id, domaine')
  const qCopros = supabaseAdmin.from(TABLE_COPROPRIETES_QR).select('cabinet_id').not('cabinet_id', 'is', null)
  const qFiches = supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select('cabinet_id')
  const [domaines, copros, fiches] = await Promise.all([
    lire<{ cabinet_id: string; domaine: string }>(liste ? qDomaines.in('cabinet_id', liste) : qDomaines),
    lire<{ cabinet_id: string | null }>(liste ? qCopros.in('cabinet_id', liste) : qCopros),
    lire<{ cabinet_id: string }>(liste ? qFiches.in('cabinet_id', liste) : qFiches),
  ])
  for (const r of [domaines, copros, fiches]) if (!r.ok) return r
  const compter = (lignes: ReadonlyArray<{ cabinet_id: string | null }>) => {
    const n = new Map<string, number>()
    for (const l of lignes) if (l.cabinet_id) n.set(l.cabinet_id, (n.get(l.cabinet_id) ?? 0) + 1)
    return n
  }
  const nbCopros = compter(copros.ok ? copros.valeur : [])
  const nbFiches = compter(fiches.ok ? fiches.valeur : [])
  const domainesPar = new Map<string, string[]>()
  for (const d of domaines.ok ? domaines.valeur : []) domainesPar.set(d.cabinet_id, [...(domainesPar.get(d.cabinet_id) ?? []), d.domaine])
  const resultat = cabinets.valeur.map((c): CabinetQr => {
    const nbCoproprietes = nbCopros.get(c.id) ?? 0
    const nbGestionnaires = nbFiches.get(c.id) ?? 0
    return {
      id: c.id, nom: chaine(c.nom), identifiant: chaine(c.identifiant), langue: langueCabinetQr(c.langue),
      domaines: [...(domainesPar.get(c.id) ?? [])].sort((a, b) => a.localeCompare(b)),
      identifiantFige: nbCoproprietes > 0 || nbGestionnaires > 0, nbCoproprietes, nbGestionnaires,
    }
  })
  return { ok: true, valeur: resultat.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')) }
}

// ── Fiches gestionnaires ─────────────────────────────────────────────────────

/** Colonnes d'une fiche (jamais un jeton : il est dans signalements_qr_invitations, jamais lu ici). */
export const COLONNES_FICHE_QR =
  'id, cabinet_id, nom, email, actif, domaine_force, adresse_confirmee_le, adresse_contestee_le, pseudonymise_le, desactive_le, created_at'
/** Colonnes d'un envoi, SANS invite_token. */
export const COLONNES_ENVOI_QR = 'id, gestionnaire_id, objet, created_at, invite_sent_at, accepted_at, refus'

export interface LigneFicheQr {
  id: string
  cabinet_id: string
  nom: string | null
  email: string | null
  actif: boolean | null
  domaine_force: boolean | null
  adresse_confirmee_le: string | null
  adresse_contestee_le: string | null
  pseudonymise_le: string | null
  desactive_le: string | null
  created_at: string | null
}

export interface LigneEnvoiQr {
  id: string
  gestionnaire_id: string
  objet: string | null
  created_at: string | null
  invite_sent_at: string | null
  accepted_at: string | null
  refus: string | null
}

const objetEnvoi = (v: unknown): ObjetEnvoiQr => ((OBJETS_ENVOI_QR as readonly string[]).includes(chaine(v)) ? v : 'confirmation_adresse') as ObjetEnvoiQr
const refusEnvoi = (v: unknown): RefusEnvoiQr | null => ((REFUS_ENVOI_QR as readonly string[]).includes(chaine(v)) ? (v as RefusEnvoiQr) : null)

export const envoiDepuisLigneQr = (l: LigneEnvoiQr): EnvoiGestionnaireQr => ({
  objet: objetEnvoi(l.objet), creeLe: chaine(l.created_at), envoyeLe: l.invite_sent_at ?? null, accepteLe: l.accepted_at ?? null, refus: refusEnvoi(l.refus),
})

/** Une fiche par son id (sans jeton) ; null si elle n'existe pas. */
export async function lireFicheQr(id: string): Promise<Lecture<LigneFicheQr | null>> {
  const { data, error } = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select(COLONNES_FICHE_QR).eq('id', id).maybeSingle()
  return error ? { ok: false, erreur: error } : { ok: true, valeur: (data as LigneFicheQr | null) ?? null }
}

/** Fiches filtrées (liste du super admin). */
export async function lireFichesQr(filtre: { etat: 'actifs' | 'desactives' | 'tous'; cabinet?: string }): Promise<Lecture<LigneFicheQr[]>> {
  let q = supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select(COLONNES_FICHE_QR)
  if (filtre.etat === 'actifs') q = q.eq('actif', true)
  if (filtre.etat === 'desactives') q = q.eq('actif', false)
  if (filtre.cabinet) q = q.eq('cabinet_id', filtre.cabinet)
  return lire<LigneFicheQr>(q.order('created_at', { ascending: true }))
}

/** Envois des fiches (sans jeton), du plus ancien au plus récent. */
export async function lireEnvoisQr(gestionnaireIds: readonly string[]): Promise<Lecture<LigneEnvoiQr[]>> {
  if (gestionnaireIds.length === 0) return { ok: true, valeur: [] }
  return lire<LigneEnvoiQr>(supabaseAdmin.from(TABLE_INVITATIONS_QR).select(COLONNES_ENVOI_QR)
    .in('gestionnaire_id', [...gestionnaireIds]).order('created_at', { ascending: true }))
}

/**
 * Colonnes d'accès d'une fiche (migration 20261112, PR 2), lues À PART de COLONNES_FICHE_QR : tant que la migration
 * manque, la fiche reste servie telle qu'en PR 1. L'identifiant du compte n'est jamais rendu (seulement compteRelie).
 */
export const COLONNES_ACCES_FICHE_QR = 'id, user_id, acces_ouvert_le, connexion_bloquee_le, effacement_demande_le'

interface LigneAccesFicheQr {
  id: string
  user_id: string | null
  acces_ouvert_le: string | null
  connexion_bloquee_le: string | null
  effacement_demande_le: string | null
}

/** Champs d'accès des fiches par id ; null : colonnes absentes (repli journalisé une fois) ; autre erreur rendue. */
async function lireAccesFichesQr(ids: readonly string[]): Promise<Lecture<ReadonlyMap<string, LigneAccesFicheQr> | null>> {
  const r = await lireParValeursQr<LigneAccesFicheQr>(ids, (lot) =>
    supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select(COLONNES_ACCES_FICHE_QR).in('id', lot).order('id', { ascending: true }))
  if (r.ok) return { ok: true, valeur: new Map(r.valeur.map((l) => [l.id, l])) }
  if (!structureAbsenteQr(r.erreur)) return r
  journaliserRepliAccesQr('champs d’accès des fiches', r.erreur)
  return { ok: true, valeur: null }
}

/** Champs d'accès d'une fiche gestionnaire (PR 2) : dates et drapeaux seulement. */
const champsAccesQr = (a: LigneAccesFicheQr | undefined): Pick<GestionnaireQr, 'accesOuvertLe' | 'connexionBloquee' | 'effacementDemandeLe' | 'compteRelie'> => ({
  accesOuvertLe: a?.acces_ouvert_le ?? null,
  connexionBloquee: Boolean(a?.connexion_bloquee_le),
  effacementDemandeLe: a?.effacement_demande_le ?? null,
  compteRelie: typeof a?.user_id === 'string' && a.user_id !== '',
})

/**
 * Formes publiques des fiches (liste et page profil) : cabinet, état calculé (etatGestionnaireQr), nombre de copropriétés
 * attribuées, signalements ouverts et urgents de sa portée (attributions ∪ « à tous » de SON cabinet), et, si la
 * migration 20261112 est appliquée, les champs d'accès (PR 2). Fiches contestées en tête, puis par nom. Compteurs
 * indisponibles : 0.
 */
export async function gestionnairesDepuisFichesQr(fiches: readonly LigneFicheQr[]): Promise<Lecture<GestionnaireQr[]>> {
  if (fiches.length === 0) return { ok: true, valeur: [] }
  const ids = fiches.map((f) => f.id)
  const cabinetsIds = [...new Set(fiches.map((f) => f.cabinet_id))]
  const [cabinets, envois, attributions, copros, acces] = await Promise.all([
    lire<{ id: string; nom: string | null; identifiant: string | null }>(supabaseAdmin.from(TABLE_CABINETS_QR).select('id, nom, identifiant').in('id', cabinetsIds)),
    lireEnvoisQr(ids),
    lire<{ copropriete_id: string; gestionnaire_id: string }>(supabaseAdmin.from(TABLE_ATTRIBUTIONS_QR).select('copropriete_id, gestionnaire_id').in('gestionnaire_id', ids)),
    lire<{ id: string; cabinet_id: string | null; attribuee_a_tous: boolean | null }>(
      supabaseAdmin.from(TABLE_COPROPRIETES_QR).select('id, cabinet_id, attribuee_a_tous').in('cabinet_id', cabinetsIds),
    ),
    lireAccesFichesQr(ids),
  ])
  for (const r of [cabinets, envois, attributions, copros, acces]) if (!r.ok) return r
  const accesPar = acces.ok ? acces.valeur : null
  const cabinetsPar = new Map((cabinets.ok ? cabinets.valeur : []).map((c) => [c.id, cabinetResumeDepuisLigneQr(c)]))
  const envoisPar = new Map<string, EnvoiGestionnaireQr[]>()
  for (const e of envois.ok ? envois.valeur : []) envoisPar.set(e.gestionnaire_id, [...(envoisPar.get(e.gestionnaire_id) ?? []), envoiDepuisLigneQr(e)])
  const attributionsPar = new Map<string, Set<string>>()
  for (const a of attributions.ok ? attributions.valeur : []) {
    const s = attributionsPar.get(a.gestionnaire_id) ?? new Set<string>()
    s.add(a.copropriete_id)
    attributionsPar.set(a.gestionnaire_id, s)
  }
  const droits = (copros.ok ? copros.valeur : []).map((c) => ({ id: c.id, cabinetId: c.cabinet_id, attribueeATous: c.attribuee_a_tous === true }))
  const portees = new Map(fiches.map((f) => [f.id, porteeGestionnaireQr(
    { id: f.id, cabinetId: f.cabinet_id, actif: f.actif === true }, droits, attributionsPar.get(f.id) ?? new Set(),
  )]))
  const toutes = [...new Set([...portees.values()].flatMap((p) => [...p.visibles]))]
  const compteurs = (await compteursQr(toutes)) ?? new Map()
  const maintenant = new Date()
  const liste = fiches.map((f): GestionnaireQr => {
    const visibles = [...(portees.get(f.id)?.visibles ?? [])]
    const cabinet: CabinetResumeQr = cabinetsPar.get(f.cabinet_id) ?? { id: f.cabinet_id, nom: '', identifiant: '' }
    return {
      id: f.id,
      nom: f.nom ?? null,
      cabinet,
      email: f.email ?? null,
      etat: etatGestionnaireQr(
        { actif: f.actif === true, adresseConfirmeeLe: f.adresse_confirmee_le ?? null, adresseContesteeLe: f.adresse_contestee_le ?? null },
        envoisPar.get(f.id) ?? [], maintenant,
      ),
      domaineForce: f.domaine_force === true,
      coproprietes: attributionsPar.get(f.id)?.size ?? 0,
      ouverts: visibles.reduce((n, id) => n + (compteurs.get(id)?.ouverts ?? 0), 0),
      urgents: visibles.reduce((n, id) => n + (compteurs.get(id)?.urgentsOuverts ?? 0), 0),
      creeLe: chaine(f.created_at),
      confirmeeLe: f.adresse_confirmee_le ?? null,
      // Sans la migration 20261112 : aucun champ d'accès (réponse identique à la PR 1).
      ...(accesPar ? champsAccesQr(accesPar.get(f.id)) : {}),
    }
  })
  const rang = (g: GestionnaireQr) => (g.etat === 'adresse_contestee' ? 0 : 1)
  return { ok: true, valeur: liste.sort((a, b) => rang(a) - rang(b) || (a.nom ?? '').localeCompare(b.nom ?? '', 'fr')) }
}

/** Origine d'une attribution lue en base (liste fermée de la migration). */
export const origineAttributionQr = (v: unknown): OrigineAttributionQr =>
  ((ORIGINES_ATTRIBUTION_QR as readonly string[]).includes(chaine(v)) ? v : 'super_admin') as OrigineAttributionQr

// ── Journal ──────────────────────────────────────────────────────────────────

export const COLONNES_JOURNAL_QR =
  'id, cabinet_id, acteur_id, acteur_profil, acteur_gestionnaire_id, action, copropriete_id, gestionnaire_id, signalement_id, operation_id, champs, details, created_at'

export interface LigneJournalQr {
  id: number | string
  cabinet_id: string | null
  acteur_id: string | null
  acteur_profil: string | null
  acteur_gestionnaire_id: string | null
  action: string
  copropriete_id: string | null
  gestionnaire_id: string | null
  signalement_id: string | null
  operation_id: string | null
  champs: string[] | null
  details: Record<string, unknown> | null
  created_at: string
}

const actionJournal = (v: unknown): ActionJournalQr =>
  ((ACTIONS_JOURNAL_QR as readonly string[]).includes(chaine(v)) ? v : 'journal.purge') as ActionJournalQr
const profilActeur = (v: unknown): ProfilActeurQr =>
  ((PROFILS_ACTEUR_QR as readonly string[]).includes(chaine(v)) ? v : 'systeme') as ProfilActeurQr

/**
 * Lignes du journal avec les noms joints pour l'affichage (copropriétés, gestionnaires) ; une lecture qui échoue laisse
 * les noms vides (journalisé), jamais l'événement.
 */
export async function evenementsDepuisLignesQr(lignes: readonly LigneJournalQr[]): Promise<EvenementJournalQr[]> {
  const coproIds = [...new Set(lignes.map((l) => l.copropriete_id).filter((v): v is string => typeof v === 'string'))]
  const gestIds = [...new Set(lignes.flatMap((l) => [l.gestionnaire_id, l.acteur_gestionnaire_id]).filter((v): v is string => typeof v === 'string'))]
  const [copros, fiches] = await Promise.all([
    coproIds.length ? lire<{ id: string; nom: string | null }>(supabaseAdmin.from(TABLE_COPROPRIETES_QR).select('id, nom').in('id', coproIds)) : Promise.resolve({ ok: true as const, valeur: [] }),
    gestIds.length ? lire<{ id: string; nom: string | null }>(supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select('id, nom').in('id', gestIds)) : Promise.resolve({ ok: true as const, valeur: [] }),
  ])
  for (const r of [copros, fiches]) if (!r.ok) logger.warn(`${CONTEXTE} noms du journal non lus`, { code: r.erreur.code })
  const nomsCopros = new Map((copros.ok ? copros.valeur : []).map((c) => [c.id, c.nom ?? null]))
  const nomsFiches = new Map((fiches.ok ? fiches.valeur : []).map((f) => [f.id, f.nom ?? null]))
  return lignes.map((l): EvenementJournalQr => ({
    id: String(l.id),
    creeLe: l.created_at,
    cabinetId: l.cabinet_id ?? null,
    action: actionJournal(l.action),
    acteur: { profil: profilActeur(l.acteur_profil), nom: l.acteur_gestionnaire_id ? nomsFiches.get(l.acteur_gestionnaire_id) ?? null : null },
    coproprieteId: l.copropriete_id ?? null,
    coproprieteNom: l.copropriete_id ? nomsCopros.get(l.copropriete_id) ?? null : null,
    gestionnaireId: l.gestionnaire_id ?? null,
    gestionnaireNom: l.gestionnaire_id ? nomsFiches.get(l.gestionnaire_id) ?? null : null,
    signalementId: l.signalement_id ?? null,
    operationId: l.operation_id ?? null,
    champs: Array.isArray(l.champs) ? l.champs : [],
    details: l.details && typeof l.details === 'object' ? l.details : {},
  }))
}

// ── Liens de confirmation d'adresse (lib/equipe, espace aj_signalement) ──────

/** Origine des liens envoyés par e-mail (NEXT_PUBLIC_APP_URL, sinon le site de production). */
export const origineLiensQr = (): string => (process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io').replace(/\/+$/, '')

/**
 * Après un envoi : e-mail de confirmation (nom court, nom du cabinet, lien du chemin client, jeton après le « # »),
 * puis invite_sent_at posé (une fiche dont l'e-mail n'est jamais parti reste « à renvoyer ») et journal. Ne lève jamais ;
 * vrai si l'e-mail est parti.
 */
export async function envoyerLienConfirmationQr(p: {
  envoiId: string; jetonLien: string; email: string; nom: string | null; gestionnaireId: string
  cabinet: { id: string; nom: string; identifiant: string }; acteurId: string
}): Promise<boolean> {
  const parti = await envoyerConfirmationAdresseQr({
    email: p.email, nomCourt: nomCourtQr(p.nom), cabinet: p.cabinet.nom,
    lien: urlConfirmationAdresseQr(p.cabinet.identifiant, p.jetonLien, origineLiensQr()),
  })
  if (!parti) {
    logger.warn(`${CONTEXTE} e-mail de confirmation d’adresse non envoyé`, { gestionnaire: p.gestionnaireId })
    return false
  }
  const { error } = await supabaseAdmin.from(TABLE_INVITATIONS_QR).update({ invite_sent_at: new Date().toISOString() }).eq('id', p.envoiId)
  if (error) logger.warn(`${CONTEXTE} date d’envoi non enregistrée`, { code: error.code, gestionnaire: p.gestionnaireId })
  await journaliserQr({ action: 'gestionnaire.confirmation_envoyee', cabinetId: p.cabinet.id, acteurId: p.acteurId, gestionnaireId: p.gestionnaireId })
  return true
}

export type RelectureLienQr =
  | { ok: true; envoiId: string; fiche: LigneFicheQr; cabinet: { id: string; nom: string; identifiant: string } }
  | { ok: false; code: 'introuvable' | 'deja_confirmee' | 'expire' | 'base_absente' | 'serveur'; status: 404 | 409 | 410 | 503 | 500 }

const INTROUVABLE: RelectureLienQr = { ok: false, code: 'introuvable', status: 404 }

/**
 * Le lien (signature déjà vérifiée par lireInvitationValide) est-il celui d'une fiche du cabinet du chemin ? Lu avant
 * de traduire « expiré » ou « déjà utilisé » : sous un autre chemin, le même 404 générique (relecture 3). Toute
 * lecture impossible vaut « non » (404, aucun indice), journalisée avec son seul code. `objet` (PR 2) : l'envoi doit
 * aussi être de cet objet (un lien de confirmation expiré présenté à la page d'accès reste un 404).
 */
export async function lienDuCabinetQr(token: string, identifiantCabinet: string, objet?: ObjetEnvoiQr): Promise<boolean> {
  const lien = lireJetonDuLien(token)
  if (!lien) return false
  const envoi = await supabaseAdmin.from(TABLE_INVITATIONS_QR).select(objet ? 'gestionnaire_id, objet' : 'gestionnaire_id').eq('invite_token', lien.jeton).maybeSingle()
  const lu = envoi.data as { gestionnaire_id?: unknown; objet?: unknown } | null
  const gestionnaireId = lu?.gestionnaire_id
  if (objet && lu && lu.objet !== objet) return false
  if (envoi.error || typeof gestionnaireId !== 'string') {
    if (envoi.error) logger.warn(`${CONTEXTE} envoi d’un lien expiré ou utilisé non relu`, { code: envoi.error.code })
    return false
  }
  const fiche = await lireFicheQr(gestionnaireId)
  if (!fiche.ok || !fiche.valeur) {
    if (!fiche.ok) logger.warn(`${CONTEXTE} fiche d’un lien expiré ou utilisé non relue`, { code: fiche.erreur.code })
    return false
  }
  const cabinet = await lireCabinetQr({ id: fiche.valeur.cabinet_id })
  if (!cabinet.ok) logger.warn(`${CONTEXTE} cabinet d’un lien expiré ou utilisé non relu`, { code: cabinet.erreur.code })
  return cabinet.ok && cabinet.cabinet?.identifiant === identifiantCabinet
}

/**
 * Relecture d'un lien de confirmation d'adresse (pages publiques P1-R16, R17, R17b), SANS effet : signature, envoi de
 * confirmation sans refus, fiche active non contestée à la même adresse, et cabinet de la fiche = cabinet du chemin.
 * Tout autre cas répond le même 404 générique (aucun indice) ; expiré 410 et déjà confirmé 409 seulement sous le
 * chemin du cabinet de la fiche (sinon 404, relecture 3).
 */
export async function relireLienConfirmationQr(token: string, identifiantCabinet: string): Promise<RelectureLienQr> {
  const lecture = await lireInvitationValide('aj_signalement', token)
  if (!lecture.ok) {
    if (lecture.status !== 409 && lecture.status !== 410) return INTROUVABLE
    if (!(await lienDuCabinetQr(token, identifiantCabinet))) return INTROUVABLE
    return lecture.status === 409 ? { ok: false, code: 'deja_confirmee', status: 409 } : { ok: false, code: 'expire', status: 410 }
  }
  const envoi = lecture.invite as LigneInvitation & { objet?: unknown; refus?: unknown }
  if (envoi.objet !== 'confirmation_adresse' || envoi.refus) return INTROUVABLE
  const fiche = await lireFicheQr(envoi.equipe_id)
  if (!fiche.ok) {
    if (structureAbsenteQr(fiche.erreur)) return { ok: false, code: 'base_absente', status: 503 }
    logger.error(`${CONTEXTE} lecture de la fiche d’un lien`, { code: fiche.erreur.code })
    return { ok: false, code: 'serveur', status: 500 }
  }
  const f = fiche.valeur
  if (!f || f.actif !== true || f.adresse_contestee_le || !f.email || f.email !== envoi.email) return INTROUVABLE
  const cabinet = await lireCabinetQr({ id: f.cabinet_id })
  if (!cabinet.ok) {
    logger.error(`${CONTEXTE} lecture du cabinet d’un lien`, { code: cabinet.erreur.code })
    return { ok: false, code: 'serveur', status: 500 }
  }
  if (!cabinet.cabinet || cabinet.cabinet.identifiant !== identifiantCabinet) return INTROUVABLE
  if (f.adresse_confirmee_le) return { ok: false, code: 'deja_confirmee', status: 409 }
  return {
    ok: true, envoiId: envoi.id, fiche: f,
    cabinet: { id: cabinet.cabinet.id, nom: chaine(cabinet.cabinet.nom), identifiant: chaine(cabinet.cabinet.identifiant) },
  }
}
