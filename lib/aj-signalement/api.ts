// ── Appels du navigateur vers /api/aj-signalement/* ───────────────────────────
//
// Module sans React ; fetch injectable pour les tests. Aucune fonction ne lève : chaque résultat
// porte `ok` et, en cas d'échec, un code que les écrans traduisent en message.
//   - envoyerSignalementQr, proposerAdresseQr, chargerSemblablesQr : page publique ouverte par le QR code, sans
//     session (dépôt, adresse proposée d'après la position, signalements déjà faits au même endroit) ;
//   - lireLienConfirmationQr, confirmerAdresseQr, contesterAdresseQr : page publique de confirmation d'adresse d'un
//     gestionnaire (vitfix.io/<identifiant>/confirmation-adresse/#<jeton>) : le jeton part dans le CORPS, jamais dans
//     l'adresse ; lireLienAccesQr, accepterAccesQr, contesterAccesQr : page publique d'ouverture de son accès
//     (vitfix.io/<identifiant>/invitation/#<jeton>, PR 2), même règle ;
//   - chargerMoiQr, creerCoproprieteGestionnaireQr, modifierCoproprieteGestionnaireQr (PR 2, lot 5) : espace d'un cabinet
//     (vitfix.io/<identifiant>/suivi/), gestionnaire connecté ; refus 403 lus depuis le corps (CODES_REFUS_QR) ;
//   - les autres : espace AJ Signalement (/fr/aj-signalement/, super admin). Le jeton Bearer est ajouté quand il est
//     connu ; sinon les cookies de session suffisent (credentials same-origin), ce que fait l'espace. Dont
//     verifierImportQr / creerImportQr (import d'un fichier, lot 5) : seules les lignes normalisées partent, jamais le
//     fichier ; un 409 a_reverifier porte les diagnostics à jour ;
//   - PR 3, lot 8 (diffusion de messages d'exploitation aux déclarants, cahier § 4.1) : chargerValeursDiffusionQr (D-R1),
//     apercuDiffusionQr (D-R2), diffuserMessageQr (D-R3, avec le libellé du périmètre CONFIRMÉ), reprendreDiffusionQr
//     (D-R4), chargerDiffusionsQr (D-R5), chargerDiffusionQr (D-R6), opposerDeclarantDiffusionQr (D-R7),
//     chargerReglagesDiffusionCabinetQr et reglerDiffusionCabinetQr (D-R8) ; super admin, et gestionnaire sur une
//     copropriété qui lui est attribuée nommément (D-R1 à D-R7, H11). Aucune adresse de déclarant ne passe par ces appels.
// Les codes 409 / 410 des routes (doublon, hors_domaine, identifiant_fige…) sont rendus tels quels (CODES_METIER_QR),
// avec leurs compléments utiles à l'écran (doublon, id de la fiche existante ; diffusion : motif d'un texte refusé, ce
// qui manque à l'activation, heure d'écriture d'un message à reprendre) ; jamais un texte du serveur.

import type { ModeleDiffusionQr } from '@/lib/aj-signalement/affichage-diffusion'
import type { ArretEnvoiDiffusionQr } from '@/lib/aj-signalement/diffusion-envoi'
import type {
  DetailDiffusionQr, ManqueActivationDiffusionQr, NombresDiffusionQr, PerimetreSaisiDiffusionQr, ReglagesDiffusionCabinetQr,
  ResumeDiffusionQr,
} from '@/lib/aj-signalement/diffusion-formes'
import type { ConseilTexteDiffusionQr, MotifRefusTexteDiffusionQr } from '@/lib/aj-signalement/diffusion-texte'
import type { BatimentCiblableQr, EtageCiblableQr } from '@/lib/aj-signalement/diffusion-valeurs'
import {
  NUMERO_QR, estStatutOuvertQr, gestionCoproprieteQrVide,
  type ActionImportQr, type CabinetQr, type CabinetResumeQr, type ChampImportQr, type CoproprieteQr, type DiagnosticLigneImportQr,
  type DoublonRenduGestionnaireQr, type DoublonRenduQr, type EtatLigneImportQr, type EvenementJournalQr, type FicheGestionnaireDetailQr,
  type FiltreJournalQr, type GestionnaireInconnuImportQr, type GestionnaireQr, type GestionnaireResumeQr, type LangueSignalementQr,
  type MessageImportQr, type ResultatImportQr, type SaisieCabinetQr, type SaisieImportQr,
  type SaisieCoproprieteQr, type SaisieGestionCoproprieteQr, type SaisieGestionnaireQr, type SaisieSignalementQr, type SignalementQr,
  type SignalementSemblableQr,
  type StatutSignalementQr, type SuccessionDepartQr, type SuitePageQr, type TableauQr, type VerificationImportQr,
} from '@/lib/aj-signalement/types'

export const URL_API_QR = '/api/aj-signalement'

/** Codes 409 / 410 des routes, rendus tels quels à l'écran (lib/aj-signalement/affichage.ts a un message pour chacun). */
export const CODES_METIER_QR = [
  'doublon', 'hors_domaine', 'existe_deja', 'identifiant_pris', 'identifiant_fige', 'domaine_pris', 'sans_cabinet', 'cabinet_fige',
  'a_reverifier', 'deja_confirmee', 'adresse_contestee', 'adresse_reservee', 'domaines_a_renseigner', 'fiche_active', 'fiche_effacee',
  'signalements_presents', 'conflit_statut', 'expire', 'domaine_autre_cabinet',
  // PR 2 (accès des gestionnaires) : accès déjà ouvert, adresse d'un compte d'un autre espace (jamais converti).
  'deja_ouvert', 'compte_autre_espace',
  // PR 3 (diffusion aux déclarants) : copropriété qui ne peut pas diffuser, personne dans le périmètre, nombre changé
  // depuis l'aperçu, reprise d'un message de plus d'une heure à confirmer (409), message non parti en 24 h (410) ;
  // activation du cabinet refusée (réglage manquant, langue non ouverte).
  'diffusion_inactive', 'aucun_destinataire', 'perimetre_change', 'a_confirmer', 'perime', 'cabinet_incomplet', 'langue_non_ouverte',
] as const
export type CodeMetierQr = (typeof CODES_METIER_QR)[number]

/**
 * PR 2, lot 5 : refus 403 d'un gestionnaire connecté, lus depuis le corps (sinon « interdit ») : accès retiré (fiche
 * désactivée, bloquée ou absente : relue à chaque appel), copropriété visible mais en lecture seule pour lui.
 */
export const CODES_REFUS_QR = ['acces_retire', 'lecture_seule'] as const
export type CodeRefusQr = (typeof CODES_REFUS_QR)[number]

/**
 * Codes d'échec : invalide (4xx), introuvable (404 : QR code inconnu ou désactivé), trop_de_demandes (429),
 * non_authentifie (401), interdit (403 : pas super admin), base_absente (503 : migration non appliquée),
 * serveur (5xx), reseau ; et les codes métier des 409 / 410 (CODES_METIER_QR). PR 3 : texte_refuse (400 : texte d'une
 * diffusion refusé par le contrôle, motif dans le corps), configuration_incomplete (503 : clé de signature des liens de
 * désinscription absente).
 */
export type CodeErreurQr =
  | 'invalide' | 'introuvable' | 'trop_de_demandes' | 'non_authentifie' | 'interdit' | 'base_absente' | 'serveur' | 'reseau'
  | 'texte_refuse' | 'configuration_incomplete'
  | CodeMetierQr | CodeRefusQr

/** Échec d'un appel : le code, et pour certains refus ce que l'écran en montre. */
export interface EchecQr {
  ok: false
  code: CodeErreurQr
  /** 409 doublon : la copropriété semblable. */
  doublon?: DoublonRenduQr
  /**
   * 409 doublon refusé à un gestionnaire (PR 2) : certitude et critère, et la copropriété existante seulement si elle
   * est dans sa portée (sinon elle n'est jamais nommée).
   */
  doublonCabinet?: DoublonRenduGestionnaireQr
  /** 409 existe_deja : la fiche qui porte déjà cette adresse. */
  id?: string
  /** 409 a_reverifier d'un import : les diagnostics à jour (l'existant a changé depuis la vérification). */
  verification?: VerificationImportQr
  /** PR 3 — 400 texte_refuse d'une diffusion : le champ refusé, le motif et, pour un nom de domaine, le conseil. */
  refusTexte?: RefusTexteDiffusionQr
  /** PR 3 — 409 cabinet_incomplet : ce qui manque à l'activation de la diffusion. */
  manque?: ManqueActivationDiffusionQr[]
  /** PR 3 — 409 a_confirmer : heure d'écriture du message dont l'envoi est à reprendre. */
  creeLe?: string
}

/** Champ d'une diffusion refusé par le contrôle du texte (route D-R2 ou D-R3). */
export type ChampRefusDiffusionQr = 'objet' | 'texte' | 'libelleBatimentSaisi' | 'libelleEtageSaisi'
export interface RefusTexteDiffusionQr {
  champ: ChampRefusDiffusionQr
  motif: MotifRefusTexteDiffusionQr
  conseil?: ConseilTexteDiffusionQr
}

export type ResultatEnvoiQr =
  | { ok: true; id: string; numero: string; creeLe: string; emailEnvoye: boolean; confirmationEnvoyee: boolean }
  | EchecQr
export type ResultatTableauQr = { ok: true; tableau: TableauQr } | EchecQr
export type ResultatCoproprieteQr = { ok: true; copropriete: CoproprieteQr } | EchecQr
export type ResultatStatutQr = { ok: true; statut: StatutSignalementQr; misAJourLe: string } | EchecQr
export type ResultatAdresseQr = { ok: true; adresse: string | null } | EchecQr
export type ResultatSemblablesQr = { ok: true; semblables: SignalementSemblableQr[] } | EchecQr
export type ResultatSimpleQr = { ok: true } | EchecQr

type Fetch = typeof fetch

const estCodeMetier = (v: unknown): v is CodeMetierQr => typeof v === 'string' && (CODES_METIER_QR as readonly string[]).includes(v)
const estCodeRefus = (v: unknown): v is CodeRefusQr => typeof v === 'string' && (CODES_REFUS_QR as readonly string[]).includes(v)

/** Code d'échec d'une réponse HTTP, d'après son statut et son champ `error`. */
export function codeDepuisReponseQr(status: number, corps: unknown): CodeErreurQr {
  const erreur = corps && typeof corps === 'object' ? (corps as { error?: unknown }).error : undefined
  if (erreur === 'base_absente') return 'base_absente'
  if (status === 503 && erreur === 'configuration_incomplete') return 'configuration_incomplete'
  if (status === 400 && erreur === 'texte_refuse') return 'texte_refuse'
  if ((status === 409 || status === 410) && estCodeMetier(erreur)) return erreur
  if (status === 410) return 'expire'
  if (status === 401) return 'non_authentifie'
  if (status === 403) return estCodeRefus(erreur) ? erreur : 'interdit'
  if (status === 404) return 'introuvable'
  if (status === 429) return 'trop_de_demandes'
  if (status >= 400 && status < 500) return 'invalide'
  return 'serveur'
}

function entetes(jeton: string | null | undefined, json: boolean): Record<string, string> {
  const e: Record<string, string> = {}
  if (json) e['Content-Type'] = 'application/json'
  if (jeton) e.Authorization = `Bearer ${jeton}`
  return e
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const chaine = (v: unknown): string => (typeof v === 'string' ? v : '')
const entier = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** Doublon d'une réponse 409, gardé seulement s'il a la forme attendue. */
function doublonDepuisCorps(v: unknown): DoublonRenduQr | null {
  if (!estObjet(v) || !estObjet(v.copropriete)) return null
  const c = v.copropriete
  if ((v.certitude !== 'certain' && v.certitude !== 'probable') || typeof v.critere !== 'string' || typeof c.id !== 'string') return null
  return { certitude: v.certitude, critere: v.critere as DoublonRenduQr['critere'], copropriete: { id: c.id, nom: chaine(c.nom), ville: chaine(c.ville) } }
}

/**
 * Doublon d'une réponse 409 faite à un gestionnaire (PR 2), sans la copropriété existante (hors de sa portée, elle n'est
 * jamais nommée) ; null si la forme est inconnue.
 */
function doublonSansCoproprieteDepuisCorps(v: unknown): DoublonRenduGestionnaireQr | null {
  if (!estObjet(v) || (v.certitude !== 'certain' && v.certitude !== 'probable') || typeof v.critere !== 'string') return null
  return { certitude: v.certitude, critere: v.critere as DoublonRenduGestionnaireQr['critere'] }
}

/** Échec d'une réponse : code, et compléments d'un 409 (doublon, fiche existante). */
function echecDepuisReponse(status: number, corps: unknown): EchecQr {
  const code = codeDepuisReponseQr(status, corps)
  const echec: EchecQr = { ok: false, code }
  if (code === 'doublon' && estObjet(corps)) {
    const doublon = doublonDepuisCorps(corps.doublon)
    if (doublon) echec.doublon = doublon
    // Réponse à un gestionnaire, copropriété hors de sa portée : certitude et critère seuls.
    const sansCopropriete = doublon ? null : doublonSansCoproprieteDepuisCorps(corps.doublon)
    if (sansCopropriete) echec.doublonCabinet = sansCopropriete
  }
  if (code === 'existe_deja' && estObjet(corps) && typeof corps.id === 'string') echec.id = corps.id
  if (code === 'a_reverifier') {
    const verification = verificationDepuisCorps(corps)
    if (verification) echec.verification = verification
  }
  if (code === 'texte_refuse') {
    const refus = refusTexteDepuisCorps(corps)
    if (refus) echec.refusTexte = refus
  }
  if (code === 'cabinet_incomplet' && estObjet(corps) && Array.isArray(corps.manque)) {
    echec.manque = corps.manque.filter((m): m is ManqueActivationDiffusionQr => (MANQUES_ACTIVATION_QR as readonly unknown[]).includes(m))
  }
  if (code === 'a_confirmer' && estObjet(corps) && typeof corps.creeLe === 'string') echec.creeLe = corps.creeLe
  return echec
}

const CHAMPS_REFUS_DIFFUSION_QR: readonly ChampRefusDiffusionQr[] = ['objet', 'texte', 'libelleBatimentSaisi', 'libelleEtageSaisi']
const MOTIFS_REFUS_DIFFUSION_QR: readonly MotifRefusTexteDiffusionQr[] = [
  'lien', 'adresse_email', 'caractere', 'a_completer', 'telephone', 'terme_commercial', 'longueur', 'lignes',
]
const MANQUES_ACTIVATION_QR: readonly ManqueActivationDiffusionQr[] = ['contact', 'politique', 'declaration_politique', 'contrat_reference', 'contrat_date']

/** Refus du texte d'une diffusion (400 texte_refuse) : gardé seulement si le champ et le motif sont connus. */
function refusTexteDepuisCorps(corps: unknown): RefusTexteDiffusionQr | null {
  if (!estObjet(corps)) return null
  const { champ, motif, conseil } = corps
  if (!(CHAMPS_REFUS_DIFFUSION_QR as readonly unknown[]).includes(champ) || !(MOTIFS_REFUS_DIFFUSION_QR as readonly unknown[]).includes(motif)) return null
  return {
    champ: champ as ChampRefusDiffusionQr, motif: motif as MotifRefusTexteDiffusionQr,
    ...(conseil === 'espace_apres_point' ? { conseil } : {}),
  }
}

async function appeler(fetchImpl: Fetch, url: string, init: RequestInit): Promise<{ ok: true; corps: unknown } | EchecQr> {
  let res: Response
  try {
    res = await fetchImpl(url, { cache: 'no-store', credentials: 'same-origin', ...init })
  } catch (e) {
    console.warn('[aj-signalement] appel impossible', e)
    return { ok: false, code: 'reseau' }
  }
  const corps: unknown = await res.json().catch(() => null)
  if (!res.ok) return echecDepuisReponse(res.status, corps)
  return { ok: true, corps }
}

/** Appel de l'espace (cookies de session), corps JSON facultatif. */
const appelerEspace = (fetchImpl: Fetch, url: string, methode: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', corps?: unknown) =>
  appeler(fetchImpl, url, corps === undefined
    ? { method: methode, headers: entetes(null, false) }
    : { method: methode, headers: entetes(null, true), body: JSON.stringify(corps) })

/** Paramètres de requête, sans les valeurs vides (dans l'ordre donné). */
function requete(parametres: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams()
  for (const [cle, valeur] of Object.entries(parametres)) {
    if (valeur !== undefined && valeur !== null && valeur !== '') p.set(cle, String(valeur))
  }
  const texte = p.toString()
  return texte ? `?${texte}` : ''
}

const segment = (id: string): string => encodeURIComponent(id)

// ── Page publique du QR code ─────────────────────────────────────────────────

/** Dépôt public d'un signalement (après scan du QR code). */
export async function envoyerSignalementQr(saisie: SaisieSignalementQr, fetchImpl: Fetch = fetch): Promise<ResultatEnvoiQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/signalements`, {
    method: 'POST', headers: entetes(null, true), body: JSON.stringify(saisie),
  })
  if (!r.ok) return r
  const s = (r.corps as { signalement?: Record<string, unknown> } | null)?.signalement
  if (!s || typeof s.id !== 'string') return { ok: false, code: 'serveur' }
  return {
    ok: true, id: s.id, numero: chaine(s.numero), creeLe: chaine(s.creeLe),
    emailEnvoye: s.emailEnvoye === true, confirmationEnvoyee: s.confirmationEnvoyee === true,
  }
}

/**
 * Adresse proposée d'après la position du navigateur (copropriété sans adresse). La position part dans le corps du
 * POST, jamais dans l'URL ; le serveur ne la conserve pas. adresse null : rien trouvé à cet endroit.
 */
export async function proposerAdresseQr(jeton: string, latitude: number, longitude: number, fetchImpl: Fetch = fetch): Promise<ResultatAdresseQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/adresse`, {
    method: 'POST', headers: entetes(null, true), body: JSON.stringify({ jeton, latitude, longitude }),
  })
  if (!r.ok) return r
  const adresse = (r.corps as { adresse?: unknown } | null)?.adresse
  return { ok: true, adresse: typeof adresse === 'string' && adresse.trim() ? adresse.trim() : null }
}

/** Jour d'une fiche semblable : AAAA-MM-JJ, jamais l'heure du dépôt. */
const JOUR_QR = /^\d{4}-\d{2}-\d{2}$/

/** Fiche reçue du serveur, gardée seulement si elle a la forme attendue (date = jour seul). */
function semblableDepuisCorps(valeur: unknown): SignalementSemblableQr | null {
  if (!valeur || typeof valeur !== 'object') return null
  const v = valeur as Record<string, unknown>
  if (typeof v.numero !== 'string' || !NUMERO_QR.test(v.numero) || !estStatutOuvertQr(v.statut)) return null
  if (typeof v.typeIntervention !== 'string' || typeof v.zone !== 'string' || typeof v.creeLe !== 'string' || !JOUR_QR.test(v.creeLe)) return null
  return { numero: v.numero, typeIntervention: v.typeIntervention, zone: v.zone, creeLe: v.creeLe, statut: v.statut }
}

/** Signalements déjà faits au même endroit (même copropriété, bâtiment et zone des parties communes). */
export async function chargerSemblablesQr(
  recherche: { jeton: string; batiment: string; zone: string; langue: LangueSignalementQr }, fetchImpl: Fetch = fetch,
): Promise<ResultatSemblablesQr> {
  const parametres = new URLSearchParams({ jeton: recherche.jeton, batiment: recherche.batiment, zone: recherche.zone, langue: recherche.langue })
  const r = await appeler(fetchImpl, `${URL_API_QR}/similaires?${parametres.toString()}`, { method: 'GET' })
  if (!r.ok) return r
  const liste = (r.corps as { semblables?: unknown } | null)?.semblables
  const semblables = Array.isArray(liste) ? liste.map(semblableDepuisCorps).filter((s): s is SignalementSemblableQr => s !== null) : []
  return { ok: true, semblables }
}

// ── Copropriétés et signalements (espace du super admin) ─────────────────────

const cabinetResume = (v: unknown): CabinetResumeQr | null =>
  (estObjet(v) && typeof v.id === 'string' ? { id: v.id, nom: chaine(v.nom), identifiant: chaine(v.identifiant) } : null)

const gestionnaireResume = (v: unknown): GestionnaireResumeQr | null =>
  (estObjet(v) && typeof v.id === 'string' ? { id: v.id, nom: typeof v.nom === 'string' ? v.nom : null } : null)

/**
 * Copropriété reçue du serveur, complétée des champs de gestion manquants ou mal formés (réponse d'avant la migration
 * du 11/11/2026, ou simulacre de test) : l'écran lit toujours une CoproprieteQr complète.
 */
export function normaliserCoproprieteQr(brute: unknown): CoproprieteQr {
  const c = estObjet(brute) ? brute : {}
  const defaut = gestionCoproprieteQrVide()
  const creePar = c.creePar === 'administrateur' || (estObjet(c.creePar) && typeof c.creePar.gestionnaireId === 'string')
    ? (c.creePar as CoproprieteQr['creePar'])
    : defaut.creePar
  return {
    ...(c as unknown as CoproprieteQr),
    cabinet: cabinetResume(c.cabinet),
    codePostal: typeof c.codePostal === 'string' ? c.codePostal : defaut.codePostal,
    ville: typeof c.ville === 'string' ? c.ville : defaut.ville,
    immatriculation: typeof c.immatriculation === 'string' ? c.immatriculation : null,
    referenceCabinet: typeof c.referenceCabinet === 'string' ? c.referenceCabinet : null,
    batiments: Array.isArray(c.batiments) ? c.batiments.filter((b): b is string => typeof b === 'string') : [],
    attribueeATous: c.attribueeATous === true,
    gestionnaires: Array.isArray(c.gestionnaires) ? c.gestionnaires.map(gestionnaireResume).filter((g): g is GestionnaireResumeQr => g !== null) : [],
    creePar,
    ouverts: entier(c.ouverts),
    urgentsOuverts: entier(c.urgentsOuverts),
    attente48h: entier(c.attente48h),
    dernier: typeof c.dernier === 'string' ? c.dernier : null,
    adressesDeGestionnaires: entier(c.adressesDeGestionnaires),
  }
}

/**
 * Copropriétés (avec leur QR code) et signalements reçus — super admin. filtre.gestionnaire : la page de suivi de ce
 * gestionnaire (ses copropriétés : attributions et « à tous » de son cabinet).
 */
export async function chargerTableauQr(
  jeton: string | null, fetchImpl: Fetch = fetch, filtre: { gestionnaire?: string; cabinet?: string } = {},
): Promise<ResultatTableauQr> {
  const url = `${URL_API_QR}/tableau${requete({ gestionnaire: filtre.gestionnaire, cabinet: filtre.cabinet })}`
  const r = await appeler(fetchImpl, url, { method: 'GET', headers: entetes(jeton, false) })
  if (!r.ok) return r
  const tableau = (r.corps as { tableau?: TableauQr } | null)?.tableau
  if (!tableau || !Array.isArray(tableau.coproprietes) || !Array.isArray(tableau.signalements)) return { ok: false, code: 'serveur' }
  return { ok: true, tableau: { ...tableau, coproprietes: tableau.coproprietes.map(normaliserCoproprieteQr) } }
}

const coproprieteDepuisCorps = (corps: unknown): ResultatCoproprieteQr => {
  const copropriete = (corps as { copropriete?: unknown } | null)?.copropriete
  return estObjet(copropriete) && typeof copropriete.id === 'string'
    ? { ok: true, copropriete: normaliserCoproprieteQr(copropriete) }
    : { ok: false, code: 'serveur' }
}

export async function creerCoproprieteQr(
  saisie: SaisieCoproprieteQr & SaisieGestionCoproprieteQr, jeton: string | null, fetchImpl: Fetch = fetch,
): Promise<ResultatCoproprieteQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/coproprietes`, {
    method: 'POST', headers: entetes(jeton, true), body: JSON.stringify(saisie),
  })
  return r.ok ? coproprieteDepuisCorps(r.corps) : r
}

export interface ModificationCoproprieteQr extends Partial<SaisieCoproprieteQr>, Omit<SaisieGestionCoproprieteQr, 'cabinetId' | 'gestionnaireIds'> {
  actif?: boolean
  /** Tire un nouveau jeton : l'ancien QR code ne répond plus (404). */
  regenererJeton?: boolean
  /**
   * PR 3 (décision H7) : fin de mission prévue (AAAA-MM-JJ) ; à partir de ce jour, plus aucune diffusion ; null l'efface.
   * Super admin seulement ; n'est envoyée que changée (migration 20261113 absente : 503).
   */
  diffusionFinGestionLe?: string | null
}

export async function modifierCoproprieteQr(
  id: string, modification: ModificationCoproprieteQr, jeton: string | null, fetchImpl: Fetch = fetch,
): Promise<ResultatCoproprieteQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/coproprietes/${segment(id)}`, {
    method: 'PATCH', headers: entetes(jeton, true), body: JSON.stringify(modification),
  })
  return r.ok ? coproprieteDepuisCorps(r.corps) : r
}

/** Suppression d'une copropriété sans signalement (409 signalements_presents sinon) ; le nom ressaisi la confirme. */
export async function supprimerCoproprieteQr(id: string, nomConfirmation: string, fetchImpl: Fetch = fetch): Promise<ResultatSimpleQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/coproprietes/${segment(id)}`, 'DELETE', { nomConfirmation })
  return r.ok ? { ok: true } : r
}

export type ResultatAttributionsCoproprieteQr =
  | { ok: true; gestionnaires: GestionnaireResumeQr[]; attribueeATous: boolean; adressesRetirees: number }
  | EchecQr

/** Gestionnaires d'une copropriété (remplace la liste) et « attribuée à tous ». */
export async function attribuerGestionnairesCoproprieteQr(
  id: string, attributions: { gestionnaireIds: string[]; attribueeATous?: boolean }, fetchImpl: Fetch = fetch,
): Promise<ResultatAttributionsCoproprieteQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/coproprietes/${segment(id)}/gestionnaires`, 'PUT', attributions)
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  const gestionnaires = Array.isArray(c.gestionnaires) ? c.gestionnaires.map(gestionnaireResume).filter((g): g is GestionnaireResumeQr => g !== null) : []
  return { ok: true, gestionnaires, attribueeATous: c.attribueeATous === true, adressesRetirees: entier(c.adressesRetirees) }
}

export type ResultatSignalementsCoproprieteQr = { ok: true; signalements: SignalementQr[]; suite: SuitePageQr } | EchecQr

const suiteDepuisCorps = (v: unknown): SuitePageQr =>
  (estObjet(v) && typeof v.avant === 'string' && typeof v.avantId === 'string' ? { avant: v.avant, avantId: v.avantId } : null)

/** Signalements d'une copropriété, du plus récent au plus ancien, par pages (curseur du serveur passé tel quel). */
export async function chargerSignalementsCoproprieteQr(
  id: string, options: { statut?: 'ouverts' | 'tous' | 'clos'; avant?: string; avantId?: string; limite?: number } = {}, fetchImpl: Fetch = fetch,
): Promise<ResultatSignalementsCoproprieteQr> {
  const url = `${URL_API_QR}/coproprietes/${segment(id)}/signalements${requete({ statut: options.statut, avant: options.avant, avantId: options.avantId, limite: options.limite })}`
  const r = await appelerEspace(fetchImpl, url, 'GET')
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  return { ok: true, signalements: Array.isArray(c.signalements) ? (c.signalements as SignalementQr[]) : [], suite: suiteDepuisCorps(c.suite) }
}

/**
 * Statut d'un signalement. `statutAttendu` (PR 2) : le statut affiché à l'écran ; changé entre-temps → 409
 * conflit_statut (exigé pour un gestionnaire, facultatif pour le super admin) ; absent : le corps d'avant.
 */
export async function changerStatutSignalementQr(
  id: string, statut: StatutSignalementQr, jeton: string | null, fetchImpl: Fetch = fetch, statutAttendu?: StatutSignalementQr,
): Promise<ResultatStatutQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/signalements/${segment(id)}`, {
    method: 'PATCH', headers: entetes(jeton, true), body: JSON.stringify(statutAttendu ? { statut, statutAttendu } : { statut }),
  })
  if (!r.ok) return r
  const s = (r.corps as { signalement?: { statut?: unknown; misAJourLe?: unknown } } | null)?.signalement
  return { ok: true, statut: (chaine(s?.statut) || statut) as StatutSignalementQr, misAJourLe: chaine(s?.misAJourLe) }
}

// ── Espace d'un cabinet : gestionnaire connecté (PR 2, lot 5) ─────────────────

/** Profil de la session (GET /moi) : jamais d'identifiant ; le cabinet et ses domaines viennent de la FICHE. */
export type MoiQr =
  | { profil: 'super_admin' }
  | { profil: 'gestionnaire'; nom: string | null; cabinet: { identifiant: string; nom: string; domaines: string[] } }
export type ResultatMoiQr = { ok: true; moi: MoiQr } | EchecQr

/** Profil de la session et cabinet de sa fiche (domaines des adresses qu'il peut ajouter aux destinataires). */
export async function chargerMoiQr(fetchImpl: Fetch = fetch): Promise<ResultatMoiQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/moi`, 'GET')
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  if (c.profil === 'super_admin') return { ok: true, moi: { profil: 'super_admin' } }
  if (c.profil !== 'gestionnaire' || !estObjet(c.cabinet) || typeof c.cabinet.identifiant !== 'string') return { ok: false, code: 'serveur' }
  const domaines = Array.isArray(c.cabinet.domaines) ? c.cabinet.domaines.filter((d): d is string => typeof d === 'string') : []
  return {
    ok: true,
    moi: { profil: 'gestionnaire', nom: typeof c.nom === 'string' ? c.nom : null, cabinet: { identifiant: c.cabinet.identifiant, nom: chaine(c.cabinet.nom), domaines } },
  }
}

/**
 * Saisie d'une copropriété par un gestionnaire (coproprieteGestionnaireQrSchema, strict) : jamais de cabinet, de
 * gestionnaires, de « à tous » ni de forçage ; le cabinet et l'attribution viennent de sa fiche, côté serveur.
 */
export interface SaisieCoproprieteGestionnaireQr {
  /** Tiré à l'ouverture de la fenêtre : un double clic ou un renvoi ne crée pas deux copropriétés. */
  operationId: string
  nom: string
  adresse: string
  codePostal: string
  ville: string
  immatriculation?: string
  referenceCabinet?: string
  batiments?: string[]
  emailsDestinataires?: string[]
  confirmerDoublonProbable?: boolean
}

/** Modification par un gestionnaire (modificationCoproprieteGestionnaireQrSchema) : les seuls champs changés. */
export type ModificationCoproprieteGestionnaireQr = Partial<Omit<SaisieCoproprieteGestionnaireQr, 'operationId'>>

/** Échec rendu à l'écran d'un gestionnaire : un doublon est toujours dans doublonCabinet (copropriété dans sa portée ou non). */
function echecGestionnaire(echec: EchecQr): EchecQr {
  if (echec.code !== 'doublon' || !echec.doublon) return echec
  const { doublon, ...reste } = echec
  return { ...reste, doublonCabinet: { certitude: doublon.certitude, critere: doublon.critere, copropriete: doublon.copropriete } }
}

/** Création par un gestionnaire : la copropriété lui est attribuée d'office, avec son QR code (réponse minimisée). */
export async function creerCoproprieteGestionnaireQr(saisie: SaisieCoproprieteGestionnaireQr, fetchImpl: Fetch = fetch): Promise<ResultatCoproprieteQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/coproprietes`, 'POST', saisie)
  return r.ok ? coproprieteDepuisCorps(r.corps) : echecGestionnaire(r)
}

/** Modification par un gestionnaire d'une copropriété qui lui est attribuée (403 lecture_seule sinon). */
export async function modifierCoproprieteGestionnaireQr(
  id: string, modification: ModificationCoproprieteGestionnaireQr, fetchImpl: Fetch = fetch,
): Promise<ResultatCoproprieteQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/coproprietes/${segment(id)}`, 'PATCH', modification)
  return r.ok ? coproprieteDepuisCorps(r.corps) : echecGestionnaire(r)
}

// ── Gestionnaires (fiches du super admin) ────────────────────────────────────

export type ResultatGestionnairesQr = { ok: true; gestionnaires: GestionnaireQr[] } | EchecQr

/** Fiches gestionnaires (état « actifs » par défaut côté serveur ; « tous » pour la liste de l'espace). */
export async function chargerGestionnairesQr(
  filtre: { etat?: 'actifs' | 'desactives' | 'tous'; cabinet?: string } = {}, fetchImpl: Fetch = fetch,
): Promise<ResultatGestionnairesQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/gestionnaires${requete({ etat: filtre.etat, cabinet: filtre.cabinet })}`, 'GET')
  if (!r.ok) return r
  const liste = estObjet(r.corps) ? r.corps.gestionnaires : null
  return { ok: true, gestionnaires: Array.isArray(liste) ? (liste as GestionnaireQr[]) : [] }
}

export type ResultatCreationGestionnaireQr =
  | { ok: true; gestionnaire: GestionnaireQr; emailEnvoye: boolean; coproprietesAvecAdresseSaisie: number }
  | EchecQr

/** Création d'une fiche, puis envoi du lien de confirmation d'adresse (par le serveur). */
export async function creerGestionnaireQr(saisie: SaisieGestionnaireQr, fetchImpl: Fetch = fetch): Promise<ResultatCreationGestionnaireQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/gestionnaires`, 'POST', saisie)
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  if (!estObjet(c.gestionnaire) || typeof c.gestionnaire.id !== 'string') return { ok: false, code: 'serveur' }
  return {
    ok: true, gestionnaire: c.gestionnaire as unknown as GestionnaireQr, emailEnvoye: c.emailEnvoye === true,
    coproprietesAvecAdresseSaisie: entier(c.coproprietesAvecAdresseSaisie),
  }
}

export type ResultatFicheGestionnaireQr = { ok: true; fiche: FicheGestionnaireDetailQr } | EchecQr

/** Page profil d'un gestionnaire (en-tête, envois, attributions, créations, activité). */
export async function chargerFicheGestionnaireQr(id: string, fetchImpl: Fetch = fetch): Promise<ResultatFicheGestionnaireQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/gestionnaires/${segment(id)}`, 'GET')
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  if (!estObjet(c.gestionnaire)) return { ok: false, code: 'serveur' }
  const liste = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  return {
    ok: true,
    fiche: {
      gestionnaire: c.gestionnaire as unknown as GestionnaireQr,
      envois: liste(c.envois), attributions: liste(c.attributions), creations: liste(c.creations), journal: liste<EvenementJournalQr>(c.journal),
    },
  }
}

/**
 * Suite non faite sur le compte VitFix relié (PR 2, lot 6 : réponse 207, l'action de la fiche est faite) : déblocage
 * après une réactivation, suppression après un effacement ; null : tout est fait.
 */
export type CompteIncompletQr = 'connexion_non_debloquee' | 'compte_non_supprime'

export type ResultatGestionnaireQr = { ok: true; gestionnaire: GestionnaireQr | null; incomplet: CompteIncompletQr | null } | EchecQr

/** Code d'une réponse 207 (« fait, sauf … ») ; null si la réponse n'en porte pas. */
const codeIncomplet = (corps: unknown): string | null => (estObjet(corps) && typeof corps.error === 'string' ? corps.error : null)

/** Une seule action : nom, réactivation, ou effacement (fiche désactivée seulement). */
export async function modifierGestionnaireQr(
  id: string, action: { nom: string } | { actif: true } | { pseudonymiser: true }, fetchImpl: Fetch = fetch,
): Promise<ResultatGestionnaireQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/gestionnaires/${segment(id)}`, 'PATCH', action)
  if (!r.ok) return r
  const g = estObjet(r.corps) ? r.corps.gestionnaire : null
  const code = codeIncomplet(r.corps)
  const incomplet = code === 'connexion_non_debloquee' || code === 'compte_non_supprime' ? code : null
  return { ok: true, gestionnaire: estObjet(g) ? (g as unknown as GestionnaireQr) : null, incomplet }
}

/**
 * « Bloquer la connexion » d'une fiche désactivée (PR 2, P2-R6, idempotent) ; bloquee false : la connexion n'a pas pu
 * être bloquée (207), à relancer.
 */
export async function bloquerConnexionGestionnaireQr(id: string, fetchImpl: Fetch = fetch): Promise<{ ok: true; bloquee: boolean } | EchecQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/gestionnaires/${segment(id)}/bloquer`, 'POST')
  if (!r.ok) return r
  return { ok: true, bloquee: estObjet(r.corps) && r.corps.connexionBloquee === true }
}

/** Nouvel envoi du lien de confirmation d'adresse ; emailEnvoye false : l'e-mail n'est pas parti. */
export async function renvoyerConfirmationQr(id: string, fetchImpl: Fetch = fetch): Promise<{ ok: true; emailEnvoye: boolean } | EchecQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/gestionnaires/${segment(id)}/confirmation`, 'POST')
  if (!r.ok) return r
  return { ok: true, emailEnvoye: estObjet(r.corps) && r.corps.emailEnvoye === true }
}

/** Ouvre l'accès d'une fiche à l'espace de son cabinet (PR 2, P2-R1) ; emailEnvoye false : l'e-mail n'est pas parti. */
export async function ouvrirAccesGestionnaireQr(id: string, fetchImpl: Fetch = fetch): Promise<{ ok: true; emailEnvoye: boolean } | EchecQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/gestionnaires/${segment(id)}/acces`, 'POST')
  if (!r.ok) return r
  return { ok: true, emailEnvoye: estObjet(r.corps) && r.corps.emailEnvoye === true }
}

export type ResultatAccesGroupeQr = { ok: true; envoyes: number; echecs: Array<{ id: string; code: string }> } | EchecQr

/** Ouvre l'accès de plusieurs fiches, une à une (PR 2, P2-R1b) : nombre d'envois partis et échecs avec leur code. */
export async function ouvrirAccesGroupeQr(gestionnaireIds: string[], fetchImpl: Fetch = fetch): Promise<ResultatAccesGroupeQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/gestionnaires/acces`, 'POST', { gestionnaireIds })
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  const echecs = (Array.isArray(c.echecs) ? c.echecs : [])
    .filter((e): e is { id: string; code: string } => estObjet(e) && typeof e.id === 'string' && typeof e.code === 'string')
    .map((e) => ({ id: e.id, code: e.code }))
  return { ok: true, envoyes: entier(c.envoyes), echecs }
}

/** Copropriétés attribuées à une fiche (remplace la liste). */
export async function attribuerCoproprietesGestionnaireQr(
  id: string, coproprieteIds: string[], fetchImpl: Fetch = fetch,
): Promise<{ ok: true; coproprietes: string[]; adressesRetirees: number } | EchecQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/gestionnaires/${segment(id)}/coproprietes`, 'PUT', { coproprieteIds })
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  const ids = Array.isArray(c.coproprietes) ? c.coproprietes.filter((x): x is string => typeof x === 'string') : []
  return { ok: true, coproprietes: ids, adressesRetirees: entier(c.adressesRetirees) }
}

/** connexionNonBloquee (PR 2, 207) : départ fait, mais le compte relié n'a pas été banni (« Bloquer la connexion »). */
export type ResultatDepartQr =
  | { ok: true; deplacees: number; laisseesSansGestionnaire: number; adressesRetirees: number; connexionNonBloquee: boolean }
  | EchecQr

/** Départ : une succession pour chacune de ses copropriétés, puis la fiche est désactivée (et son compte banni, PR 2). */
export async function departGestionnaireQr(id: string, successions: SuccessionDepartQr[], fetchImpl: Fetch = fetch): Promise<ResultatDepartQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/gestionnaires/${segment(id)}/depart`, 'POST', { successions })
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  return {
    ok: true, deplacees: entier(c.deplacees), laisseesSansGestionnaire: entier(c.laisseesSansGestionnaire), adressesRetirees: entier(c.adressesRetirees),
    connexionNonBloquee: codeIncomplet(c) === 'connexion_non_bloquee',
  }
}

export type ResultatExportQr = { ok: true; fichier: Blob; nomFichier: string } | EchecQr

/** Export RGPD d'une fiche : le fichier JSON tel que le serveur le donne (jamais gardé dans le navigateur). */
export async function exporterGestionnaireQr(id: string, fetchImpl: Fetch = fetch): Promise<ResultatExportQr> {
  let res: Response
  try {
    res = await fetchImpl(`${URL_API_QR}/gestionnaires/${segment(id)}/export`, { cache: 'no-store', credentials: 'same-origin', method: 'GET' })
  } catch (e) {
    console.warn('[aj-signalement] export impossible', e)
    return { ok: false, code: 'reseau' }
  }
  if (!res.ok) return echecDepuisReponse(res.status, await res.json().catch(() => null))
  const texte = await res.text().catch(() => null)
  if (texte === null) return { ok: false, code: 'serveur' }
  const nom = /filename="([^"/\\]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `gestionnaire-${id}.json`
  return { ok: true, fichier: new Blob([texte], { type: 'application/json' }), nomFichier: nom }
}

// ── Cabinets clients ─────────────────────────────────────────────────────────

export type ResultatCabinetsQr = { ok: true; cabinets: CabinetQr[] } | EchecQr

export async function chargerCabinetsQr(fetchImpl: Fetch = fetch): Promise<ResultatCabinetsQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/cabinets`, 'GET')
  if (!r.ok) return r
  const liste = estObjet(r.corps) ? r.corps.cabinets : null
  return { ok: true, cabinets: Array.isArray(liste) ? (liste as CabinetQr[]) : [] }
}

export type ResultatCabinetQr = { ok: true; cabinet: CabinetQr | null; fichesHorsDomaines: GestionnaireResumeQr[] } | EchecQr

const resultatCabinet = (corps: unknown): ResultatCabinetQr => {
  const c = estObjet(corps) ? corps : {}
  const fiches = Array.isArray(c.fichesHorsDomaines) ? c.fichesHorsDomaines.map(gestionnaireResume).filter((g): g is GestionnaireResumeQr => g !== null) : []
  return { ok: true, cabinet: estObjet(c.cabinet) ? (c.cabinet as unknown as CabinetQr) : null, fichesHorsDomaines: fiches }
}

export async function creerCabinetQr(saisie: SaisieCabinetQr, fetchImpl: Fetch = fetch): Promise<ResultatCabinetQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/cabinets`, 'POST', saisie)
  return r.ok ? resultatCabinet(r.corps) : r
}

/** Modification : seuls les champs donnés changent ; identifiant figé → identifiant_fige. */
export async function modifierCabinetQr(id: string, modification: Partial<SaisieCabinetQr>, fetchImpl: Fetch = fetch): Promise<ResultatCabinetQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/cabinets/${segment(id)}`, 'PATCH', modification)
  return r.ok ? resultatCabinet(r.corps) : r
}

/**
 * Rattachement définitif de copropriétés sans cabinet (leur QR code passe sous le chemin du cabinet). 409 doublon : la
 * copropriété semblable du cabinet (echec.doublon) ; renvoyer avec confirmerDoublonProbable ou forcerDoublon.
 */
export async function rattacherCoproprietesQr(
  cabinetId: string, coproprieteIds: string[], fetchImpl: Fetch = fetch,
  drapeaux: { forcerDoublon?: true; confirmerDoublonProbable?: true } = {},
): Promise<{ ok: true; rattachees: number } | EchecQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/cabinets/${segment(cabinetId)}/rattachement`, 'POST', { coproprieteIds, ...drapeaux })
  if (!r.ok) return r
  return { ok: true, rattachees: estObjet(r.corps) ? entier(r.corps.rattachees) : 0 }
}

// ── Import des copropriétés (lot 5, P1-R19) ──────────────────────────────────

const ETATS_IMPORT_QR: readonly EtatLigneImportQr[] = ['a_creer', 'avertissement', 'erreur', 'doublon_fichier', 'existe_deja']
const ACTIONS_IMPORT_QR: readonly ActionImportQr[] = ['creer', 'completer', 'ignorer', 'aucune']
const chaines = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

function messageImport(v: unknown): MessageImportQr | null {
  if (!estObjet(v) || typeof v.texte !== 'string') return null
  return { niveau: v.niveau === 'avertissement' ? 'avertissement' : 'erreur', champ: typeof v.champ === 'string' ? (v.champ as ChampImportQr) : null, texte: v.texte }
}

/** Diagnostic d'une ligne reçu du serveur ; une valeur inconnue devient une erreur (jamais une création par défaut). */
function diagnosticImport(v: unknown): DiagnosticLigneImportQr | null {
  if (!estObjet(v) || typeof v.numeroLigne !== 'number') return null
  const rendu = doublonDepuisCorps(v.doublon)
  const doublon = rendu && estObjet(v.doublon) ? { ...rendu, forcable: v.doublon.forcable === true } : null
  return {
    numeroLigne: v.numeroLigne,
    nom: chaine(v.nom),
    etat: (ETATS_IMPORT_QR as readonly unknown[]).includes(v.etat) ? (v.etat as EtatLigneImportQr) : 'erreur',
    action: (ACTIONS_IMPORT_QR as readonly unknown[]).includes(v.action) ? (v.action as ActionImportQr) : 'aucune',
    messages: Array.isArray(v.messages) ? v.messages.map(messageImport).filter((m): m is MessageImportQr => m !== null) : [],
    doublon,
    gestionnaires: Array.isArray(v.gestionnaires) ? v.gestionnaires.map(gestionnaireResume).filter((g): g is GestionnaireResumeQr => g !== null) : [],
    emailsDestinataires: chaines(v.emailsDestinataires),
    emailsHorsDomaine: chaines(v.emailsHorsDomaine),
  }
}

/** Vérification reçue du serveur (« verifier », ou diagnostics à jour d'un 409 a_reverifier) ; null si mal formée. */
function verificationDepuisCorps(corps: unknown): VerificationImportQr | null {
  if (!estObjet(corps) || !Array.isArray(corps.diagnostics)) return null
  const inconnus: unknown[] = Array.isArray(corps.gestionnairesInconnus) ? corps.gestionnairesInconnus : []
  return {
    diagnostics: corps.diagnostics.map(diagnosticImport).filter((d): d is DiagnosticLigneImportQr => d !== null),
    gestionnairesInconnus: inconnus.flatMap((g): GestionnaireInconnuImportQr[] => (estObjet(g) && typeof g.email === 'string'
      ? [{ email: g.email, nomPropose: chaine(g.nomPropose), dansDomaines: g.dansDomaines === true, lignes: Array.isArray(g.lignes) ? g.lignes.filter((n): n is number => typeof n === 'number') : [] }]
      : [])),
    horsDomaine: corps.horsDomaine === true,
  }
}

export type ResultatVerificationImportQr = { ok: true; verification: VerificationImportQr } | EchecQr
export type ResultatCreationImportQr = { ok: true; resultat: ResultatImportQr } | EchecQr

/** Vérification à blanc (rien n'est écrit) des lignes normalisées d'un fichier, pour un cabinet. */
export async function verifierImportQr(saisie: SaisieImportQr, fetchImpl: Fetch = fetch): Promise<ResultatVerificationImportQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/coproprietes/import`, 'POST', { mode: 'verifier', ...saisie })
  if (!r.ok) return r
  const verification = verificationDepuisCorps(r.corps)
  return verification ? { ok: true, verification } : { ok: false, code: 'serveur' }
}

/**
 * Création, tout ou rien ; 409 a_reverifier : l'échec porte les diagnostics à jour (verification). Les créées portent
 * ce que la base a enregistré (nom, adresse, code postal, ville, jeton) : affiches et export en sont faits.
 */
export async function creerImportQr(saisie: SaisieImportQr, fetchImpl: Fetch = fetch): Promise<ResultatCreationImportQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/coproprietes/import`, 'POST', { mode: 'creer', ...saisie })
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  const liste: unknown[] = Array.isArray(c.creees) ? c.creees : []
  const listeCompletees: unknown[] = Array.isArray(c.completees) ? c.completees : []
  const creees = liste.flatMap((x) => (estObjet(x) && typeof x.numeroLigne === 'number' && typeof x.id === 'string' && typeof x.jeton === 'string'
    ? [{ numeroLigne: x.numeroLigne, id: x.id, jeton: x.jeton, nom: chaine(x.nom), adresse: chaine(x.adresse), codePostal: chaine(x.codePostal), ville: chaine(x.ville) }]
    : []))
  const completees = listeCompletees.flatMap((x) => (estObjet(x) && typeof x.numeroLigne === 'number' && typeof x.id === 'string'
    ? [{ numeroLigne: x.numeroLigne, id: x.id }] : []))
  return { ok: true, resultat: { creees, completees, ignorees: entier(c.ignorees), rejeu: c.rejeu === true } }
}

// ── Journal ──────────────────────────────────────────────────────────────────

export type ResultatJournalQr = { ok: true; evenements: EvenementJournalQr[]; suite: SuitePageQr } | EchecQr

export async function chargerJournalQr(filtre: FiltreJournalQr = {}, fetchImpl: Fetch = fetch): Promise<ResultatJournalQr> {
  const url = `${URL_API_QR}/journal${requete({
    action: filtre.action, copropriete: filtre.copropriete, gestionnaire: filtre.gestionnaire, cabinet: filtre.cabinet,
    avant: filtre.avant, avantId: filtre.avantId,
  })}`
  const r = await appelerEspace(fetchImpl, url, 'GET')
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  return { ok: true, evenements: Array.isArray(c.evenements) ? (c.evenements as EvenementJournalQr[]) : [], suite: suiteDepuisCorps(c.suite) }
}

// ── Diffusion de messages d'exploitation aux déclarants (PR 3, lot 8) ────────
// Routes D-R1 à D-R8 (cahier § 4.1). Session de l'espace (cookies) : super admin, ou gestionnaire sur une copropriété
// qui lui est attribuée nommément (H11 ; hors portée 404, « à tous » 403 lecture_seule, rendus tels quels).

/** Raison pour laquelle une copropriété ne peut pas diffuser (signalements_qr_diffusion_raison_inactive). */
export const RAISONS_DIFFUSION_IMPOSSIBLE_QR = [
  'copropriete_inactive', 'sans_cabinet', 'diffusion_non_activee', 'langue_non_ouverte', 'fin_gestion', 'introuvable',
] as const
export type RaisonDiffusionImpossibleQr = (typeof RAISONS_DIFFUSION_IMPOSSIBLE_QR)[number]

/** Raison reçue : connue telle quelle ; toute autre chaîne non vide → « introuvable » (message générique) ; sinon null. */
const raisonDiffusion = (v: unknown): RaisonDiffusionImpossibleQr | null => {
  if ((RAISONS_DIFFUSION_IMPOSSIBLE_QR as readonly unknown[]).includes(v)) return v as RaisonDiffusionImpossibleQr
  return typeof v === 'string' && v !== '' ? 'introuvable' : null
}

/** Diffusions du mois civil sur la copropriété (une diffusion compte dès qu'une personne l'a reçue ; l'annonce non). */
export interface MoisDiffusionQr {
  nb: number
  dernierLe: string | null
}

/** D-R1 : ce que le formulaire propose pour une copropriété. */
export interface ValeursDiffusionQr {
  possible: boolean
  raison: RaisonDiffusionImpossibleQr | null
  /** Langue du cabinet : celle des modèles et du message. */
  langue: LangueSignalementQr
  batiments: BatimentCiblableQr[]
  /** Déclarants sans bâtiment lisible (indicatif) : atteints seulement par toute la copropriété ou un signalement. */
  sansBatiment: number
  porteeParDefaut: 'batiment' | 'copropriete'
  ceMois: MoisDiffusionQr
  /** Déclarants à qui la diffusion n'a jamais été annoncée (bouton du message d'annonce, H1 = C). */
  nbNonAnnonces: number
  /** Fin de mission prévue (H7), AAAA-MM-JJ ; null : aucune. */
  finMissionLe: string | null
}

const JOUR_ISO_QR = /^\d{4}-\d{2}-\d{2}$/

const moisDepuisCorps = (v: unknown): MoisDiffusionQr =>
  (estObjet(v) ? { nb: entier(v.nb), dernierLe: typeof v.dernierLe === 'string' && v.dernierLe ? v.dernierLe : null } : { nb: 0, dernierLe: null })

function etageCiblable(v: unknown): EtageCiblableQr | null {
  if (!estObjet(v) || typeof v.cle !== 'string' || v.cle === '') return null
  return { cle: v.cle, libelle: typeof v.libelle === 'string' && v.libelle ? v.libelle : null, libelleASaisir: v.libelleASaisir === true, variantes: chaines(v.variantes) }
}

function batimentCiblable(v: unknown): BatimentCiblableQr | null {
  const base = etageCiblable(v)
  if (!base || !estObjet(v)) return null
  const etages = Array.isArray(v.etages) ? v.etages.map(etageCiblable).filter((e): e is EtageCiblableQr => e !== null) : []
  return { ...base, etages, sansEtage: entier(v.sansEtage) }
}

/** D-R1 : bâtiments et étages présents, compteur du mois, diffusion possible ou raison, fin de mission. */
export async function chargerValeursDiffusionQr(coproprieteId: string, fetchImpl: Fetch = fetch): Promise<{ ok: true; valeurs: ValeursDiffusionQr } | EchecQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/coproprietes/${segment(coproprieteId)}/diffusions/valeurs`, 'GET')
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : null
  if (!c || typeof c.possible !== 'boolean') return { ok: false, code: 'serveur' }
  return {
    ok: true,
    valeurs: {
      possible: c.possible,
      raison: c.possible ? null : raisonDiffusion(c.raison) ?? 'introuvable',
      langue: c.langue === 'pt' ? 'pt' : 'fr',
      batiments: Array.isArray(c.batiments) ? c.batiments.map(batimentCiblable).filter((b): b is BatimentCiblableQr => b !== null) : [],
      sansBatiment: entier(c.sansBatiment),
      porteeParDefaut: c.porteeParDefaut === 'batiment' ? 'batiment' : 'copropriete',
      ceMois: moisDepuisCorps(c.ceMois),
      nbNonAnnonces: entier(c.nbNonAnnonces),
      finMissionLe: typeof c.finMissionLe === 'string' && JOUR_ISO_QR.test(c.finMissionLe) ? c.finMissionLe : null,
    },
  }
}

/** D-R2 : demande d'aperçu (des CLÉS, jamais des valeurs brutes ; le serveur les reconvertit). */
export interface DemandeApercuDiffusionQr {
  perimetre: PerimetreSaisiDiffusionQr
  /** Message d'annonce (H1 = C) : copropriété entière seulement. */
  annonce?: true
  libelleBatimentSaisi?: string
  libelleEtageSaisi?: string
}

/** D-R2 : nombre exact (même fonction SQL que l'envoi), libellé ÉCRIT dans l'e-mail, instant repassé à l'envoi. */
export interface ApercuDiffusionQr {
  nbDestinataires: number
  nbExclusOpposition: number
  /** null : le nom du bâtiment ou de l'étage est à écrire par l'auteur (libelleASaisir). */
  libellePerimetre: string | null
  libelleASaisir: boolean
  instant: string
  possible: boolean
  raison: RaisonDiffusionImpossibleQr | null
}

/** D-R2 : aperçu, aucune écriture. 409 perimetre_change : clé inconnue ; 400 texte_refuse : libellé saisi refusé. */
export async function apercuDiffusionQr(
  coproprieteId: string, demande: DemandeApercuDiffusionQr, fetchImpl: Fetch = fetch,
): Promise<{ ok: true; apercu: ApercuDiffusionQr } | EchecQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/coproprietes/${segment(coproprieteId)}/diffusions/apercu`, 'POST', demande)
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : null
  if (!c || typeof c.instant !== 'string' || c.instant === '') return { ok: false, code: 'serveur' }
  const possible = c.possible === true
  return {
    ok: true,
    apercu: {
      nbDestinataires: entier(c.nbDestinataires),
      nbExclusOpposition: entier(c.nbExclusOpposition),
      libellePerimetre: typeof c.libellePerimetre === 'string' && c.libellePerimetre ? c.libellePerimetre : null,
      libelleASaisir: c.libelleASaisir === true,
      instant: c.instant,
      possible,
      raison: possible ? null : raisonDiffusion(c.raison) ?? 'introuvable',
    },
  }
}

/** D-R3 : message à diffuser (schéma diffusionQrSchema). */
export interface SaisieDiffusionQr {
  /** Tiré à l'ouverture du formulaire : un double clic ou un nouvel essai rend la diffusion déjà créée. */
  operationId: string
  modele: ModeleDiffusionQr
  objet: string
  texte: string
  perimetre: PerimetreSaisiDiffusionQr
  libelleBatimentSaisi?: string
  libelleEtageSaisi?: string
  /** Libellé rendu par l'aperçu et montré dans la confirmation (changé depuis → 409 perimetre_change). */
  libellePerimetre: string
  /** `instant` de l'aperçu confirmé. */
  perimetreJusquAu: string
  nbDestinatairesAttendu: number
  /** Super admin seulement : instruction écrite du cabinet (HF4). */
  instruction?: { reference: string; recueLe: string }
}

/** Totaux d'une diffusion après un appel qui envoie (D-R3, D-R4) ; l'écran reprend tant que reste > 0. */
export interface EtatEnvoiDiffusionQr {
  envoyes: number
  refuses: number
  reste: number
  arret: ArretEnvoiDiffusionQr | null
}

const ARRETS_ENVOI_QR: readonly ArretEnvoiDiffusionQr[] = [
  'limite_service', 'quota_service', 'rejeu_concurrent', 'issue_inconnue', 'reseau', 'configuration_incomplete', 'base',
]
const etatEnvoiDepuisCorps = (c: Record<string, unknown>): EtatEnvoiDiffusionQr => ({
  envoyes: entier(c.envoyes),
  refuses: entier(c.refuses),
  reste: entier(c.reste),
  arret: (ARRETS_ENVOI_QR as readonly unknown[]).includes(c.arret) ? (c.arret as ArretEnvoiDiffusionQr) : null,
})

export type ResultatDiffusionQr = ({ ok: true; diffusionId: string; nbDestinataires: number; rejeu: boolean } & EtatEnvoiDiffusionQr) | EchecQr

/**
 * D-R3 : création de la diffusion, copie au cabinet, premiers lots. 201 (ou 200 rejeu : la diffusion de cette opération
 * existait déjà). Échecs : texte_refuse { refusTexte }, perimetre_change, aucun_destinataire, diffusion_inactive,
 * configuration_incomplete, base_absente.
 */
export async function diffuserMessageQr(coproprieteId: string, saisie: SaisieDiffusionQr, fetchImpl: Fetch = fetch): Promise<ResultatDiffusionQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/coproprietes/${segment(coproprieteId)}/diffusions`, 'POST', saisie)
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : null
  if (!c || typeof c.diffusionId !== 'string') return { ok: false, code: 'serveur' }
  return { ok: true, diffusionId: c.diffusionId, nbDestinataires: entier(c.nbDestinataires), rejeu: c.rejeu === true, ...etatEnvoiDepuisCorps(c) }
}

/**
 * D-R4 : lots suivants d'une diffusion. Plus d'une heure après l'écriture : 409 a_confirmer { creeLe } tant que
 * confirmeContenuAJour n'est pas envoyé ; plus de 24 h : 410 perime ; copropriété ou cabinet devenu inactif : 409.
 */
export async function reprendreDiffusionQr(
  diffusionId: string, options: { confirmeContenuAJour?: true } = {}, fetchImpl: Fetch = fetch,
): Promise<({ ok: true } & EtatEnvoiDiffusionQr) | EchecQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/diffusions/${segment(diffusionId)}/reprendre`, 'POST', options)
  if (!r.ok) return r
  return { ok: true, ...etatEnvoiDepuisCorps(estObjet(r.corps) ? r.corps : {}) }
}

function resumeDiffusion(v: unknown): ResumeDiffusionQr | null {
  if (!estObjet(v) || typeof v.id !== 'string') return null
  const n = estObjet(v.nombres) ? v.nombres : {}
  return {
    id: v.id, creeLe: chaine(v.creeLe), auteur: chaine(v.auteur) as ResumeDiffusionQr['auteur'], modele: chaine(v.modele),
    objet: chaine(v.objet), portee: chaine(v.portee), libellePerimetre: chaine(v.libellePerimetre),
    nombres: {
      destinataires: entier(n.destinataires), exclusOpposition: entier(n.exclusOpposition), envoyes: entier(n.envoyes),
      refuses: entier(n.refuses), attente: entier(n.attente), annules: entier(n.annules), incertains: entier(n.incertains),
    },
  }
}

export type ResultatDiffusionsQr = { ok: true; diffusions: ResumeDiffusionQr[]; ceMois: MoisDiffusionQr; suivant: string | null } | EchecQr

/** D-R5 : historique d'une copropriété (20 par page ; `avant` : curseur rendu par la page précédente, passé tel quel). */
export async function chargerDiffusionsQr(coproprieteId: string, options: { avant?: string } = {}, fetchImpl: Fetch = fetch): Promise<ResultatDiffusionsQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/coproprietes/${segment(coproprieteId)}/diffusions${requete({ avant: options.avant })}`, 'GET')
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  const diffusions = Array.isArray(c.diffusions) ? c.diffusions.map(resumeDiffusion).filter((d): d is ResumeDiffusionQr => d !== null) : []
  return { ok: true, diffusions, ceMois: moisDepuisCorps(c.ceMois), suivant: typeof c.suivant === 'string' && c.suivant ? c.suivant : null }
}

function nombresDiffusion(v: unknown): NombresDiffusionQr {
  const n = estObjet(v) ? v : {}
  return {
    envoyes: entier(n.envoyes), refuses: entier(n.refuses), attente: entier(n.attente), annules: entier(n.annules),
    incertains: entier(n.incertains), opposes: entier(n.opposes), perimes: entier(n.perimes),
  }
}

/** D-R6 : détail d'une diffusion (texte complet, nombres par état ; jamais une adresse). */
export async function chargerDiffusionQr(diffusionId: string, fetchImpl: Fetch = fetch): Promise<{ ok: true; diffusion: DetailDiffusionQr } | EchecQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/diffusions/${segment(diffusionId)}`, 'GET')
  if (!r.ok) return r
  const d = estObjet(r.corps) && estObjet(r.corps.diffusion) ? r.corps.diffusion : null
  if (!d || typeof d.id !== 'string') return { ok: false, code: 'serveur' }
  const instruction = estObjet(d.instruction) && typeof d.instruction.reference === 'string' && typeof d.instruction.recueLe === 'string'
    ? { reference: d.instruction.reference, recueLe: d.instruction.recueLe }
    : null
  return {
    ok: true,
    diffusion: {
      id: d.id, coproprieteId: chaine(d.coproprieteId), creeLe: chaine(d.creeLe), auteur: chaine(d.auteur) as DetailDiffusionQr['auteur'],
      modele: chaine(d.modele), langue: d.langue === 'pt' ? 'pt' : 'fr', objet: chaine(d.objet), texte: chaine(d.texte),
      portee: chaine(d.portee), libellePerimetre: chaine(d.libellePerimetre), nbDestinataires: entier(d.nbDestinataires),
      nbExclusOpposition: entier(d.nbExclusOpposition), instruction,
      copieCabinetLe: typeof d.copieCabinetLe === 'string' && d.copieCabinetLe ? d.copieCabinetLe : null,
      nombres: nombresDiffusion(d.nombres),
    },
  }
}

/**
 * D-R7 : « Ne plus envoyer d'informations à ce déclarant (à sa demande) » — opposition enregistrée à la demande écrite
 * de la personne (date de réception, AAAA-MM-JJ, non future), pour cette copropriété seulement.
 */
export async function opposerDeclarantDiffusionQr(
  coproprieteId: string, signalementId: string, demandeRecueLe: string, fetchImpl: Fetch = fetch,
): Promise<ResultatSimpleQr> {
  const url = `${URL_API_QR}/coproprietes/${segment(coproprieteId)}/signalements/${segment(signalementId)}/opposition`
  const r = await appelerEspace(fetchImpl, url, 'POST', { demandeRecueLe })
  if (!r.ok) return r
  return estObjet(r.corps) && r.corps.enregistree === true ? { ok: true } : { ok: false, code: 'serveur' }
}

/** D-R8 : réglages de diffusion d'un cabinet à enregistrer (les seuls champs changés ; envoyés SEULS). */
export interface ReglagesSaisisDiffusionQr {
  diffusionContactEmail?: string
  diffusionPolitiqueUrl?: string
  /** Déclaration datée par la base : la politique décrit la diffusion (finalité, base légale, durée, opposition). */
  politiqueDecritDiffusion?: true
  contratReference?: string
  contratSigneLe?: string
  telephonesAutorises?: string[]
  diffusionActivee?: boolean
}

function reglagesDiffusion(v: unknown): ReglagesDiffusionCabinetQr | null {
  if (!estObjet(v)) return null
  const texteOuNul = (x: unknown): string | null => (typeof x === 'string' && x ? x : null)
  return {
    contactEmail: texteOuNul(v.contactEmail), politiqueUrl: texteOuNul(v.politiqueUrl), politiqueDeclareeLe: texteOuNul(v.politiqueDeclareeLe),
    contratReference: texteOuNul(v.contratReference), contratSigneLe: texteOuNul(v.contratSigneLe), telephones: chaines(v.telephones),
    activeeLe: texteOuNul(v.activeeLe), active: v.active === true, langueOuverte: v.langueOuverte !== false,
    manque: Array.isArray(v.manque) ? v.manque.filter((m): m is ManqueActivationDiffusionQr => (MANQUES_ACTIVATION_QR as readonly unknown[]).includes(m)) : [],
  }
}

/** Réglages lus ; null : la migration 20261113 manque (la fiche du cabinet reste lisible). */
export type ResultatReglagesDiffusionQr = { ok: true; reglages: ReglagesDiffusionCabinetQr | null } | EchecQr

/** D-R8 (GET /cabinets/[id]) : réglages de diffusion du cabinet. */
export async function chargerReglagesDiffusionCabinetQr(cabinetId: string, fetchImpl: Fetch = fetch): Promise<ResultatReglagesDiffusionQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/cabinets/${segment(cabinetId)}`, 'GET')
  if (!r.ok) return r
  return { ok: true, reglages: reglagesDiffusion(estObjet(r.corps) ? r.corps.diffusion : null) }
}

/**
 * D-R8 (PATCH /cabinets/[id]) : réglages, activation ou suspension. Refus : 409 cabinet_incomplet { manque },
 * 409 langue_non_ouverte (H9), 400 invalide.
 */
export async function reglerDiffusionCabinetQr(
  cabinetId: string, reglages: ReglagesSaisisDiffusionQr, fetchImpl: Fetch = fetch,
): Promise<ResultatReglagesDiffusionQr> {
  const r = await appelerEspace(fetchImpl, `${URL_API_QR}/cabinets/${segment(cabinetId)}`, 'PATCH', reglages)
  if (!r.ok) return r
  return { ok: true, reglages: reglagesDiffusion(estObjet(r.corps) ? r.corps.diffusion : null) }
}

// ── Page publique de confirmation d'adresse (sans session) ───────────────────

export type ResultatLienConfirmationQr = { ok: true; nomCourt: string; cabinet: string; email: string } | EchecQr

const corpsLien = (token: string, cabinet: string) => ({
  method: 'POST', headers: entetes(null, true), body: JSON.stringify({ token, cabinet }),
})

/** Lecture du lien, SANS effet : nom court, cabinet et adresse masquée. */
export async function lireLienConfirmationQr(token: string, cabinet: string, fetchImpl: Fetch = fetch): Promise<ResultatLienConfirmationQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/confirmation/lecture`, corpsLien(token, cabinet))
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  return { ok: true, nomCourt: chaine(c.nomCourt), cabinet: chaine(c.cabinet), email: chaine(c.email) }
}

/** « C'est moi : confirmer l'adresse ». */
export async function confirmerAdresseQr(token: string, cabinet: string, fetchImpl: Fetch = fetch): Promise<ResultatSimpleQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/confirmation`, corpsLien(token, cabinet))
  return r.ok ? { ok: true } : r
}

/** « Ce n'est pas moi » : la fiche est figée et le cabinet prévenu. */
export async function contesterAdresseQr(token: string, cabinet: string, fetchImpl: Fetch = fetch): Promise<ResultatSimpleQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/confirmation/refus`, corpsLien(token, cabinet))
  return r.ok ? { ok: true } : r
}

// ── Page publique d'ouverture de l'accès d'un gestionnaire (PR 2, sans session) ──

/** Lecture du lien d'accès, SANS effet : nom court, cabinet et adresse masquée. */
export async function lireLienAccesQr(token: string, cabinet: string, fetchImpl: Fetch = fetch): Promise<ResultatLienConfirmationQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/invitation/lecture`, corpsLien(token, cabinet))
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  return { ok: true, nomCourt: chaine(c.nomCourt), cabinet: chaine(c.cabinet), email: chaine(c.email) }
}

/** Acceptation : liaisonIncomplete (207) = le compte existe mais l'accès n'a pas pu être relié (le cabinet est prévenu). */
/** `compteExistant` : compte VitFix rattaché dont le mot de passe n'a pas pu être remplacé (il garde le sien). */
export type ResultatAcceptationAccesQr = { ok: true; liaisonIncomplete: boolean; compteExistant: boolean } | EchecQr

/** Ouverture de l'accès avec le mot de passe choisi (case « politique de confidentialité » cochée). */
export async function accepterAccesQr(token: string, cabinet: string, password: string, fetchImpl: Fetch = fetch): Promise<ResultatAcceptationAccesQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/invitation`, {
    method: 'POST', headers: entetes(null, true), body: JSON.stringify({ token, cabinet, password, politiqueLue: true }),
  })
  if (!r.ok) return r
  const c = estObjet(r.corps) ? r.corps : {}
  return { ok: true, liaisonIncomplete: c.acces !== 'ouvert', compteExistant: c.acces === 'ouvert' && c.compte === 'existant' }
}

/** « Ce n'est pas moi » depuis un lien d'accès : aucun compte créé, la fiche est figée et le cabinet prévenu. */
export async function contesterAccesQr(token: string, cabinet: string, fetchImpl: Fetch = fetch): Promise<ResultatSimpleQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/invitation/refus`, corpsLien(token, cabinet))
  return r.ok ? { ok: true } : r
}
