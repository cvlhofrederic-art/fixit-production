// ── AJ Signalement, côté serveur : tables, droits, destinataires ──────────────
//
// Importé par les routes app/api/aj-signalement/* et par la page publique (composant serveur) ; jamais
// par un composant client. Accès aux tables signalements_qr_* avec la clé service (supabaseAdmin) :
// la RLS n'a aucune politique, donc tout contrôle d'accès est ici.
//   - dépôt public : la copropriété est trouvée par son jeton (QR code) ; rien d'autre n'est exigé ;
//   - espace AJ Signalement (/fr/aj-signalement/, cookies de session ; jeton Bearer accepté quand l'appelant en donne
//     un) : super admin seulement, par controlerAccesQr (isSuperAdmin : rôle ET liste ADMIN_EMAIL, jamais la « vue en
//     tant que »). En PR 2, les gestionnaires d'un cabinet client y entreront par le même contrôle.
// Colonnes ajoutées le 06/11/2026 (confirmation au déclarant, qualité, adresse proposée, signalement lié) : tant
// que leurs migrations ne sont pas appliquées en production, PostgREST refuse toute requête qui les nomme (42703 en
// lecture, PGRST204 en écriture). Chaque lecture ou écriture qui les nomme prévoit donc un repli sans elles,
// journalisé une fois par isolat et par opération (règle de CLAUDE.md).
// Migration du 11/11/2026 (cabinets clients, gestionnaires, attributions, journal) : même règle, avec en plus les
// tables absentes (42P01, PGRST205) et les fonctions absentes (PGRST202) ; les lectures se replient sur les valeurs par
// défaut, les écritures qui en dépendent répondent 503 base_absente. Les erreurs de la base ne sont JAMAIS rendues
// au navigateur (codeDepuisErreurSqlQr) ni journalisées avec leur message quand il peut porter une valeur.

import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { getAuthUser, isSuperAdmin } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import {
  ERREURS_METIER_SQL_QR, JETON_QR, PRIORITES_SIGNALEMENT_QR, STATUTS_OUVERTS_QR, STATUTS_SIGNALEMENT_QR, estQualiteDeclarantQr,
  gestionCoproprieteQrVide,
  type AdresseProposeeQr, type CabinetResumeQr, type CoproprieteDoublonQr, type CoproprieteQr, type CreateurCoproprieteQr,
  type GestionnaireResumeQr, type GestionnaireSuiviQr, type LangueCabinetQr, type LangueSignalementQr, type LigneEmailGestionnaireQr,
  type PrioriteSignalementQr, type ProfilQr, type ReservationEmailsQr, type SignalementQr, type StatutSignalementQr, type TableauQr,
  type TypeProfilQr,
} from '@/lib/aj-signalement/types'
import {
  COLONNES_SEMBLABLES_QR, SEMBLABLES_LUS_MAX, dateLimiteSemblablesQr, selectionnerSemblablesQr, variantesZoneQr,
  type LigneSemblableQr, type RechercheSemblablesQr,
} from '@/lib/aj-signalement/semblables'
import { adressesDeFichesQr, destinatairesSignalementQr } from '@/lib/aj-signalement/destinataires'
import { emailCanoniqueQr } from '@/lib/aj-signalement/gestionnaires'
import { porteeGestionnaireQr } from '@/lib/aj-signalement/acces-espace'
import { BUDGET_EMAILS_CABINET_HEURE, BUDGET_EMAILS_COPRO_HEURE } from '@/lib/aj-signalement/budget-emails'

export const TABLE_COPROPRIETES_QR = 'signalements_qr_coproprietes'
export const TABLE_SIGNALEMENTS_QR = 'signalements_qr'
export const TABLE_CABINETS_QR = 'signalements_qr_cabinets'
export const TABLE_DOMAINES_QR = 'signalements_qr_domaines_autorises'
export const TABLE_GESTIONNAIRES_QR = 'signalements_qr_gestionnaires'
export const TABLE_INVITATIONS_QR = 'signalements_qr_invitations'
export const TABLE_ATTRIBUTIONS_QR = 'signalements_qr_attributions'
export const TABLE_JOURNAL_QR = 'signalements_qr_journal'
/** Migration à appliquer en production pour que les tables existent. */
export const MIGRATION_QR = 'supabase/migrations/20261104_signalements_qr.sql'
/** Migrations du 06/11/2026, dans cet ordre (appliquées en production le 11/11/2026) ; sans elles, repli sans leurs colonnes. */
export const MIGRATION_CONFIRMATION_QR = 'supabase/migrations/20261106_signalements_qr_confirmation.sql'
export const MIGRATION_GEOLOC_QUALITE_QR = 'supabase/migrations/20261106_signalements_qr_geoloc_qualite.sql'
/**
 * Migration des cabinets clients, gestionnaires, attributions et journal (à appliquer après les deux précédentes) ;
 * d'ici là, repli sans ses tables, colonnes et fonctions (42P01, 42703, PGRST204, PGRST202, PGRST200).
 */
export const MIGRATION_GESTIONNAIRES_QR = 'supabase/migrations/20261111_signalements_qr_gestionnaires.sql'
/** Signalements renvoyés au tableau de bord (les plus récents). */
export const SIGNALEMENTS_MAX = 500
/** Signalements renvoyés pour la page de suivi d'un gestionnaire (P1-R1 ?gestionnaire=). */
export const SIGNALEMENTS_SUIVI_MAX = 100

const CONTEXTE = '[AJ SIGNALEMENT]'

export type ErreurBase = { code?: string; message?: string; details?: string }

/**
 * Table absente : la migration n'est pas appliquée. 42P01 (« relation does not exist », PostgreSQL) ou PGRST205
 * (« Could not find the table … in the schema cache ») : PostgREST 12 et suivants, dont la production (PostgREST 13),
 * répondent PGRST205 avant même d'interroger PostgreSQL. Même règle que tableAbsenteQr.
 */
export const baseAbsente = (erreur: { code?: string } | null | undefined): boolean => erreur?.code === '42P01' || erreur?.code === 'PGRST205'

/**
 * Colonne inconnue de la base : 42703 (« column … does not exist ») en lecture, PGRST204 (« Could not find the '…'
 * column … in the schema cache ») en insertion ou en mise à jour. La requête entière est alors refusée : la rejouer
 * sans les nouvelles colonnes ne crée aucun doublon.
 */
export const colonneInconnue = (erreur: ErreurBase | null | undefined): boolean => erreur?.code === '42703' || erreur?.code === 'PGRST204'

/** Table absente (42P01, ou PGRST205 « Could not find the table … in the schema cache »). */
export const tableAbsenteQr = (erreur: ErreurBase | null | undefined): boolean => erreur?.code === '42P01' || erreur?.code === 'PGRST205'

/** Fonction SQL absente du cache de PostgREST (PGRST202) : migration du 11/11/2026 non appliquée. */
export const fonctionAbsenteQr = (erreur: ErreurBase | null | undefined): boolean => erreur?.code === 'PGRST202'

/** Toute absence de structure (table, colonne, fonction, relation d'embarqué PGRST200) : la migration manque. */
export const structureAbsenteQr = (erreur: ErreurBase | null | undefined): boolean =>
  tableAbsenteQr(erreur) || colonneInconnue(erreur) || fonctionAbsenteQr(erreur) || erreur?.code === 'PGRST200'

const replisJournalises = new Set<string>()

/** Un avertissement par opération et par isolat (Worker) : la production n'est pas noyée tant que la migration manque. */
function journaliserRepliUneFois(operation: string, erreur: ErreurBase | null, migration: string): void {
  if (replisJournalises.has(operation)) return
  replisJournalises.add(operation)
  logger.warn(`${CONTEXTE} colonnes absentes : repli sans les colonnes du 06/11/2026 (${operation})`, {
    migration, code: erreur?.code, message: erreur?.message,
  })
}

/**
 * Lecture de signalements relue sans les colonnes du 06/11/2026 (tableau, signalements d'une copropriété) : un
 * avertissement par opération et par isolat, comme les autres replis de ces migrations.
 */
export function journaliserRepliColonnesSignalementQr(operation: string, erreur: ErreurBase | null): void {
  journaliserRepliUneFois(operation, erreur, `${MIGRATION_CONFIRMATION_QR} puis ${MIGRATION_GEOLOC_QUALITE_QR}`)
}

/** Même règle pour la migration du 11/11/2026 : le code seul (le message d'une erreur de structure suffit au code). */
export function journaliserRepliGestionQr(operation: string, erreur: ErreurBase | null | undefined): void {
  const cle = `gestion:${operation}`
  if (replisJournalises.has(cle)) return
  replisJournalises.add(cle)
  logger.warn(`${CONTEXTE} migration du 11/11/2026 absente : repli (${operation})`, { migration: MIGRATION_GESTIONNAIRES_QR, code: erreur?.code })
}

/** Tests : chaque cas repart d'un isolat « neuf ». */
export const reinitialiserReplisQr = (): void => replisJournalises.clear()

export const reponseErreur = (code: string, status: number): NextResponse => NextResponse.json({ error: code }, { status })

/** Réponse d'une erreur de lecture ou d'écriture : 503 « base_absente » (migration manquante), sinon 500. */
export const reponseErreurBase = (erreur: { code?: string } | null | undefined): NextResponse =>
  (baseAbsente(erreur) ? reponseErreur('base_absente', 503) : reponseErreur('serveur', 500))

/** Réponse JSON d'une lecture authentifiée : jamais en cache (ni navigateur, ni Cloudflare). */
export function reponsePriveeQr(corps: unknown, status = 200): NextResponse {
  const reponse = NextResponse.json(corps, { status })
  reponse.headers.set('Cache-Control', 'private, no-store')
  return reponse
}

/** Corps 400 d'une validation refusée (détail Zod : noms de champs et règles, jamais une donnée de la base). */
export const reponseInvalide = (details: string): NextResponse => NextResponse.json({ error: 'invalide', details }, { status: 400 })

/** Paramètres de requête d'un GET, pour un schéma strict (un paramètre inconnu donne 400). */
export const parametresQr = (request: NextRequest): Record<string, string> => Object.fromEntries(request.nextUrl.searchParams)

// ── Erreurs de la base → codes publics ───────────────────────────────────────

/** Contraintes uniques nommées de la migration du 11/11/2026 → code public (409). */
const CONTRAINTES_UNIQUES_QR: ReadonlyArray<[string, string]> = [
  ['signalements_qr_cabinets_identifiant_unique', 'identifiant_pris'],
  ['signalements_qr_domaines_domaine_unique', 'domaine_pris'],
  ['uq_signalements_qr_gestionnaires_email', 'existe_deja'],
  ['uq_signalements_qr_copros_immatriculation', 'doublon'],
  ['uq_signalements_qr_copros_reference', 'doublon'],
  ['signalements_qr_operations_pkey', 'a_reverifier'],
]

/**
 * Conflit avec une écriture concurrente : blocage mutuel (40P01) ou échec de sérialisation (40001). La transaction est
 * annulée en entier (rien n'est écrit) ; l'écran met à jour la page et recommence (essai PGlite du 11/11, D7).
 */
export const conflitConcurrenceQr = (erreur: ErreurBase | null | undefined): boolean => erreur?.code === '40P01' || erreur?.code === '40001'

/**
 * Code public d'une erreur de la base (fonctions SQL et tables d'AJ Signalement). P0001 : message de la liste fermée
 * ERREURS_METIER_SQL_QR (409), sinon 500 ; 23505 : selon la contrainte (409) ; 23503 : 409 a_reverifier ; 40P01 et
 * 40001 (conflit avec une écriture concurrente) : 409 a_reverifier ; 42501 : 403 interdit ; 22023 : 400 invalide ;
 * structure absente : 503 base_absente. Le message n'est jamais rendu.
 */
export function codeDepuisErreurSqlQr(erreur: ErreurBase | null | undefined): { code: string; status: number } {
  const code = erreur?.code ?? ''
  const message = erreur?.message ?? ''
  if (code === 'P0001') {
    return (ERREURS_METIER_SQL_QR as readonly string[]).includes(message) ? { code: message, status: 409 } : { code: 'serveur', status: 500 }
  }
  if (code === '23505') {
    const trouvee = CONTRAINTES_UNIQUES_QR.find(([contrainte]) => message.includes(`"${contrainte}"`))
    return { code: trouvee?.[1] ?? 'a_reverifier', status: 409 }
  }
  if (code === '23503' || conflitConcurrenceQr(erreur)) return { code: 'a_reverifier', status: 409 }
  if (code === '42501') return { code: 'interdit', status: 403 }
  if (code === '22023') return { code: 'invalide', status: 400 }
  if (tableAbsenteQr(erreur) || fonctionAbsenteQr(erreur)) return { code: 'base_absente', status: 503 }
  return { code: 'serveur', status: 500 }
}

/** Réponse d'une erreur de la base, journalisée avec son seul code (et l'opération). */
export function reponseErreurSqlQr(erreur: ErreurBase | null | undefined, operation: string, ids: Record<string, string> = {}): NextResponse {
  const { code, status } = codeDepuisErreurSqlQr(erreur)
  if (status >= 500) logger.error(`${CONTEXTE} ${operation} refusée par la base`, { code: erreur?.code, ...ids })
  else if (conflitConcurrenceQr(erreur)) logger.warn(`${CONTEXTE} ${operation} : conflit avec une écriture concurrente, à recommencer`, { code: erreur?.code, ...ids })
  return reponseErreur(code, status)
}

// ── Lignes et formes publiques ───────────────────────────────────────────────

export const COLONNES_COPROPRIETE_QR = 'id, nom, adresse, jeton, emails_destinataires, actif, created_at'
/** Colonnes de la migration du 11/11/2026 sur les copropriétés : peut-être absentes en production (repli). */
export const COLONNES_GESTION_COPROPRIETE_QR =
  'cabinet_id, code_postal, ville, immatriculation, reference_cabinet, batiments, attribuee_a_tous, cree_par_gestionnaire_id'
export const COLONNES_COPROPRIETE_ETENDUES_QR = `${COLONNES_COPROPRIETE_QR}, ${COLONNES_GESTION_COPROPRIETE_QR}`
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
  /** Migration 20261111 (absentes avant). */
  cabinet_id?: string | null
  code_postal?: string | null
  ville?: string | null
  immatriculation?: string | null
  reference_cabinet?: string | null
  batiments?: string[] | null
  attribuee_a_tous?: boolean | null
  cree_par_gestionnaire_id?: string | null
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

/** Compteurs d'une copropriété (fonction signalements_qr_compteurs, sinon calculés sur les signalements lus). */
export interface CompteursCoproprieteQr {
  total: number
  enAttente: number
  ouverts: number
  urgentsOuverts: number
  attente48h: number
  dernier: string | null
}

export const compteursVidesQr = (): CompteursCoproprieteQr => ({ total: 0, enAttente: 0, ouverts: 0, urgentsOuverts: 0, attente48h: 0, dernier: null })

/** Ce que la fiche d'une copropriété reçoit des tables du 11/11/2026 (vide tant que la migration manque). */
export interface ContexteGestionQr {
  cabinets: ReadonlyMap<string, CabinetResumeQr>
  gestionnairesParCopro: ReadonlyMap<string, GestionnaireResumeQr[]>
  nomsFiches: ReadonlyMap<string, string | null>
  emailsFiches: ReadonlyArray<{ email: string | null }>
}

export const contexteGestionVideQr = (): ContexteGestionQr => ({
  cabinets: new Map(), gestionnairesParCopro: new Map(), nomsFiches: new Map(), emailsFiches: [],
})

const chaineOuNull = (valeur: unknown): string | null => (typeof valeur === 'string' && valeur.trim() ? valeur : null)

export function coproprieteDepuisLigne(
  ligne: LigneCoproprieteQr,
  compteurs: CompteursCoproprieteQr = compteursVidesQr(),
  derniereAdresseProposee: AdresseProposeeQr | null = null,
  contexte: ContexteGestionQr = contexteGestionVideQr(),
): CoproprieteQr {
  const adresse = chaine(ligne.adresse)
  const emailsDestinataires = Array.isArray(ligne.emails_destinataires) ? ligne.emails_destinataires.filter((e): e is string => typeof e === 'string') : []
  const cabinet = ligne.cabinet_id ? contexte.cabinets.get(ligne.cabinet_id) ?? null : null
  const createur = ligne.cree_par_gestionnaire_id
  const creePar: CreateurCoproprieteQr = createur
    ? { gestionnaireId: createur, nom: contexte.nomsFiches.get(createur) ?? null }
    : 'administrateur'
  return {
    ...gestionCoproprieteQrVide(),
    id: ligne.id,
    nom: chaine(ligne.nom),
    adresse,
    jeton: ligne.jeton,
    emailsDestinataires,
    actif: ligne.actif !== false,
    creeLe: chaine(ligne.created_at),
    nbSignalements: compteurs.total,
    nbEnAttente: compteurs.enAttente,
    // Une copropriété dont l'adresse est renseignée n'a rien à proposer.
    derniereAdresseProposee: adresse.trim() ? null : derniereAdresseProposee,
    cabinet,
    codePostal: chaine(ligne.code_postal),
    ville: chaine(ligne.ville),
    immatriculation: chaineOuNull(ligne.immatriculation),
    referenceCabinet: chaineOuNull(ligne.reference_cabinet),
    batiments: Array.isArray(ligne.batiments) ? ligne.batiments.filter((b): b is string => typeof b === 'string') : [],
    // « À tous » n'a de sens que dans un cabinet (contrainte de la migration).
    attribueeATous: ligne.attribuee_a_tous === true && cabinet !== null,
    gestionnaires: contexte.gestionnairesParCopro.get(ligne.id) ?? [],
    creePar,
    ouverts: compteurs.ouverts,
    urgentsOuverts: compteurs.urgentsOuverts,
    attente48h: compteurs.attente48h,
    dernier: compteurs.dernier,
    adressesDeGestionnaires: adressesDeFichesQr(emailsDestinataires, contexte.emailsFiches).length,
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

export type ControleAccesQr = { ok: true; user: User; profil: ProfilQr } | { ok: false; reponse: NextResponse }
export type ControleSuperAdmin = ControleAccesQr

/** Utilisateur de la requête : jeton Bearer quand l'appelant en donne un, sinon cookies de session (l'espace). */
async function utilisateurDeLaRequete(request: NextRequest): Promise<User | null> {
  const parJeton: User | null = await getAuthUser(request)
  if (parJeton) return parJeton
  try {
    const supabase = await createServerSupabaseClient()
    return (await supabase.auth.getUser()).data.user
  } catch (e) {
    logger.warn(`${CONTEXTE} session par cookies illisible`, { message: e instanceof Error ? e.message : String(e) })
    return null
  }
}

/**
 * Contrôle serveur de toute route non publique d'AJ Signalement (SPEC § 1.5) : 401 sans session ; profil super admin
 * par isSuperAdmin (rôle app_metadata ET e-mail de la liste ADMIN_EMAIL / ADMIN_EMAIL_2 : la « vue en tant que » et la
 * liste vide ne passent pas, alignement #650) ; profil non admis par la route → 403 interdit. PR 2 : profil
 * gestionnaire (rôle gestionnaire_signalement, fiche relue en base par user_id à chaque appel).
 */
export async function controlerAccesQr(request: NextRequest, options: { profils: readonly TypeProfilQr[] }): Promise<ControleAccesQr> {
  const user = await utilisateurDeLaRequete(request)
  if (!user) return { ok: false, reponse: reponseErreur('non_authentifie', 401) }
  const profil: ProfilQr | null = isSuperAdmin(user) ? { type: 'super_admin', userId: user.id } : null
  if (!profil || !options.profils.includes(profil.type)) return { ok: false, reponse: reponseErreur('interdit', 403) }
  return { ok: true, user, profil }
}

/** Alias le temps de la PR : super admin seul (même règle que controlerAccesQr). */
export const controlerSuperAdmin = (request: NextRequest): Promise<ControleAccesQr> => controlerAccesQr(request, { profils: ['super_admin'] })

// ── Journal (traçabilité, sans donnée personnelle) ───────────────────────────

export interface EcritureJournalQr {
  action: string
  cabinetId?: string | null
  acteurId?: string | null
  profil?: 'super_admin' | 'gestionnaire' | 'systeme'
  coproprieteId?: string | null
  gestionnaireId?: string | null
  signalementId?: string | null
  /** NOMS des champs, jamais leurs valeurs. */
  champs?: readonly string[]
  /** Énumérations, identifiants et nombres seulement (exception : nom d'une copropriété supprimée). */
  details?: Record<string, unknown>
}

/** Écrit une ligne du journal ; ne lève jamais (table absente : repli journalisé une fois ; sinon avertissement). */
export async function journaliserQr(e: EcritureJournalQr): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from(TABLE_JOURNAL_QR).insert({
      action: e.action,
      cabinet_id: e.cabinetId ?? null,
      acteur_id: e.acteurId ?? null,
      acteur_profil: e.profil ?? 'super_admin',
      copropriete_id: e.coproprieteId ?? null,
      gestionnaire_id: e.gestionnaireId ?? null,
      signalement_id: e.signalementId ?? null,
      champs: [...(e.champs ?? [])],
      details: e.details ?? {},
    })
    if (!error) return true
    if (structureAbsenteQr(error)) journaliserRepliGestionQr('journal', error)
    else logger.warn(`${CONTEXTE} ligne de journal non écrite`, { code: error.code, action: e.action })
    return false
  } catch (err) {
    logger.warn(`${CONTEXTE} ligne de journal non écrite (exception)`, { action: e.action, message: err instanceof Error ? err.name : 'inconnue' })
    return false
  }
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

export type LecturePagePubliqueQr =
  | { ok: true; copropriete: LigneCoproprieteQr | null; cabinet: LigneCabinetQr | null }
  | { ok: false; code: 'base_absente' | 'serveur' }

/**
 * Pages publiques du QR code (chemin d'un cabinet, ancienne adresse) : la copropriété active du jeton et son cabinet
 * (id, nom, identifiant du chemin, langue) ; null et null si le jeton est inconnu, mal formé ou désactivé. Deux lectures
 * simples plutôt qu'un embarqué PostgREST. Colonne cabinet_id absente (migration du 11/11/2026 non appliquée) : relue
 * comme avant, cabinet null — la page du chemin client répond alors 404 et l'ancienne adresse sert comme aujourd'hui.
 */
export async function lireCoproprieteEtCabinetParJetonQr(jeton: string): Promise<LecturePagePubliqueQr> {
  if (!JETON_QR.test(jeton)) return { ok: true, copropriete: null, cabinet: null }
  const { data, error } = await supabaseAdmin
    .from(TABLE_COPROPRIETES_QR)
    .select(`${COLONNES_COPROPRIETE_QR}, cabinet_id`)
    .eq('jeton', jeton)
    .eq('actif', true)
    .maybeSingle()
  if (error) {
    if (!colonneInconnue(error)) {
      logger.error(`${CONTEXTE} lecture de la copropriété et de son cabinet par jeton`, { code: error.code })
      return { ok: false, code: baseAbsente(error) ? 'base_absente' : 'serveur' }
    }
    journaliserRepliGestionQr('lecture de la page publique', error)
    const lecture = await lireCoproprieteParJeton(jeton)
    return lecture.ok ? { ok: true, copropriete: lecture.copropriete, cabinet: null } : lecture
  }
  const copropriete = (data as LigneCoproprieteQr | null) ?? null
  if (!copropriete?.cabinet_id) return { ok: true, copropriete, cabinet: null }
  const cabinet = await lireCabinetQr({ id: copropriete.cabinet_id })
  if (!cabinet.ok) {
    logger.error(`${CONTEXTE} lecture du cabinet d’une copropriété`, { code: cabinet.erreur.code, copropriete: copropriete.id })
    return { ok: false, code: 'serveur' }
  }
  return { ok: true, copropriete, cabinet: cabinet.cabinet }
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

type FiltreCoproprietesQr = { id?: string; cabinet?: string | null }

/**
 * Copropriétés avec les colonnes du 11/11/2026 ; colonnes absentes (42703) : relecture avec les colonnes d'origine
 * (repli journalisé une fois) — aucune copropriété n'appartient alors à un cabinet. Tri par date de création.
 */
export async function lireLignesCoproprietesQr(filtre: FiltreCoproprietesQr = {}): Promise<{ ok: true; lignes: LigneCoproprieteQr[] } | { ok: false; erreur: ErreurBase }> {
  const lire = (colonnes: string, avecCabinet: boolean) => {
    let q = supabaseAdmin.from(TABLE_COPROPRIETES_QR).select(colonnes)
    if (filtre.id) q = q.eq('id', filtre.id)
    if (avecCabinet && filtre.cabinet !== undefined) q = filtre.cabinet === null ? q.is('cabinet_id', null) : q.eq('cabinet_id', filtre.cabinet)
    return q.order('created_at', { ascending: true })
  }
  let r = await lire(COLONNES_COPROPRIETE_ETENDUES_QR, true)
  if (colonneInconnue(r.error)) {
    journaliserRepliGestionQr('lecture des copropriétés', r.error)
    // Sans la colonne cabinet_id, aucune copropriété n'a de cabinet : le filtre d'un cabinet ne rend rien.
    if (filtre.cabinet) return { ok: true, lignes: [] }
    r = await lire(COLONNES_COPROPRIETE_QR, false)
  }
  if (r.error) return { ok: false, erreur: r.error }
  return { ok: true, lignes: (r.data ?? []) as unknown as LigneCoproprieteQr[] }
}

/** Une copropriété par son id, avec les colonnes du 11/11/2026 si elles existent ; null si elle n'existe pas. */
export async function lireLigneCoproprieteQr(id: string): Promise<{ ok: true; ligne: LigneCoproprieteQr | null } | { ok: false; erreur: ErreurBase }> {
  const lire = (colonnes: string) => supabaseAdmin.from(TABLE_COPROPRIETES_QR).select(colonnes).eq('id', id).maybeSingle()
  let r = await lire(COLONNES_COPROPRIETE_ETENDUES_QR)
  if (colonneInconnue(r.error)) {
    journaliserRepliGestionQr('lecture d’une copropriété', r.error)
    r = await lire(COLONNES_COPROPRIETE_QR)
  }
  if (r.error) return { ok: false, erreur: r.error }
  return { ok: true, ligne: (r.data as unknown as LigneCoproprieteQr | null) ?? null }
}

/** Résultat d'une lecture : les lignes, ou l'erreur de la base (l'appelant choisit la réponse). */
export type LectureQr<T> = { ok: true; valeur: T } | { ok: false; erreur: ErreurBase }

type ReponseLectureQr = { data: unknown; error: ErreurBase | null }

/** PostgREST rend au plus 1 000 lignes par réponse (max-rows de Supabase) : au-delà, lecture page par page. */
export const PAGE_POSTGREST_QR = 1000

/**
 * Lots de valeurs pour un filtre `.in()` : adresse de la requête bornée (≈ 6 000 caractères de valeurs, 200 valeurs au
 * plus par lot), valeurs dédoublonnées.
 */
export function lotsPourFiltreQr(valeurs: readonly string[], maxCaracteres = 6000, maxValeurs = 200): string[][] {
  const lots: string[][] = []
  let lot: string[] = []
  let taille = 0
  for (const v of new Set(valeurs)) {
    if (lot.length > 0 && (lot.length >= maxValeurs || taille + v.length + 1 > maxCaracteres)) {
      lots.push(lot)
      lot = []
      taille = 0
    }
    lot.push(v)
    taille += v.length + 1
  }
  if (lot.length > 0) lots.push(lot)
  return lots
}

/**
 * Toutes les lignes qui correspondent aux valeurs (relecture 11, piège 4 de la SPEC : plus aucune lecture « tout » sans
 * filtre ni pagination) : un filtre `.in()` par lot, chaque lot lu par pages de 1 000 (la fabrique ORDONNE la requête,
 * pour des pages stables). Aucune valeur : aucune requête.
 */
export async function lireParValeursQr<T>(
  valeurs: readonly string[], fabrique: (lot: string[]) => { range: (de: number, a: number) => PromiseLike<ReponseLectureQr> },
): Promise<LectureQr<T[]>> {
  const lignes: T[] = []
  for (const lot of lotsPourFiltreQr(valeurs)) {
    const r = await lirePagesQr<T>(() => fabrique(lot))
    if (!r.ok) return r
    lignes.push(...r.valeur)
  }
  return { ok: true, valeur: lignes }
}

/**
 * Toutes les lignes d'une requête FILTRÉE (un groupe borné : les copropriétés d'un cabinet…), page par page : PostgREST
 * coupe sans erreur au-delà de 1 000 lignes (max-rows). La fabrique ORDONNE la requête, pour des pages stables.
 */
export async function lirePagesQr<T>(
  fabrique: () => { range: (de: number, a: number) => PromiseLike<ReponseLectureQr> },
): Promise<LectureQr<T[]>> {
  const lignes: T[] = []
  for (let de = 0; ; de += PAGE_POSTGREST_QR) {
    const { data, error } = await fabrique().range(de, de + PAGE_POSTGREST_QR - 1)
    if (error) return { ok: false, erreur: error }
    const page = (Array.isArray(data) ? data : []) as T[]
    lignes.push(...page)
    if (page.length < PAGE_POSTGREST_QR) return { ok: true, valeur: lignes }
  }
}

/**
 * Lecture d'une table du 11/11/2026 pour un CONTRÔLE fait avant une écriture (relecture 4) : seule une structure absente
 * (migration non appliquée) donne la liste vide du repli ; toute autre erreur (délai dépassé, réseau) est rendue, et la
 * route répond 500 avant d'écrire (jamais un contrôle sauté en silence).
 */
async function lireControleQr<T>(operation: string, lecture: PromiseLike<LectureQr<T[]>>): Promise<LectureQr<T[]>> {
  const r = await lecture
  if (r.ok || !structureAbsenteQr(r.erreur)) return r
  journaliserRepliGestionQr(operation, r.erreur)
  return { ok: true, valeur: [] }
}

/** Réponse brute d'une requête mise sous la forme d'une lecture. */
async function enLectureQr<T>(requete: PromiseLike<ReponseLectureQr>): Promise<LectureQr<T[]>> {
  const { data, error } = await requete
  return error ? { ok: false, erreur: error } : { ok: true, valeur: (Array.isArray(data) ? data : []) as T[] }
}

/** Lecture d'AFFICHAGE d'une table du 11/11/2026 : absente → liste vide (repli) ; autre erreur → liste vide, journalisée. */
async function lireOuVideQr<T>(operation: string, lecture: PromiseLike<LectureQr<T[]>>): Promise<T[]> {
  const r = await lireControleQr<T>(operation, lecture)
  if (r.ok) return r.valeur
  logger.error(`${CONTEXTE} ${operation} : lecture impossible`, { code: r.erreur.code })
  return []
}

interface LigneCabinetResumeQr { id: string; nom: string | null; identifiant: string | null }
interface LigneFicheContexteQr { id: string; nom: string | null; email: string | null }
interface LigneAttributionContexteQr { copropriete_id: string; gestionnaire_id: string }

export const cabinetResumeDepuisLigneQr = (l: LigneCabinetResumeQr): CabinetResumeQr => ({ id: l.id, nom: chaine(l.nom), identifiant: chaine(l.identifiant) })

/**
 * Cabinets, gestionnaires et attributions des copropriétés AFFICHÉES (tables du 11/11/2026, vides sans elles) : les
 * attributions de ces copropriétés, les fiches qu'elles nomment (gestionnaires, créateurs) et celles dont l'adresse est
 * dans leurs saisies (compteur RG-06 bis-5) ; jamais toutes les lignes de tous les cabinets (relecture 11).
 */
export async function lireContexteGestionQr(copros: ReadonlyArray<Pick<LigneCoproprieteQr, 'id' | 'cree_par_gestionnaire_id' | 'emails_destinataires'>>): Promise<ContexteGestionQr> {
  const ids = copros.map((c) => c.id)
  const saisies = copros.flatMap((c) => (Array.isArray(c.emails_destinataires) ? c.emails_destinataires : []))
    .map(emailCanoniqueQr).filter((e): e is string => e !== null)
  const [cabinets, attributions, fichesSaisies] = await Promise.all([
    lireOuVideQr<LigneCabinetResumeQr>('lecture des cabinets', enLectureQr(supabaseAdmin.from(TABLE_CABINETS_QR).select('id, nom, identifiant'))),
    lireOuVideQr<LigneAttributionContexteQr>('lecture des attributions', lireParValeursQr<LigneAttributionContexteQr>(ids, (lot) =>
      supabaseAdmin.from(TABLE_ATTRIBUTIONS_QR).select('copropriete_id, gestionnaire_id').in('copropriete_id', lot)
        .order('copropriete_id', { ascending: true }).order('gestionnaire_id', { ascending: true }))),
    lireOuVideQr<LigneFicheContexteQr>('lecture des gestionnaires', lireParValeursQr<LigneFicheContexteQr>(saisies, (lot) =>
      supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select('id, nom, email').in('email', lot).order('id', { ascending: true }))),
  ])
  const nommees = [...new Set([
    ...attributions.map((a) => a.gestionnaire_id),
    ...copros.map((c) => c.cree_par_gestionnaire_id).filter((g): g is string => typeof g === 'string' && g !== ''),
  ])]
  const fiches = await lireOuVideQr<LigneFicheContexteQr>('lecture des gestionnaires', lireParValeursQr<LigneFicheContexteQr>(nommees, (lot) =>
    supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select('id, nom, email').in('id', lot).order('id', { ascending: true })))
  const nomsFiches = new Map(fiches.map((f) => [f.id, f.nom ?? null]))
  const gestionnairesParCopro = new Map<string, GestionnaireResumeQr[]>()
  for (const a of attributions) {
    if (!nomsFiches.has(a.gestionnaire_id)) continue
    const liste = gestionnairesParCopro.get(a.copropriete_id) ?? []
    liste.push({ id: a.gestionnaire_id, nom: nomsFiches.get(a.gestionnaire_id) ?? null })
    gestionnairesParCopro.set(a.copropriete_id, liste)
  }
  return {
    cabinets: new Map(cabinets.map((c) => [c.id, cabinetResumeDepuisLigneQr(c)])),
    gestionnairesParCopro,
    nomsFiches,
    emailsFiches: fichesSaisies.map((f) => ({ email: f.email })),
  }
}

interface LigneCompteursQr {
  copropriete_id: string
  total: number | string
  en_attente: number | string
  ouverts: number | string
  urgents_ouverts: number | string
  attente_48h: number | string
  dernier: string | null
}

const nombre = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Compteurs par copropriété calculés en base (signalements_qr_compteurs : une réponse PostgREST est bornée à 1 000
 * lignes) ; null si la fonction manque ou échoue (l'appelant les calcule alors sur les signalements lus).
 */
export async function compteursQr(ids: readonly string[]): Promise<Map<string, CompteursCoproprieteQr> | null> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabaseAdmin.rpc('signalements_qr_compteurs', { p_ids: [...ids] })
  if (error) {
    if (structureAbsenteQr(error)) journaliserRepliGestionQr('compteurs', error)
    else logger.error(`${CONTEXTE} compteurs non calculés`, { code: error.code })
    return null
  }
  const lignes = (Array.isArray(data) ? data : []) as LigneCompteursQr[]
  return new Map(lignes.map((l) => [l.copropriete_id, {
    total: nombre(l.total), enAttente: nombre(l.en_attente), ouverts: nombre(l.ouverts), urgentsOuverts: nombre(l.urgents_ouverts),
    attente48h: nombre(l.attente_48h), dernier: l.dernier ?? null,
  }]))
}

const QUARANTE_HUIT_HEURES_MS = 48 * 60 * 60 * 1000

/** Compteurs calculés sur des signalements lus (repli, ou copropriété seule). */
export function compteursDepuisSignalementsQr(
  lignes: ReadonlyArray<Pick<LigneSignalementQr, 'copropriete_id' | 'statut' | 'priorite' | 'created_at'>>, maintenant = Date.now(),
): Map<string, CompteursCoproprieteQr> {
  const compteurs = new Map<string, CompteursCoproprieteQr>()
  for (const s of lignes) {
    const c = compteurs.get(s.copropriete_id) ?? compteursVidesQr()
    const statut = statutValide(s.statut)
    const ouvert = (STATUTS_OUVERTS_QR as readonly string[]).includes(statut)
    c.total += 1
    if (statut === 'en_attente') c.enAttente += 1
    if (ouvert) c.ouverts += 1
    if (ouvert && prioriteValide(s.priorite) === 'urgente') c.urgentsOuverts += 1
    const cree = Date.parse(chaine(s.created_at))
    if (statut === 'en_attente' && Number.isFinite(cree) && maintenant - cree > QUARANTE_HUIT_HEURES_MS) c.attente48h += 1
    if (s.created_at && (!c.dernier || s.created_at > c.dernier)) c.dernier = s.created_at
    compteurs.set(s.copropriete_id, c)
  }
  return compteurs
}

export type LectureTableauQr = { ok: true; tableau: TableauQr } | { ok: false; code: 'base_absente' | 'serveur' | 'introuvable' }

const lireSignalementsTableau = (colonnes: string, ids: readonly string[] | null, limite: number) => {
  let q = supabaseAdmin.from(TABLE_SIGNALEMENTS_QR).select(colonnes)
  if (ids) q = q.in('copropriete_id', [...ids])
  return q.order('created_at', { ascending: false }).limit(limite)
}

/** Copropriété → adresse proposée la plus récente (les signalements arrivent du plus récent au plus ancien). */
function dernieresAdressesProposees(lignes: readonly LigneSignalementQr[]): Map<string, AdresseProposeeQr> {
  const dernieres = new Map<string, AdresseProposeeQr>()
  for (const s of lignes) {
    const adresse = chaine(s.adresse_proposee).trim()
    if (adresse && !dernieres.has(s.copropriete_id)) dernieres.set(s.copropriete_id, { adresse, le: chaine(s.created_at) })
  }
  return dernieres
}

interface LigneFicheSuiviQr { id: string; cabinet_id: string; nom: string | null; actif: boolean | null }

/**
 * Page de suivi d'un gestionnaire vue par le super admin (?gestionnaire=) : sa fiche et les identifiants de sa portée
 * (attributions explicites ∪ « à tous » de SON cabinet ; fiche désactivée → rien). null : fiche inconnue.
 */
async function porteeSuiviQr(gestionnaireId: string, coproprietes: readonly LigneCoproprieteQr[]): Promise<
  { ok: true; fiche: LigneFicheSuiviQr | null; visibles: ReadonlySet<string> } | { ok: false; erreur: ErreurBase }
> {
  const fiche = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select('id, cabinet_id, nom, actif').eq('id', gestionnaireId).maybeSingle()
  if (fiche.error) return { ok: false, erreur: fiche.error }
  const ligne = (fiche.data as LigneFicheSuiviQr | null) ?? null
  if (!ligne) return { ok: true, fiche: null, visibles: new Set() }
  const attributions = await supabaseAdmin.from(TABLE_ATTRIBUTIONS_QR).select('copropriete_id').eq('gestionnaire_id', gestionnaireId)
  if (attributions.error) return { ok: false, erreur: attributions.error }
  const portee = porteeGestionnaireQr(
    { id: ligne.id, cabinetId: ligne.cabinet_id, actif: ligne.actif === true },
    coproprietes.map((c) => ({ id: c.id, cabinetId: c.cabinet_id ?? null, attribueeATous: c.attribuee_a_tous === true })),
    new Set(((attributions.data ?? []) as Array<{ copropriete_id: string }>).map((a) => a.copropriete_id)),
  )
  return { ok: true, fiche: ligne, visibles: portee.visibles }
}

/**
 * Tableau de bord : copropriétés (compteurs, champs de gestion et, sans adresse, la dernière adresse proposée) et
 * signalements les plus récents. Options (P1-R1) : `cabinet` (ses copropriétés), `gestionnaire` (sa page de suivi : sa
 * portée, 100 signalements au plus). Colonne inconnue (migrations du 06/11/2026) : relecture par select('*').
 */
export async function lireTableauQr(options: { cabinet?: string; gestionnaire?: string } = {}): Promise<LectureTableauQr> {
  const copros = await lireLignesCoproprietesQr(options.cabinet ? { cabinet: options.cabinet } : {})
  if (!copros.ok) {
    logger.error(`${CONTEXTE} lecture des copropriétés`, { code: copros.erreur.code, message: copros.erreur.message })
    return { ok: false, code: tableAbsenteQr(copros.erreur) ? 'base_absente' : 'serveur' }
  }
  let lignesCopros = copros.lignes
  let suivi: GestionnaireSuiviQr | undefined
  if (options.gestionnaire) {
    const portee = await porteeSuiviQr(options.gestionnaire, lignesCopros)
    if (!portee.ok) {
      if (structureAbsenteQr(portee.erreur)) return { ok: false, code: 'base_absente' }
      logger.error(`${CONTEXTE} lecture de la portée d'un gestionnaire`, { code: portee.erreur.code, gestionnaire: options.gestionnaire })
      return { ok: false, code: 'serveur' }
    }
    if (!portee.fiche) return { ok: false, code: 'introuvable' }
    lignesCopros = lignesCopros.filter((c) => portee.visibles.has(c.id))
    suivi = { id: portee.fiche.id, nom: portee.fiche.nom ?? null, actif: portee.fiche.actif === true, cabinet: { id: portee.fiche.cabinet_id, nom: '', identifiant: '' } }
  }
  const filtre = options.cabinet || options.gestionnaire ? lignesCopros.map((c) => c.id) : null
  const limite = options.gestionnaire ? SIGNALEMENTS_SUIVI_MAX : SIGNALEMENTS_MAX
  let lignesSignalements: LigneSignalementQr[] = []
  if (!filtre || filtre.length > 0) {
    let signalements = await lireSignalementsTableau(COLONNES_SIGNALEMENT_QR, filtre, limite)
    if (colonneInconnue(signalements.error)) {
      journaliserRepliColonnesSignalementQr('lecture du tableau', signalements.error)
      signalements = await lireSignalementsTableau('*', filtre, limite)
    }
    if (signalements.error) {
      logger.error(`${CONTEXTE} lecture des signalements`, { code: signalements.error.code, message: signalements.error.message })
      return { ok: false, code: baseAbsente(signalements.error) ? 'base_absente' : 'serveur' }
    }
    lignesSignalements = (signalements.data ?? []) as unknown as LigneSignalementQr[]
  }
  const [enBase, contexte] = await Promise.all([compteursQr(lignesCopros.map((c) => c.id)), lireContexteGestionQr(lignesCopros)])
  const compteurs = enBase ?? compteursDepuisSignalementsQr(lignesSignalements)
  const noms = new Map(lignesCopros.map((c) => [c.id, chaine(c.nom)]))
  const dernieres = dernieresAdressesProposees(lignesSignalements)
  if (suivi) suivi.cabinet = contexte.cabinets.get(suivi.cabinet.id) ?? suivi.cabinet
  const tableau: TableauQr = {
    coproprietes: lignesCopros.map((c) => coproprieteDepuisLigne(c, compteurs.get(c.id) ?? compteursVidesQr(), dernieres.get(c.id) ?? null, contexte)),
    signalements: lignesSignalements.map((s) => signalementDepuisLigne(s, noms.get(s.copropriete_id) ?? '')),
  }
  if (suivi) tableau.gestionnaire = suivi
  return { ok: true, tableau }
}

export type LectureCoproprieteCompleteQr = { ok: true; copropriete: CoproprieteQr | null } | { ok: false; erreur: ErreurBase }

/**
 * Une copropriété sous sa forme publique complète (réponse d'une création ou d'une modification). `nouvelle` : aucun
 * signalement à compter (création).
 */
export async function lireCoproprieteCompleteQr(id: string, options: { nouvelle?: boolean } = {}): Promise<LectureCoproprieteCompleteQr> {
  const lecture = await lireLigneCoproprieteQr(id)
  if (!lecture.ok) return { ok: false, erreur: lecture.erreur }
  const ligne = lecture.ligne
  if (!ligne) return { ok: true, copropriete: null }
  const [compteurs, contexte] = await Promise.all([
    options.nouvelle ? Promise.resolve(compteursVidesQr()) : compterSignalementsQr(id),
    lireContexteGestionQr([ligne]),
  ])
  return { ok: true, copropriete: coproprieteDepuisLigne(ligne, compteurs, null, contexte) }
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

// ── Cabinets, fiches, doublons (lectures des routes d'administration) ────────

export interface LigneCabinetQr {
  id: string
  nom: string | null
  identifiant: string | null
  langue: string | null
}

export type LectureCabinetQr = { ok: true; cabinet: LigneCabinetQr | null } | { ok: false; erreur: ErreurBase }

const langueCabinet = (v: unknown): LangueCabinetQr => (v === 'pt' ? 'pt' : 'fr')
export const langueCabinetQr = langueCabinet

/** Un cabinet par son id ou par l'identifiant de son chemin public. */
export async function lireCabinetQr(cle: { id: string } | { identifiant: string }): Promise<LectureCabinetQr> {
  const q = supabaseAdmin.from(TABLE_CABINETS_QR).select('id, nom, identifiant, langue')
  const { data, error } = await ('id' in cle ? q.eq('id', cle.id) : q.eq('identifiant', cle.identifiant)).maybeSingle()
  if (error) return { ok: false, erreur: error }
  return { ok: true, cabinet: (data as LigneCabinetQr | null) ?? null }
}

/** Cabinet par l'identifiant du chemin (page publique, confirmation d'adresse) ; null s'il n'existe pas. */
export const lireCabinetParIdentifiantQr = (identifiant: string): Promise<LectureCabinetQr> => lireCabinetQr({ identifiant })

/**
 * Domaines e-mail d'un cabinet, lus pour un contrôle avant écriture : table absente → liste réputée vide (comme avant
 * la migration) ; toute autre erreur est rendue (la route répond 500 sans rien écrire, relecture 4).
 */
export async function lireDomainesCabinetQr(cabinetId: string): Promise<LectureQr<string[]>> {
  const r = await lireControleQr<{ domaine: string }>('lecture des domaines',
    enLectureQr(supabaseAdmin.from(TABLE_DOMAINES_QR).select('domaine').eq('cabinet_id', cabinetId)))
  return r.ok ? { ok: true, valeur: r.valeur.map((l) => l.domaine) } : r
}

/**
 * Parmi `domaines`, ceux déclarés par un AUTRE cabinet client (relecture 2 : une fiche n'est jamais créée sur le domaine
 * d'un autre client, même forcée). Même règle d'erreur que lireDomainesCabinetQr ; aucune valeur : aucune requête.
 */
export async function lireDomainesAutresCabinetsQr(cabinetId: string, domaines: readonly string[]): Promise<LectureQr<string[]>> {
  const r = await lireControleQr<{ domaine: string }>('lecture des domaines des autres cabinets', lireParValeursQr<{ domaine: string }>(
    domaines.map((d) => d.trim().toLowerCase()).filter(Boolean),
    (lot) => supabaseAdmin.from(TABLE_DOMAINES_QR).select('domaine').in('domaine', lot).neq('cabinet_id', cabinetId).order('domaine', { ascending: true }),
  ))
  return r.ok ? { ok: true, valeur: [...new Set(r.valeur.map((l) => l.domaine))] } : r
}

/**
 * Fiches gestionnaires, actives ou non, de tout cabinet, dont l'adresse est parmi `emails` (RG-06 bis-1) : seules les
 * adresses proposées sont cherchées, jamais toutes les fiches (relecture 11). Table absente : aucune ; autre erreur
 * rendue (contrôle avant écriture, relecture 4).
 */
export async function lireFichesParEmailsQr(emails: readonly string[]): Promise<LectureQr<Array<{ id: string; email: string | null }>>> {
  return lireControleQr<{ id: string; email: string | null }>('lecture des fiches', lireParValeursQr<{ id: string; email: string | null }>(
    emails.map(emailCanoniqueQr).filter((e): e is string => e !== null),
    (lot) => supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select('id, email').in('email', lot).order('id', { ascending: true }),
  ))
}

interface LigneDoublonQr {
  id: string
  nom: string | null
  adresse: string | null
  code_postal?: string | null
  ville?: string | null
  immatriculation?: string | null
  reference_cabinet?: string | null
  operation_id?: string | null
}

/**
 * Copropriétés du même groupe (cabinet, ou « sans cabinet »), actives ou non, pour le pré-contrôle des doublons
 * (SPEC § 1.6 ; la clé du nom est recalculée : cle_nom est NULL pour les lignes antérieures). Colonnes absentes :
 * toutes les copropriétés forment le groupe « sans cabinet » (nom et adresse seulement). `ignorerOperation` : la
 * copropriété déjà créée par ce même lot (nouvel essai d'un double clic) n'est pas son propre doublon. `ids` : seulement
 * ces copropriétés du groupe (rattachement : celles demandées). Tout le groupe est lu, par pages de 1 000 (essai PGlite
 * du 11/11, D5 : au-delà de max-rows, PostgREST coupait sans erreur et des doublons passaient sans contrôle).
 */
export async function lireCoproprietesDoublonsQr(
  cabinetId: string | null, options: { ignorerOperation?: string; ids?: readonly string[] } = {},
): Promise<{ ok: true; coproprietes: CoproprieteDoublonQr[] } | { ok: false; erreur: ErreurBase }> {
  const { ids } = options
  // Requête ordonnée (pages stables), filtrée sur le groupe ; `groupe` faux : colonnes absentes, toutes « sans cabinet ».
  const requete = (colonnes: string, groupe: boolean, lot?: string[]) => {
    const base = supabaseAdmin.from(TABLE_COPROPRIETES_QR).select(colonnes)
    const parIds = lot ? base.in('id', lot) : base
    const filtree = !groupe ? parIds : cabinetId === null ? parIds.is('cabinet_id', null) : parIds.eq('cabinet_id', cabinetId)
    return filtree.order('id', { ascending: true })
  }
  const lire = (colonnes: string, groupe: boolean) => (ids
    ? lireParValeursQr<LigneDoublonQr>(ids, (lot) => requete(colonnes, groupe, lot))
    : lirePagesQr<LigneDoublonQr>(() => requete(colonnes, groupe)))
  let r = await lire('id, nom, adresse, code_postal, ville, immatriculation, reference_cabinet, operation_id', true)
  if (!r.ok && colonneInconnue(r.erreur)) {
    journaliserRepliGestionQr('lecture des doublons', r.erreur)
    if (cabinetId !== null) return { ok: true, coproprietes: [] }
    r = await lire('id, nom, adresse', false)
  }
  if (!r.ok) return { ok: false, erreur: r.erreur }
  const lignes = r.valeur.filter((l) => !options.ignorerOperation || l.operation_id !== options.ignorerOperation)
  return {
    ok: true,
    coproprietes: lignes.map((l) => ({
      id: l.id, nom: chaine(l.nom), adresse: chaine(l.adresse), codePostal: chaine(l.code_postal), ville: chaine(l.ville),
      immatriculation: chaineOuNull(l.immatriculation), referenceCabinet: chaineOuNull(l.reference_cabinet),
    })),
  }
}

/**
 * Cabinet d'une copropriété (journal) ; null si elle n'en a pas ou si la colonne manque (migration du 11/11/2026 non
 * appliquée : repli journalisé une fois). Ne lève pas.
 */
export async function cabinetDeCoproprieteQr(coproprieteId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from(TABLE_COPROPRIETES_QR).select('cabinet_id').eq('id', coproprieteId).maybeSingle()
  if (error) {
    if (structureAbsenteQr(error)) journaliserRepliGestionQr('cabinet de la copropriété', error)
    else logger.warn(`${CONTEXTE} cabinet de la copropriété non lu`, { code: error.code, copropriete: coproprieteId })
    return null
  }
  const id = (data as { cabinet_id?: unknown } | null)?.cabinet_id
  return typeof id === 'string' ? id : null
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
  const { data, error } = await supabaseAdmin.from(TABLE_SIGNALEMENTS_QR).select('statut, priorite, created_at').eq('copropriete_id', coproprieteId)
  if (error) {
    logger.warn(`${CONTEXTE} compteurs non lus`, { code: error.code, message: error.message })
    return compteursVidesQr()
  }
  const lignes = ((data ?? []) as Array<{ statut: string | null; priorite: string | null; created_at: string | null }>)
    .map((l) => ({ ...l, copropriete_id: coproprieteId }))
  return compteursDepuisSignalementsQr(lignes).get(coproprieteId) ?? compteursVidesQr()
}

// ── Destinataires et budget d'un dépôt ───────────────────────────────────────

/**
 * Destinataires de l'e-mail : ceux de la copropriété, sinon l'administrateur du déploiement (ADMIN_EMAIL, ADMIN_EMAIL_2).
 * Calcul de destinatairesSignalementQr sans gestionnaire (règle d'avant le 11/11/2026, gardée pour ses tests).
 */
export function destinatairesSignalement(
  copropriete: { emails_destinataires?: string[] | null },
  env: Record<string, string | undefined> = process.env,
): string[] {
  return destinatairesSignalementQr(copropriete, [], env).destinataires.map((d) => d.email)
}

interface LigneEmailGestionnaireSqlQr { gestionnaire_id: string; email: string | null; acces_ouvert: boolean | null; exclu: boolean | null }

/**
 * Gestionnaires destinataires d'un dépôt (signalements_qr_emails_gestionnaires) : fiches actives à adresse confirmée de
 * la copropriété (ou de tout son cabinet si « à tous »), et fiches inactives ou contestées restées dans les saisies
 * (exclu). En cas d'erreur (fonction absente, base indisponible) : aucune ligne, journalisé — le dépôt reste acquis.
 */
export async function lireGestionnairesDestinatairesQr(coproprieteId: string): Promise<LigneEmailGestionnaireQr[]> {
  try {
    const { data, error } = await supabaseAdmin.rpc('signalements_qr_emails_gestionnaires', { p_copropriete: coproprieteId })
    if (error) {
      if (structureAbsenteQr(error)) journaliserRepliGestionQr('destinataires gestionnaires', error)
      else logger.error(`${CONTEXTE} gestionnaires destinataires non lus`, { code: error.code, copropriete: coproprieteId })
      return []
    }
    return ((Array.isArray(data) ? data : []) as LigneEmailGestionnaireSqlQr[])
      .filter((l) => typeof l.email === 'string')
      .map((l) => ({ gestionnaireId: l.gestionnaire_id, email: l.email as string, accesOuvert: l.acces_ouvert === true, exclu: l.exclu === true }))
  } catch (e) {
    logger.error(`${CONTEXTE} gestionnaires destinataires non lus (exception)`, { copropriete: coproprieteId, message: e instanceof Error ? e.name : 'inconnue' })
    return []
  }
}

/**
 * Réservation du budget d'e-mails d'un dépôt (RG-06 ter), en base sous le verrou du cabinet. null : fonction ou
 * colonnes absentes (migration non appliquée) ou erreur — envoi sans budget, comme avant, journalisé.
 */
export async function reserverEmailsQr(signalementId: string, messages: number): Promise<ReservationEmailsQr | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('signalements_qr_reserver_emails', {
      p_signalement: signalementId, p_nombre: messages, p_max_copro: BUDGET_EMAILS_COPRO_HEURE, p_max_cabinet: BUDGET_EMAILS_CABINET_HEURE,
    })
    if (error) {
      if (structureAbsenteQr(error)) journaliserRepliGestionQr('budget d’e-mails', error)
      else logger.error(`${CONTEXTE} budget d’e-mails non réservé : envoi sans budget`, { code: error.code, signalement: signalementId })
      return null
    }
    const r = (data ?? {}) as { accorde?: unknown; retenus?: unknown }
    return { accorde: r.accorde === true, retenus: nombre(r.retenus) }
  } catch (e) {
    logger.error(`${CONTEXTE} budget d’e-mails non réservé (exception) : envoi sans budget`, { signalement: signalementId, message: e instanceof Error ? e.name : 'inconnue' })
    return null
  }
}

/** Après l'envoi : nb_emails_envoyes ramené au nombre de messages réellement acceptés. Ne lève pas. */
export async function corrigerEmailsEnvoyesQr(signalementId: string, envoyes: number): Promise<void> {
  const { error } = await supabaseAdmin.from(TABLE_SIGNALEMENTS_QR).update({ nb_emails_envoyes: envoyes }).eq('id', signalementId)
  if (error) logger.warn(`${CONTEXTE} nombre d’e-mails envoyés non corrigé`, { code: error.code, signalement: signalementId })
}

// ── Jetons et identifiants ───────────────────────────────────────────────────

/** Nouveau jeton de QR code : UUID aléatoire sans tirets (32 hexadécimaux, 122 bits d'aléa). */
export const genererJetonQr = (): string => globalThis.crypto.randomUUID().replace(/-/g, '')

/** Identifiant de ligne (UUID) lu dans l'adresse d'une route. */
export const estUuid = (valeur: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valeur)

