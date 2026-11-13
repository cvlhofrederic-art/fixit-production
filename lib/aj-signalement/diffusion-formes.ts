// ── AJ Signalement — diffusion : formes des réponses et périmètre résolu par le serveur (PR 3, lot 5) ──────────────────
//
// Module pur (aucune dépendance serveur) : lu par les routes de diffusion (app/api/aj-signalement/…/diffusions…) et par
// leurs tests ; les écrans (lot 8) peuvent en lire les types. Cahier PR 3 § 3.6, § 4.1, § 7.2, § 7.3, § 7.4.
//   - le périmètre choisi à l'écran (des CLÉS) est reconverti en valeurs brutes exactes et en libellé écrit dans
//     l'e-mail, ici seulement ; une clé inconnue → perimetre_change ; un libellé saisi par l'auteur passe le contrôle du
//     texte (controlerTexteDiffusionQr), comme tout libellé retenu, d'où qu'il vienne (fiche comprise) ;
//   - aucune réponse d'aperçu, de valeurs ou d'historique ne contient de « @ » : variantes brutes qui en portent retirées,
//     libellés contrôlés, auteur réduit à une énumération (jamais un nom, un identifiant de compte ni une adresse) ;
//     pour un gestionnaire (partie H11, RG-23), « vous » / « collegue » / « cabinet » et aucune instruction écrite ;
//   - réglages de diffusion d'un cabinet et ce qui manque à son activation (D-R8).

import { controlerTexteDiffusionQr, type ConseilTexteDiffusionQr, type MotifRefusTexteDiffusionQr } from '@/lib/aj-signalement/diffusion-texte'
import {
  libellePerimetreDiffusionQr, valeursBrutesDiffusionQr, valeursCiblablesQr,
  type BatimentCiblableQr, type CoupleValeursQr, type EtageCiblableQr, type PorteeDiffusionQr, type ValeursCiblablesQr,
} from '@/lib/aj-signalement/diffusion-valeurs'
import type { ModeleDiffusionQr } from '@/lib/aj-signalement/affichage-diffusion'
import { LANGUES_DIFFUSION_OUVERTES_QR, type AuteurStatutQr, type LangueCabinetQr, type LangueSignalementQr } from '@/lib/aj-signalement/types'

// ── Périmètre ──

/** Périmètre reçu (schéma perimetreDiffusionQrSchema, lib/validation.ts). */
export type PerimetreSaisiDiffusionQr =
  | { portee: 'copropriete' }
  | { portee: 'batiment'; batiment: string }
  | { portee: 'etage'; batiment: string; etage: string }
  | { portee: 'signalement'; signalementId: string }

/** Paramètres du périmètre pour les fonctions SQL (aperçu, création). */
export interface PerimetreSqlDiffusionQr {
  p_portee: PorteeDiffusionQr
  p_cle_batiment: string | null
  p_cle_etage: string | null
  p_batiments: string[] | null
  p_etages: string[] | null
  p_signalement: string | null
}

export type ChampLibelleDiffusionQr = 'libelleBatimentSaisi' | 'libelleEtageSaisi'

export type PerimetreResoluDiffusionQr =
  /** libelle null (et libelleASaisir) : l'auteur doit écrire le nom du bâtiment ou de l'étage (création refusée sans). */
  | { ok: true; sql: PerimetreSqlDiffusionQr; libelle: string | null; libelleASaisir: boolean }
  | { ok: false; code: 'perimetre_change' }
  | { ok: false; code: 'texte_refuse'; champ: ChampLibelleDiffusionQr; motif: MotifRefusTexteDiffusionQr; conseil?: ConseilTexteDiffusionQr }

/** Libellé écrit dans l'e-mail : accepté seulement s'il passe le contrôle du texte (nature libellé). */
function libelleControle(libelle: string | null, telephonesAutorises: readonly string[]): string | null {
  if (libelle === null) return null
  const controle = controlerTexteDiffusionQr(libelle, { nature: 'libelle', telephonesAutorises })
  return controle.ok ? controle.texte : null
}

const sansArobase = (variantes: readonly string[]): string[] => variantes.filter((v) => !v.includes('@'))

function cibleEcran<T extends EtageCiblableQr>(c: T, telephonesAutorises: readonly string[]): T {
  const libelle = libelleControle(c.libelle, telephonesAutorises)
  return { ...c, libelle, libelleASaisir: libelle === null, variantes: sansArobase(c.variantes) }
}

/**
 * Bâtiments et étages proposés à l'écran (D-R1) depuis les couples présents : regroupement de valeursCiblablesQr, puis
 * chaque libellé retenu repasse le contrôle du texte (un nom de la fiche qui ne le passe pas devient « à saisir ») et
 * les variantes brutes qui portent un « @ » sont retirées (une adresse tapée dans le champ du bâtiment).
 */
export function valeursPourEcranDiffusionQr(
  couples: readonly CoupleValeursQr[], batimentsFiche: readonly string[], langue: LangueSignalementQr,
  telephonesAutorises: readonly string[],
): ValeursCiblablesQr {
  const valeurs = valeursCiblablesQr(couples, batimentsFiche, langue, { telephonesAutorises })
  return {
    ...valeurs,
    batiments: valeurs.batiments.map((b): BatimentCiblableQr => ({
      ...cibleEcran(b, telephonesAutorises),
      etages: b.etages.map((e) => cibleEcran(e, telephonesAutorises)),
    })),
  }
}

const SQL_VIDE = { p_cle_batiment: null, p_cle_etage: null, p_batiments: null, p_etages: null, p_signalement: null } as const

/** Libellé retenu : celui de l'écran s'il est affichable, sinon la saisie de l'auteur (contrôlée), sinon à saisir. */
function libelleRetenu(
  cible: EtageCiblableQr, saisi: string | undefined, champ: ChampLibelleDiffusionQr, telephonesAutorises: readonly string[],
): { ok: true; libelle: string | null } | Extract<PerimetreResoluDiffusionQr, { code: 'texte_refuse' }> {
  if (!cible.libelleASaisir && cible.libelle !== null) return { ok: true, libelle: cible.libelle }
  if (saisi === undefined) return { ok: true, libelle: null }
  const controle = controlerTexteDiffusionQr(saisi, { nature: 'libelle', telephonesAutorises })
  if (!controle.ok) return { ok: false, code: 'texte_refuse', champ, motif: controle.motif, ...(controle.conseil ? { conseil: controle.conseil } : {}) }
  return { ok: true, libelle: controle.texte }
}

/**
 * Périmètre reçu → paramètres SQL (valeurs brutes EXACTES des couples présents) et libellé écrit dans l'e-mail.
 * Copropriété et signalement : libellé fixe ; bâtiment, étage : clé inconnue (ou « sans bâtiment ») → perimetre_change ;
 * libellé non affichable et non saisi → libelle null, libelleASaisir ; saisie refusée → texte_refuse (champ, motif).
 */
export function resoudrePerimetreDiffusionQr(p: {
  perimetre: PerimetreSaisiDiffusionQr
  couples: readonly CoupleValeursQr[]
  batimentsFiche: readonly string[]
  langue: LangueSignalementQr
  telephonesAutorises: readonly string[]
  libelleBatimentSaisi?: string
  libelleEtageSaisi?: string
}): PerimetreResoluDiffusionQr {
  const { perimetre, langue } = p
  if (perimetre.portee === 'copropriete') {
    return { ok: true, sql: { p_portee: 'copropriete', ...SQL_VIDE }, libelle: libellePerimetreDiffusionQr(langue, perimetre), libelleASaisir: false }
  }
  if (perimetre.portee === 'signalement') {
    return {
      ok: true, sql: { p_portee: 'signalement', ...SQL_VIDE, p_signalement: perimetre.signalementId.toLowerCase() },
      libelle: libellePerimetreDiffusionQr(langue, { portee: 'signalement' }), libelleASaisir: false,
    }
  }
  const brutes = valeursBrutesDiffusionQr(p.couples, perimetre)
  const valeurs = valeursPourEcranDiffusionQr(p.couples, p.batimentsFiche, langue, p.telephonesAutorises)
  const batiment = valeurs.batiments.find((b) => b.cle === perimetre.batiment)
  const etage = perimetre.portee === 'etage' ? batiment?.etages.find((e) => e.cle === perimetre.etage) : undefined
  if (!brutes || !batiment || (perimetre.portee === 'etage' && !etage)) return { ok: false, code: 'perimetre_change' }

  const libBatiment = libelleRetenu(batiment, p.libelleBatimentSaisi, 'libelleBatimentSaisi', p.telephonesAutorises)
  if (!libBatiment.ok) return libBatiment
  const libEtage = etage ? libelleRetenu(etage, p.libelleEtageSaisi, 'libelleEtageSaisi', p.telephonesAutorises) : { ok: true as const, libelle: null }
  if (!libEtage.ok) return libEtage

  const sql: PerimetreSqlDiffusionQr = {
    ...SQL_VIDE,
    p_portee: perimetre.portee,
    p_cle_batiment: perimetre.batiment,
    p_cle_etage: perimetre.portee === 'etage' ? perimetre.etage : null,
    p_batiments: brutes.batiments,
    p_etages: perimetre.portee === 'etage' ? brutes.etages : null,
  }
  const manque = libBatiment.libelle === null || (perimetre.portee === 'etage' && libEtage.libelle === null)
  if (manque) return { ok: true, sql, libelle: null, libelleASaisir: true }
  const libelle = perimetre.portee === 'etage'
    ? libellePerimetreDiffusionQr(langue, { portee: 'etage', batiment: libBatiment.libelle ?? '', etage: libEtage.libelle ?? '' })
    : libellePerimetreDiffusionQr(langue, { portee: 'batiment', batiment: libBatiment.libelle ?? '' })
  return { ok: true, sql, libelle, libelleASaisir: false }
}

// ── Historique et détail ──

/** Auteur d'une diffusion vu par le super admin : une énumération, jamais un nom ni un identifiant (PR 3). */
export type AuteurDiffusionQr = 'administrateur' | 'gestionnaire'

/**
 * Lecteur de l'historique ou du détail quand c'est un GESTIONNAIRE (partie H11, RG-23 de la PR 2) : sa fiche. Absent :
 * le super admin.
 */
export interface VueGestionnaireDiffusionQr { gestionnaireId: string }

/** Nombres d'une diffusion par état (agrégés en SQL depuis les destinataires). */
export interface NombresDiffusionQr {
  envoyes: number
  refuses: number
  /** En attente ou en cours (« reste » à envoyer). */
  attente: number
  annules: number
  incertains: number
  /** Parmi les annulés : par une opposition, et non partis en 24 h. */
  opposes: number
  perimes: number
}

export interface ResumeDiffusionQr {
  id: string
  creeLe: string
  /** Super admin : « administrateur » / « gestionnaire » ; gestionnaire : « vous » / « collegue » / « cabinet ». */
  auteur: AuteurDiffusionQr | AuteurStatutQr
  modele: ModeleDiffusionQr | string
  objet: string
  portee: PorteeDiffusionQr | string
  libellePerimetre: string
  nombres: {
    destinataires: number
    exclusOpposition: number
    envoyes: number
    refuses: number
    attente: number
    annules: number
    incertains: number
  }
}

export interface DetailDiffusionQr extends Omit<ResumeDiffusionQr, 'nombres'> {
  coproprieteId: string
  langue: LangueSignalementQr
  texte: string
  nbDestinataires: number
  nbExclusOpposition: number
  /**
   * Super admin : instruction écrite du cabinet (référence sans « @ », par la base). Jamais rendue à un gestionnaire :
   * texte libre saisi par le super admin, qui peut nommer une personne du cabinet (RG-23).
   */
  instruction: { reference: string; recueLe: string } | null
  copieCabinetLe: string | null
  nombres: NombresDiffusionQr
}

const texte = (v: unknown): string => (typeof v === 'string' ? v : '')
const nombre = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

export const auteurDiffusionQr = (profil: unknown): AuteurDiffusionQr => (profil === 'gestionnaire' ? 'gestionnaire' : 'administrateur')

/**
 * Auteur d'une diffusion vu par un gestionnaire (même règle que le statut, auteurStatutQr) : « vous » (sa fiche),
 * « collegue » (une autre fiche, même sans identifiant lisible), « cabinet » (le super admin, sur instruction du
 * cabinet) ; jamais un nom ni un identifiant.
 */
export function auteurDiffusionVuGestionnaireQr(
  l: { acteur_profil?: unknown; acteur_gestionnaire_id?: unknown }, gestionnaireId: string,
): AuteurStatutQr {
  if (l.acteur_profil !== 'gestionnaire') return 'cabinet'
  return l.acteur_gestionnaire_id === gestionnaireId ? 'vous' : 'collegue'
}

const auteurVu = (l: Record<string, unknown>, vue?: VueGestionnaireDiffusionQr): AuteurDiffusionQr | AuteurStatutQr =>
  (vue ? auteurDiffusionVuGestionnaireQr(l, vue.gestionnaireId) : auteurDiffusionQr(l.acteur_profil))

/**
 * Ligne de signalements_qr_diffusions_liste → forme de l'historique (aucune adresse, aucun identifiant de compte ni de
 * fiche) ; `vue` : lecteur gestionnaire (auteur minimisé).
 */
export function resumeDiffusionDepuisLigneQr(l: Record<string, unknown>, vue?: VueGestionnaireDiffusionQr): ResumeDiffusionQr {
  return {
    id: texte(l.id),
    creeLe: texte(l.cree_le),
    auteur: auteurVu(l, vue),
    modele: texte(l.modele),
    objet: texte(l.objet),
    portee: texte(l.portee),
    libellePerimetre: texte(l.libelle_perimetre),
    nombres: {
      destinataires: nombre(l.nb_destinataires),
      exclusOpposition: nombre(l.nb_exclus_opposition),
      envoyes: nombre(l.nb_envoyes),
      refuses: nombre(l.nb_refuses),
      attente: nombre(l.nb_attente),
      annules: nombre(l.nb_annules),
      incertains: nombre(l.nb_incertains),
    },
  }
}

/** Ligne de signalements_qr_diffusion_nombres → nombres (zéros si la ligne manque). */
export function nombresDiffusionDepuisLigneQr(l: Record<string, unknown> | null | undefined): NombresDiffusionQr {
  const r = l ?? {}
  return {
    envoyes: nombre(r.nb_envoyes), refuses: nombre(r.nb_refuses), attente: nombre(r.nb_attente), annules: nombre(r.nb_annules),
    incertains: nombre(r.nb_incertains), opposes: nombre(r.nb_opposes), perimes: nombre(r.nb_perimes),
  }
}

/**
 * Ligne de signalements_qr_diffusions → détail (D-R6) : texte compris ; ni l'adresse de contact, ni l'expéditeur, ni
 * l'adresse de la politique (les valeurs figées qui portent une adresse ne sortent pas), ni l'auteur nominatif.
 * `vue` : lecteur gestionnaire (auteur minimisé, instruction écrite non rendue).
 */
export function detailDiffusionDepuisLigneQr(
  l: Record<string, unknown>, nombres: NombresDiffusionQr, vue?: VueGestionnaireDiffusionQr,
): DetailDiffusionQr {
  const reference = vue ? '' : texte(l.instruction_reference)
  const recueLe = texte(l.instruction_recue_le)
  return {
    id: texte(l.id),
    coproprieteId: texte(l.copropriete_id),
    creeLe: texte(l.created_at),
    auteur: auteurVu(l, vue),
    modele: texte(l.modele),
    langue: l.langue === 'pt' ? 'pt' : 'fr',
    objet: texte(l.objet),
    texte: texte(l.texte),
    portee: texte(l.portee),
    libellePerimetre: texte(l.libelle_perimetre),
    nbDestinataires: nombre(l.nb_destinataires),
    nbExclusOpposition: nombre(l.nb_exclus_opposition),
    instruction: reference && recueLe ? { reference, recueLe } : null,
    copieCabinetLe: texte(l.copie_cabinet_le) || null,
    nombres,
  }
}

// ── Réglages de diffusion d'un cabinet (D-R8) ──

/** Ce qui manque à l'activation (cahier § 7.4 : « Activation refusée, avec la liste de ce qui manque »). */
export type ManqueActivationDiffusionQr = 'contact' | 'politique' | 'declaration_politique' | 'contrat_reference' | 'contrat_date'

export interface EtatReglagesDiffusionQr {
  contactEmail: string | null
  politiqueUrl: string | null
  politiqueDeclareeLe: string | null
  contratReference: string | null
  contratSigneLe: string | null
}

export function manqueActivationDiffusionQr(e: EtatReglagesDiffusionQr): ManqueActivationDiffusionQr[] {
  const manque: ManqueActivationDiffusionQr[] = []
  if (!e.contactEmail) manque.push('contact')
  if (!e.politiqueUrl) manque.push('politique')
  if (!e.politiqueDeclareeLe) manque.push('declaration_politique')
  if (!e.contratReference) manque.push('contrat_reference')
  if (!e.contratSigneLe) manque.push('contrat_date')
  return manque
}

export const langueDiffusionOuverteQr = (langue: LangueCabinetQr): boolean => LANGUES_DIFFUSION_OUVERTES_QR.includes(langue)

export interface ReglagesDiffusionCabinetQr extends EtatReglagesDiffusionQr {
  telephones: string[]
  activeeLe: string | null
  active: boolean
  /** Langue du cabinet ouverte à la diffusion (H9 : le français seulement). */
  langueOuverte: boolean
  manque: ManqueActivationDiffusionQr[]
}

/** Ligne de signalements_qr_cabinets (colonnes de diffusion) → réglages rendus au super admin. */
export function reglagesDiffusionDepuisLigneQr(l: Record<string, unknown>): ReglagesDiffusionCabinetQr {
  const etat: EtatReglagesDiffusionQr = {
    contactEmail: texte(l.diffusion_contact_email) || null,
    politiqueUrl: texte(l.diffusion_politique_url) || null,
    politiqueDeclareeLe: texte(l.diffusion_politique_verifiee_le) || null,
    contratReference: texte(l.diffusion_contrat_reference) || null,
    contratSigneLe: texte(l.diffusion_contrat_signe_le) || null,
  }
  const activeeLe = texte(l.diffusion_activee_le) || null
  const telephones = Array.isArray(l.diffusion_telephones) ? l.diffusion_telephones.filter((t): t is string => typeof t === 'string') : []
  return {
    ...etat, telephones, activeeLe, active: activeeLe !== null,
    langueOuverte: langueDiffusionOuverteQr(l.langue === 'pt' ? 'pt' : 'fr'),
    manque: manqueActivationDiffusionQr(etat),
  }
}
