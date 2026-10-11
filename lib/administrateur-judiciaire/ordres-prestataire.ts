/**
 * Boucle prestataire de l'Administrateur judiciaire : un ordre de service envoyé à un prestataire Vitfix du
 * cabinet (fiche syndic_artisans avec un compte) devient une mission syndic_missions (demandeur_role
 * 'administrateur_judiciaire', sans signalement) livrée comme un ordre de mission du Syndic v54 ; le prestataire
 * répond dans Messagerie > Pro et l'Administrateur judiciaire suit le statut, le fil et les documents.
 *
 * Types échangés avec /api/administrateur-judiciaire/ordres-prestataire, correspondances d'urgence, libellés et
 * teintes de statut, étapes, fil d'un ordre dans la conversation (partagée avec le Syndic v54 : même cabinet,
 * même prestataire). Fichier sans dépendance serveur ni navigateur : utilisé par la route et par l'écran.
 */
import type { CoteMessage, DocumentPrestataire, StatutOrdreMission, TypeDocumentPrestataire } from '@/lib/syndic/messagerie-pro'

export type { StatutOrdreMission } from '@/lib/syndic/messagerie-pro'

/** syndic_missions.demandeur_role et metadata.origine des ordres de l'Administrateur judiciaire. */
export const ORIGINE_ADMINISTRATEUR_JUDICIAIRE = 'administrateur_judiciaire' as const

/** Urgence d'un ordre de service (écran : « Normale », « Prioritaire », « Urgence »). */
export type UrgenceOrdreAJ = 'normale' | 'prioritaire' | 'urgence'

/** Urgence de l'ordre de mission côté prestataire. */
export type UrgenceOrdreMission = 'urgente' | 'haute' | 'normale'

/**
 * Urgence AJ → priorité de la mission (CHECK urgente | normale | planifiee de syndic_missions) et urgence de
 * l'ordre de mission affichée au prestataire.
 */
export function correspondanceUrgence(urgence: UrgenceOrdreAJ): { priorite: 'urgente' | 'normale'; urgenceOrdre: UrgenceOrdreMission } {
  if (urgence === 'urgence') return { priorite: 'urgente', urgenceOrdre: 'urgente' }
  if (urgence === 'prioritaire') return { priorite: 'normale', urgenceOrdre: 'haute' }
  return { priorite: 'normale', urgenceOrdre: 'normale' }
}

/** Libellé d'urgence de l'écran → code (valeur inconnue : normale). */
export function urgenceDepuisLibelle(libelle: string): UrgenceOrdreAJ {
  if (libelle === 'Urgence') return 'urgence'
  if (libelle === 'Prioritaire') return 'prioritaire'
  return 'normale'
}

/** Urgence de l'ordre de mission → libellé de l'écran. */
export function libelleUrgenceOrdre(urgence: string): 'Urgence' | 'Prioritaire' | 'Normale' {
  if (urgence === 'urgente') return 'Urgence'
  if (urgence === 'haute') return 'Prioritaire'
  return 'Normale'
}

export const LIBELLE_STATUT_ORDRE: Readonly<Record<StatutOrdreMission, string>> = {
  en_attente: 'En attente',
  accepte: 'Accepté',
  en_cours: 'En cours',
  termine: 'Terminé',
  refuse: 'Refusé',
}

/** Teinte de la pastille de statut (classes pill de la succursale). */
export const TEINTE_STATUT_ORDRE: Readonly<Record<StatutOrdreMission, string>> = {
  en_attente: 'gold',
  accepte: 'sage',
  en_cours: 'amber',
  termine: 'sage',
  refuse: 'rust',
}

export const LIBELLE_DOCUMENT: Readonly<Record<TypeDocumentPrestataire, string>> = {
  devis: 'Devis',
  rapport: "Rapport d'intervention",
  facture: 'Facture',
}

/** Statut de la mission syndic_missions → statut d'ordre, quand le message d'ordre n'est pas retrouvé. */
export function statutDepuisMission(statut: string | null | undefined): StatutOrdreMission {
  if (statut === 'acceptee') return 'accepte'
  if (statut === 'en_cours') return 'en_cours'
  if (statut === 'terminee') return 'termine'
  if (statut === 'annulee') return 'refuse'
  return 'en_attente'
}

export interface EtapeOrdre {
  nom: string
  etat: 'done' | 'current' | 'pending'
}

const ETAPES = ['Transmis', 'Accepté', 'Démarré', 'Terminé'] as const
const RANG: Readonly<Record<Exclude<StatutOrdreMission, 'refuse'>, number>> = { en_attente: 1, accepte: 2, en_cours: 3, termine: 4 }

/** Étapes « Transmis → Accepté → Démarré → Terminé » ; un refus s'arrête après « Transmis ». */
export function etapesOrdre(statut: StatutOrdreMission): EtapeOrdre[] {
  if (statut === 'refuse') {
    return [
      { nom: 'Transmis', etat: 'done' },
      { nom: 'Refusé par le prestataire', etat: 'current' },
    ]
  }
  const rang = RANG[statut]
  return ETAPES.map((nom, index) => ({
    nom,
    etat: index < rang || rang === ETAPES.length ? 'done' : index === rang ? 'current' : 'pending',
  }))
}

/** Message de conversation tel que lu en base (conversation_messages). */
export interface MessageConversation {
  id: string
  type: string | null
  metadata: unknown
}

const metadonnees = (m: MessageConversation): Record<string, unknown> =>
  typeof m.metadata === 'object' && m.metadata !== null && !Array.isArray(m.metadata) ? (m.metadata as Record<string, unknown>) : {}

const chaine = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/**
 * Fil d'un ordre dans sa conversation (messages en ordre chronologique) : les messages qui suivent l'ordre
 * jusqu'à l'ordre suivant de la conversation (Syndic v54 ou Administrateur judiciaire), plus, à toute date,
 * les messages rattachés à cet ordre (metadata.ordre_message_id : acceptation, démarrage, fin) ou à sa mission
 * (metadata.syndic_mission_id : réponses de l'Administrateur judiciaire). Les messages rattachés à un AUTRE
 * ordre ou à une autre mission en sont exclus. Un document du prestataire n'est rattaché à aucun ordre : il
 * est attribué à l'ordre en cours au moment de son envoi.
 */
export function filOrdre<T extends MessageConversation>(messages: readonly T[], ordreMessageId: string, missionId: string): T[] {
  const debut = messages.findIndex((m) => m.id === ordreMessageId)
  if (debut === -1) return []
  const fin = messages.findIndex((m, index) => index > debut && m.type === 'ordre_mission')
  return messages.filter((m, index) => {
    if (index <= debut) return false
    const meta = metadonnees(m)
    const ordreLie = chaine(meta.ordre_message_id)
    if (ordreLie) return ordreLie === ordreMessageId
    const missionLiee = chaine(meta.syndic_mission_id)
    if (missionLiee) return missionLiee === missionId
    if (m.type === 'ordre_mission') return false
    return fin === -1 || index < fin
  })
}

/** Message du fil renvoyé à l'écran. */
export interface MessageOrdrePrestataire {
  id: string
  type: string
  contenu: string
  creeLe: string
  cote: CoteMessage
  document: DocumentPrestataire | null
}

/** Ordre de service envoyé à un prestataire Vitfix, avec son suivi. */
export interface OrdrePrestataire {
  missionId: string
  conversationId: string | null
  messageId: string | null
  /** Numéro de l'ordre de service de l'écran (ex. « OS-2026-051 »), vide pour un envoi libre. */
  referenceAj: string
  titre: string
  copropriete: string
  adresse: string
  localisation: string
  prestataire: { nom: string; metier: string }
  urgence: UrgenceOrdreMission
  /** AAAA-MM-JJ */
  dateIntervention: string
  creeLe: string
  statut: StatutOrdreMission
  /** Heure d'arrivée annoncée à l'acceptation (HH:MM), vide sinon. */
  heureArrivee: string
  messages: MessageOrdrePrestataire[]
}

/** Prestataire du cabinet proposé à l'envoi : seuls ceux qui ont un compte Vitfix peuvent recevoir l'ordre. */
export interface PrestataireVitfix {
  id: string
  nom: string
  metier: string
  compte: boolean
}

export interface ReponseOrdresPrestataire {
  prestataires: PrestataireVitfix[]
  ordres: OrdrePrestataire[]
}

/** Corps de l'envoi d'un ordre de service (action « envoyer »). */
export interface DemandeEnvoiOrdre {
  syndic_artisan_id: string
  copropriete: string
  adresse?: string
  objet: string
  description?: string
  localisation?: string
  urgence: UrgenceOrdreAJ
  date_intervention?: string
  note?: string
  reference_aj?: string
}

/** Ordre le plus récent par numéro d'ordre de service (les envois libres, sans numéro, n'y figurent pas). */
export function dernierOrdreParReference(ordres: readonly OrdrePrestataire[]): Map<string, OrdrePrestataire> {
  const parReference = new Map<string, OrdrePrestataire>()
  for (const ordre of ordres) {
    if (!ordre.referenceAj) continue
    const connu = parReference.get(ordre.referenceAj)
    if (!connu || ordre.creeLe > connu.creeLe) parReference.set(ordre.referenceAj, ordre)
  }
  return parReference
}
