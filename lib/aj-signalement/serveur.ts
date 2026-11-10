// ── AJ Signalement, côté serveur : tables, droits, destinataires ──────────────
//
// Importé par les routes app/api/aj-signalement/* et par la page publique (composant serveur) ; jamais
// par un composant client. Accès aux tables signalements_qr_* avec la clé service (supabaseAdmin) :
// la RLS n'a aucune politique, donc tout contrôle d'accès est ici.
//   - dépôt public : la copropriété est trouvée par son jeton (QR code) ; rien d'autre n'est exigé ;
//   - tableau de bord : super admin seulement, par jeton Bearer (portail copropriétaire) ou par les
//     cookies de session (Administrateur judiciaire). Les copropriétés QR n'appartiennent à aucun cabinet.
// Colonnes ajoutées le 06/11/2026 (confirmation au déclarant, qualité, adresse proposée, signalement lié) : tant
// que leurs migrations ne sont pas appliquées en production, PostgREST refuse toute requête qui les nomme (42703 en
// lecture, PGRST204 en écriture). Chaque lecture ou écriture qui les nomme prévoit donc un repli sans elles,
// journalisé une fois par isolat et par opération (règle de CLAUDE.md).

import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { getAuthUser } from '@/lib/auth-helpers'
import { estSuperAdmin } from '@/lib/coproprietaire/acces'
import { logger } from '@/lib/logger'
import {
  JETON_QR, PRIORITES_SIGNALEMENT_QR, STATUTS_OUVERTS_QR, STATUTS_SIGNALEMENT_QR, estQualiteDeclarantQr,
  type AdresseProposeeQr, type CoproprieteQr, type LangueSignalementQr, type PrioriteSignalementQr, type SignalementQr,
  type StatutSignalementQr, type TableauQr,
} from '@/lib/aj-signalement/types'
import {
  COLONNES_SEMBLABLES_QR, SEMBLABLES_LUS_MAX, dateLimiteSemblablesQr, selectionnerSemblablesQr, variantesZoneQr,
  type LigneSemblableQr, type RechercheSemblablesQr,
} from '@/lib/aj-signalement/semblables'

export const TABLE_COPROPRIETES_QR = 'signalements_qr_coproprietes'
export const TABLE_SIGNALEMENTS_QR = 'signalements_qr'
/** Migration à appliquer en production pour que les tables existent. */
export const MIGRATION_QR = 'supabase/migrations/20261104_signalements_qr.sql'
/** Migrations du 06/11/2026, à appliquer dans cet ordre (avant la fusion) ; d'ici là, repli sans leurs colonnes. */
export const MIGRATION_CONFIRMATION_QR = 'supabase/migrations/20261106_signalements_qr_confirmation.sql'
export const MIGRATION_GEOLOC_QUALITE_QR = 'supabase/migrations/20261106_signalements_qr_geoloc_qualite.sql'
/** Signalements renvoyés au tableau de bord (les plus récents). */
export const SIGNALEMENTS_MAX = 500

const CONTEXTE = '[AJ SIGNALEMENT]'

type ErreurBase = { code?: string; message?: string }

/** Erreur PostgREST « relation does not exist » : la migration n'est pas appliquée. */
export const baseAbsente = (erreur: { code?: string } | null | undefined): boolean => erreur?.code === '42P01'

/**
 * Colonne inconnue de la base : 42703 (« column … does not exist ») en lecture, PGRST204 (« Could not find the '…'
 * column … in the schema cache ») en insertion ou en mise à jour. La requête entière est alors refusée : la rejouer
 * sans les nouvelles colonnes ne crée aucun doublon.
 */
export const colonneInconnue = (erreur: ErreurBase | null | undefined): boolean => erreur?.code === '42703' || erreur?.code === 'PGRST204'

const replisJournalises = new Set<string>()

/** Un avertissement par opération et par isolat (Worker) : la production n'est pas noyée tant que la migration manque. */
function journaliserRepliUneFois(operation: string, erreur: ErreurBase | null, migration: string): void {
  if (replisJournalises.has(operation)) return
  replisJournalises.add(operation)
  logger.warn(`${CONTEXTE} colonnes absentes : repli sans les colonnes du 06/11/2026 (${operation})`, {
    migration, code: erreur?.code, message: erreur?.message,
  })
}

/** Tests : chaque cas repart d'un isolat « neuf ». */
export const reinitialiserReplisQr = (): void => replisJournalises.clear()

export const reponseErreur = (code: string, status: number): NextResponse => NextResponse.json({ error: code }, { status })

/** Réponse d'une erreur de lecture ou d'écriture : 503 « base_absente » (migration manquante), sinon 500. */
export const reponseErreurBase = (erreur: { code?: string } | null | undefined): NextResponse =>
  (baseAbsente(erreur) ? reponseErreur('base_absente', 503) : reponseErreur('serveur', 500))

export const COLONNES_COPROPRIETE_QR = 'id, nom, adresse, jeton, emails_destinataires, actif, created_at'
/** Colonnes des migrations du 06/11/2026 : peut-être absentes en production (repli). */
export const COLONNES_NOUVELLES_SIGNALEMENT_QR: readonly string[] = [
  'confirmation_envoyee_le', 'confirmation_erreur', 'qualite_declarant', 'adresse_proposee', 'signalement_lie_id',
]
export const COLONNES_SIGNALEMENT_QR =
  'id, copropriete_id, prenom, nom, telephone, email, batiment, etage, num_lot, est_partie_commune, zone_signalee, ' +
  'type_intervention, description, priorite, statut, langue, email_envoye_le, email_erreur, ' +
  `${COLONNES_NOUVELLES_SIGNALEMENT_QR.join(', ')}, created_at, updated_at`

export interface LigneCoproprieteQr {
  id: string
  nom: string | null
  adresse: string | null
  jeton: string
  emails_destinataires: string[] | null
  actif: boolean | null
  created_at: string | null
}

export interface LigneSignalementQr {
  id: string
  copropriete_id: string
  prenom: string | null
  nom: string | null
  telephone: string | null
  email: string | null
  batiment: string | null
  etage: string | null
  num_lot: string | null
  est_partie_commune: boolean | null
  zone_signalee: string | null
  type_intervention: string | null
  description: string | null
  priorite: string | null
  statut: string | null
  langue: string | null
  email_envoye_le: string | null
  email_erreur: string | null
  /** Migration 20261106_signalements_qr_confirmation : e-mail de confirmation au déclarant (absente avant). */
  confirmation_envoyee_le?: string | null
  confirmation_erreur?: string | null
  /** Migration 20261106_signalements_qr_geoloc_qualite (absentes avant). */
  qualite_declarant?: string | null
  adresse_proposee?: string | null
  signalement_lie_id?: string | null
  created_at: string | null
  updated_at: string | null
}

const chaine = (valeur: unknown): string => (typeof valeur === 'string' ? valeur : '')

const statutValide = (valeur: unknown): StatutSignalementQr =>
  ((STATUTS_SIGNALEMENT_QR as readonly string[]).includes(chaine(valeur)) ? valeur : 'en_attente') as StatutSignalementQr

const prioriteValide = (valeur: unknown): PrioriteSignalementQr =>
  ((PRIORITES_SIGNALEMENT_QR as readonly string[]).includes(chaine(valeur)) ? valeur : 'normale') as PrioriteSignalementQr

const langueValide = (valeur: unknown): LangueSignalementQr => (valeur === 'pt' ? 'pt' : 'fr')

export interface CompteursCoproprieteQr {
  total: number
  enAttente: number
}

export function coproprieteDepuisLigne(
  ligne: LigneCoproprieteQr, compteurs: CompteursCoproprieteQr = { total: 0, enAttente: 0 }, derniereAdresseProposee: AdresseProposeeQr | null = null,
): CoproprieteQr {
  const adresse = chaine(ligne.adresse)
  return {
    id: ligne.id,
    nom: chaine(ligne.nom),
    adresse,
    jeton: ligne.jeton,
    emailsDestinataires: Array.isArray(ligne.emails_destinataires) ? ligne.emails_destinataires.filter((e): e is string => typeof e === 'string') : [],
    actif: ligne.actif !== false,
    creeLe: chaine(ligne.created_at),
    nbSignalements: compteurs.total,
    nbEnAttente: compteurs.enAttente,
    // Une copropriété dont l'adresse est renseignée n'a rien à proposer.
    derniereAdresseProposee: adresse.trim() ? null : derniereAdresseProposee,
  }
}

export function signalementDepuisLigne(ligne: LigneSignalementQr, coproprieteNom: string): SignalementQr {
  return {
    id: ligne.id,
    coproprieteId: ligne.copropriete_id,
    coproprieteNom,
    prenom: chaine(ligne.prenom),
    nom: chaine(ligne.nom),
    telephone: chaine(ligne.telephone),
    email: chaine(ligne.email),
    batiment: chaine(ligne.batiment),
    etage: chaine(ligne.etage),
    numLot: chaine(ligne.num_lot),
    estPartieCommune: ligne.est_partie_commune === true,
    zoneSignalee: chaine(ligne.zone_signalee),
    typeIntervention: chaine(ligne.type_intervention),
    description: chaine(ligne.description),
    priorite: prioriteValide(ligne.priorite),
    statut: statutValide(ligne.statut),
    langue: langueValide(ligne.langue),
    emailEnvoyeLe: ligne.email_envoye_le ?? null,
    emailErreur: ligne.email_erreur ?? null,
    confirmationEnvoyeeLe: ligne.confirmation_envoyee_le ?? null,
    confirmationErreur: ligne.confirmation_erreur ?? null,
    qualiteDeclarant: estQualiteDeclarantQr(ligne.qualite_declarant) ? ligne.qualite_declarant : null,
    adresseProposee: chaine(ligne.adresse_proposee),
    signalementLieId: chaine(ligne.signalement_lie_id) || null,
    creeLe: chaine(ligne.created_at),
    misAJourLe: chaine(ligne.updated_at) || chaine(ligne.created_at),
  }
}

// ── Droits ───────────────────────────────────────────────────────────────────

export type ControleSuperAdmin = { ok: true; user: User } | { ok: false; reponse: NextResponse }

/**
 * Utilisateur du tableau de bord : jeton Bearer (portail copropriétaire), sinon cookies de session
 * (Administrateur judiciaire). 401 sans session, 403 pour un compte qui n'est pas super admin.
 */
export async function controlerSuperAdmin(request: NextRequest): Promise<ControleSuperAdmin> {
  let user: User | null = await getAuthUser(request)
  if (!user) {
    try {
      const supabase = await createServerSupabaseClient()
      user = (await supabase.auth.getUser()).data.user
    } catch (e) {
      logger.warn(`${CONTEXTE} session par cookies illisible`, { message: e instanceof Error ? e.message : String(e) })
      user = null
    }
  }
  if (!user) return { ok: false, reponse: reponseErreur('non_authentifie', 401) }
  if (!estSuperAdmin(user)) return { ok: false, reponse: reponseErreur('interdit', 403) }
  return { ok: true, user }
}

// ── Lectures ─────────────────────────────────────────────────────────────────

export type LectureCoproprieteQr =
  | { ok: true; copropriete: LigneCoproprieteQr | null }
  | { ok: false; code: 'base_absente' | 'serveur' }

/** Copropriété active portant ce jeton ; null si le jeton est inconnu, mal formé ou désactivé. */
export async function lireCoproprieteParJeton(jeton: string): Promise<LectureCoproprieteQr> {
  if (!JETON_QR.test(jeton)) return { ok: true, copropriete: null }
  const { data, error } = await supabaseAdmin
    .from(TABLE_COPROPRIETES_QR)
    .select(COLONNES_COPROPRIETE_QR)
    .eq('jeton', jeton)
    .eq('actif', true)
    .maybeSingle()
  if (error) {
    logger.error(`${CONTEXTE} lecture de la copropriété par jeton`, { code: error.code, message: error.message })
    return { ok: false, code: baseAbsente(error) ? 'base_absente' : 'serveur' }
  }
  return { ok: true, copropriete: (data as LigneCoproprieteQr | null) ?? null }
}

export type CoproprieteActiveQr = { ok: true; copropriete: LigneCoproprieteQr } | { ok: false; reponse: NextResponse }

/**
 * Routes publiques (dépôt, adresse proposée, signalements semblables) : la copropriété active du jeton, sinon la
 * réponse à rendre (404 jeton inconnu, mal formé ou QR code désactivé ; 503 base_absente ; 500).
 */
export async function coproprieteActiveQr(jeton: string): Promise<CoproprieteActiveQr> {
  const lecture = await lireCoproprieteParJeton(jeton)
  if (!lecture.ok) return { ok: false, reponse: reponseErreur(lecture.code, lecture.code === 'base_absente' ? 503 : 500) }
  if (!lecture.copropriete) return { ok: false, reponse: reponseErreur('introuvable', 404) }
  return { ok: true, copropriete: lecture.copropriete }
}

export type LectureTableauQr = { ok: true; tableau: TableauQr } | { ok: false; code: 'base_absente' | 'serveur' }

const lireSignalementsTableau = (colonnes: string) => supabaseAdmin
  .from(TABLE_SIGNALEMENTS_QR)
  .select(colonnes)
  .order('created_at', { ascending: false })
  .limit(SIGNALEMENTS_MAX)

/** Copropriété → adresse proposée la plus récente (les signalements arrivent du plus récent au plus ancien). */
function dernieresAdressesProposees(lignes: readonly LigneSignalementQr[]): Map<string, AdresseProposeeQr> {
  const dernieres = new Map<string, AdresseProposeeQr>()
  for (const s of lignes) {
    const adresse = chaine(s.adresse_proposee).trim()
    if (adresse && !dernieres.has(s.copropriete_id)) dernieres.set(s.copropriete_id, { adresse, le: chaine(s.created_at) })
  }
  return dernieres
}

/**
 * Tableau de bord : toutes les copropriétés (avec leurs compteurs et, sans adresse, la dernière adresse proposée) et
 * les signalements les plus récents. Colonne inconnue (migration du 06/11/2026 non appliquée) : relecture par
 * select('*'), la liste blanche de signalementDepuisLigne ne garde que les champs connus.
 */
export async function lireTableauQr(): Promise<LectureTableauQr> {
  const copros = await supabaseAdmin.from(TABLE_COPROPRIETES_QR).select(COLONNES_COPROPRIETE_QR).order('created_at', { ascending: true })
  if (copros.error) {
    logger.error(`${CONTEXTE} lecture des copropriétés`, { code: copros.error.code, message: copros.error.message })
    return { ok: false, code: baseAbsente(copros.error) ? 'base_absente' : 'serveur' }
  }
  let signalements = await lireSignalementsTableau(COLONNES_SIGNALEMENT_QR)
  if (colonneInconnue(signalements.error)) {
    journaliserRepliUneFois('lecture du tableau', signalements.error, `${MIGRATION_CONFIRMATION_QR} puis ${MIGRATION_GEOLOC_QUALITE_QR}`)
    signalements = await lireSignalementsTableau('*')
  }
  if (signalements.error) {
    logger.error(`${CONTEXTE} lecture des signalements`, { code: signalements.error.code, message: signalements.error.message })
    return { ok: false, code: baseAbsente(signalements.error) ? 'base_absente' : 'serveur' }
  }
  const lignesCopros = (copros.data ?? []) as unknown as LigneCoproprieteQr[]
  const lignesSignalements = (signalements.data ?? []) as unknown as LigneSignalementQr[]
  const noms = new Map(lignesCopros.map((c) => [c.id, chaine(c.nom)]))
  const compteurs = new Map<string, CompteursCoproprieteQr>()
  for (const s of lignesSignalements) {
    const compte = compteurs.get(s.copropriete_id) ?? { total: 0, enAttente: 0 }
    compte.total += 1
    if (statutValide(s.statut) === 'en_attente') compte.enAttente += 1
    compteurs.set(s.copropriete_id, compte)
  }
  const dernieres = dernieresAdressesProposees(lignesSignalements)
  return {
    ok: true,
    tableau: {
      coproprietes: lignesCopros.map((c) => coproprieteDepuisLigne(c, compteurs.get(c.id), dernieres.get(c.id) ?? null)),
      signalements: lignesSignalements.map((s) => signalementDepuisLigne(s, noms.get(s.copropriete_id) ?? '')),
    },
  }
}

export type LectureSemblablesQr = { ok: true; lignes: LigneSemblableQr[] } | { ok: false; code: 'base_absente' | 'serveur' }

/**
 * Signalements déjà faits au même endroit dans une copropriété : parties communes, statuts ouverts, moins de 60
 * jours, même zone (FR ou PT) filtrés par la base ; même bâtiment normalisé, tri et limite à 5 ici. Seules des
 * colonnes de la migration 20261104 sont lues : aucun repli n'est nécessaire.
 */
export async function lireSemblablesQr(coproprieteId: string, recherche: RechercheSemblablesQr, maintenant = new Date()): Promise<LectureSemblablesQr> {
  const { data, error } = await supabaseAdmin
    .from(TABLE_SIGNALEMENTS_QR)
    .select(COLONNES_SEMBLABLES_QR)
    .eq('copropriete_id', coproprieteId)
    .eq('est_partie_commune', true)
    .in('statut', [...STATUTS_OUVERTS_QR])
    .gte('created_at', dateLimiteSemblablesQr(maintenant))
    .in('zone_signalee', variantesZoneQr(recherche.zone))
    .order('created_at', { ascending: false })
    .limit(SEMBLABLES_LUS_MAX)
  if (error) {
    logger.error(`${CONTEXTE} lecture des signalements semblables`, { code: error.code, message: error.message, copropriete: coproprieteId })
    return { ok: false, code: baseAbsente(error) ? 'base_absente' : 'serveur' }
  }
  return { ok: true, lignes: selectionnerSemblablesQr((data ?? []) as unknown as LigneSemblableQr[], recherche, maintenant) }
}

// ── Écritures d'un dépôt (avec repli tant que les migrations du 06/11/2026 manquent) ──

const sansColonnesNouvelles = (ligne: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(ligne).filter(([colonne]) => !COLONNES_NOUVELLES_SIGNALEMENT_QR.includes(colonne)))

export interface SignalementInsere {
  id: string
  created_at: string
  updated_at: string | null
}

/**
 * Insère un signalement. Colonne inconnue (qualité, adresse proposée, lien : migration geoloc_qualite non appliquée) :
 * seconde insertion avec les seules colonnes d'origine, journalisée une fois. Le dépôt n'est jamais perdu pour autant :
 * la qualité et l'adresse proposée restent dans les e-mails (en mémoire).
 */
export async function insererSignalementQr(ligne: Record<string, unknown>): Promise<{ data: SignalementInsere | null; error: ErreurBase | null }> {
  const inserer = async (valeurs: Record<string, unknown>) => {
    const { data, error } = await supabaseAdmin.from(TABLE_SIGNALEMENTS_QR).insert(valeurs).select('id, created_at, updated_at').single()
    return { data: (data as SignalementInsere | null) ?? null, error: (error as ErreurBase | null) ?? null }
  }
  const premiere = await inserer(ligne)
  if (!colonneInconnue(premiere.error)) return premiere
  journaliserRepliUneFois('insertion d’un signalement', premiere.error, MIGRATION_GEOLOC_QUALITE_QR)
  return inserer(sansColonnesNouvelles(ligne))
}

export interface EtatEmailsQr {
  email_envoye_le: string | null
  email_erreur: string | null
  confirmation_envoyee_le: string | null
  confirmation_erreur: string | null
}

/**
 * État des deux e-mails, en une seule mise à jour. Colonnes de la confirmation inconnues (migration confirmation non
 * appliquée) : mise à jour réduite à email_envoye_le et email_erreur, journalisée une fois. Ne lève pas.
 */
export async function enregistrerEtatEmailsQr(id: string, etat: EtatEmailsQr): Promise<void> {
  const mettreAJour = async (valeurs: Record<string, unknown>) =>
    (await supabaseAdmin.from(TABLE_SIGNALEMENTS_QR).update(valeurs).eq('id', id)).error as ErreurBase | null
  let erreur = await mettreAJour({ ...etat })
  if (colonneInconnue(erreur)) {
    journaliserRepliUneFois('état des e-mails', erreur, MIGRATION_CONFIRMATION_QR)
    erreur = await mettreAJour({ email_envoye_le: etat.email_envoye_le, email_erreur: etat.email_erreur })
  }
  if (erreur) logger.warn(`${CONTEXTE} état des e-mails non enregistré`, { code: erreur.code, message: erreur.message })
}

/** Compteurs d'une copropriété (après une modification, pour renvoyer une fiche complète). */
export async function compterSignalementsQr(coproprieteId: string): Promise<CompteursCoproprieteQr> {
  const { data, error } = await supabaseAdmin.from(TABLE_SIGNALEMENTS_QR).select('statut').eq('copropriete_id', coproprieteId)
  if (error) {
    logger.warn(`${CONTEXTE} compteurs non lus`, { code: error.code, message: error.message })
    return { total: 0, enAttente: 0 }
  }
  const lignes = (data ?? []) as Array<{ statut: string | null }>
  return { total: lignes.length, enAttente: lignes.filter((l) => statutValide(l.statut) === 'en_attente').length }
}

// ── Destinataires et jetons ──────────────────────────────────────────────────

const emailPropre = (valeur: unknown): string | null => {
  const propre = typeof valeur === 'string' ? valeur.trim().toLowerCase() : ''
  return propre.includes('@') ? propre : null
}

/** Destinataires de l'e-mail : ceux de la copropriété, sinon l'administrateur du déploiement (ADMIN_EMAIL, ADMIN_EMAIL_2). */
export function destinatairesSignalement(
  copropriete: { emails_destinataires?: string[] | null },
  env: Record<string, string | undefined> = process.env,
): string[] {
  const propres = (copropriete.emails_destinataires ?? []).map(emailPropre).filter((e): e is string => e !== null)
  if (propres.length > 0) return [...new Set(propres)]
  return [...new Set([env.ADMIN_EMAIL, env.ADMIN_EMAIL_2].map(emailPropre).filter((e): e is string => e !== null))]
}

/** Nouveau jeton de QR code : UUID aléatoire sans tirets (32 hexadécimaux, 122 bits d'aléa). */
export const genererJetonQr = (): string => globalThis.crypto.randomUUID().replace(/-/g, '')

/** Identifiant de ligne (UUID) lu dans l'adresse d'une route. */
export const estUuid = (valeur: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valeur)
