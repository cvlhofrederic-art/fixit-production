// ── AJ Signalement : signalements déposés par QR code ─────────────────────────
//
// Application publique « AJ Signalement » : chaque copropriété a un QR code unique qui ouvre
// /fr/signalement/<jeton>/ ; la personne qui le scanne décrit le problème (même parcours que
// « Signaler un problème » du portail copropriétaire) et laisse ses coordonnées, toutes
// obligatoires. Le signalement est conservé (tables signalements_qr_*, migration 20261104) et
// envoyé par e-mail aux destinataires de la copropriété. Aucun lien avec le logiciel Syndic : ces
// types ne connaissent ni cabinet, ni immeuble, ni fiche de copropriétaire.

export type StatutSignalementQr = 'en_attente' | 'acceptee' | 'en_cours' | 'terminee' | 'annulee'
export type PrioriteSignalementQr = 'urgente' | 'normale' | 'planifiee'
export type LangueSignalementQr = 'fr' | 'pt'

export const STATUTS_SIGNALEMENT_QR: readonly StatutSignalementQr[] = ['en_attente', 'acceptee', 'en_cours', 'terminee', 'annulee']
export const PRIORITES_SIGNALEMENT_QR: readonly PrioriteSignalementQr[] = ['urgente', 'normale', 'planifiee']

/** Jeton d'un QR code : 32 caractères hexadécimaux (UUID sans tirets, tiré par la base ou par le serveur). */
export const JETON_QR = /^[0-9a-f]{32}$/

export const estJetonQr = (valeur: unknown): valeur is string => typeof valeur === 'string' && JETON_QR.test(valeur)

/** Copropriété dotée d'un QR code, telle que le tableau de bord la voit. */
export interface CoproprieteQr {
  id: string
  nom: string
  adresse: string
  jeton: string
  /** Adresses qui reçoivent les signalements ; vide = adresse de l'administrateur du déploiement. */
  emailsDestinataires: string[]
  actif: boolean
  creeLe: string
  nbSignalements: number
  nbEnAttente: number
}

/** Ce que le public voit de la copropriété après le scan. */
export interface CoproprieteQrPublique {
  nom: string
  adresse: string
}

/** Signalement reçu (tableau de bord : toutes les coordonnées du déclarant). */
export interface SignalementQr {
  id: string
  coproprieteId: string
  coproprieteNom: string
  prenom: string
  nom: string
  telephone: string
  email: string
  batiment: string
  etage: string
  numLot: string
  estPartieCommune: boolean
  zoneSignalee: string
  typeIntervention: string
  description: string
  priorite: PrioriteSignalementQr
  statut: StatutSignalementQr
  langue: LangueSignalementQr
  emailEnvoyeLe: string | null
  emailErreur: string | null
  creeLe: string
  misAJourLe: string
}

/** Corps du POST public /api/aj-signalement/signalements (validé par signalementQrSchema, lib/validation.ts). */
export interface SaisieSignalementQr {
  jeton: string
  prenom: string
  nom: string
  telephone: string
  email: string
  batiment: string
  etage: string
  numLot: string
  estPartieCommune: boolean
  zoneSignalee: string
  typeIntervention: string
  description: string
  priorite: PrioriteSignalementQr
  langue: LangueSignalementQr
}

/** Réponse de GET /api/aj-signalement/tableau. */
export interface TableauQr {
  coproprietes: CoproprieteQr[]
  signalements: SignalementQr[]
}

/** Copropriété saisie ou modifiée depuis le tableau de bord. */
export interface SaisieCoproprieteQr {
  nom: string
  adresse: string
  emailsDestinataires: string[]
}

/** Adresse publique du QR code (toujours sous /fr/ : la page est en français, la langue de l'administrateur). */
export function urlSignalementQr(jeton: string, origine = 'https://vitfix.io'): string {
  return `${origine.replace(/\/+$/, '')}/fr/signalement/${jeton}/`
}

/** Numéro communiqué au déclarant : huit premiers caractères de l'identifiant, en majuscules (comme le portail). */
export const numeroSignalementQr = (id: string): string => id.replace(/-/g, '').slice(0, 8).toUpperCase()

/** Ancre du tableau de bord dans le portail copropriétaire (vue super admin). */
export const ANCRE_TABLEAU_QR = 'signalementsQr'
export const CHEMIN_TABLEAU_QR = `/fr/coproprietaire/dashboard/#${ANCRE_TABLEAU_QR}`
