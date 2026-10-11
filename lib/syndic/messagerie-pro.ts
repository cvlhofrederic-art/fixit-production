/**
 * Messagerie « Pro » (tables conversations / conversation_messages) — règles partagées entre le
 * donneur d'ordre (syndic, Canal de communication v54) et le prestataire (Messagerie > Pro).
 *
 * Le syndic et le prestataire peuvent être le MÊME compte (démo : un super admin qui bascule de vue),
 * donc sender_id ne suffit pas à dire qui parle : chaque message écrit par ce circuit porte
 * metadata.cote. Règle de lecture (identique des deux côtés) :
 *   1. metadata.cote présent → on le croit ;
 *   2. sinon un 'ordre_mission' vient du donneur d'ordre ;
 *   3. sinon le message vient de l'artisan si sender_id === conversation.artisan_id, du donneur d'ordre autrement.
 *
 * Fichier sans dépendance serveur : utilisable par les routes comme par le navigateur.
 */

export type CoteMessage = 'donneur_ordre' | 'artisan'

/** Type de document envoyé par le prestataire dans la conversation. */
export type TypeDocumentPrestataire = 'devis' | 'rapport' | 'facture'

/** Document (devis, rapport d'intervention, facture) porté par metadata.document d'un message 'text'. */
export interface DocumentPrestataire {
  type: TypeDocumentPrestataire
  reference: string
  montant_ttc?: number
  description: string
  /** AAAA-MM-JJ */
  date: string
}

interface MessageLu {
  type?: string | null
  sender_id?: string | null
  metadata?: unknown
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Côté (donneur d'ordre / artisan) d'un message de conversation, selon la règle commune. */
export function coteDuMessage(message: MessageLu, artisanId: string | null | undefined): CoteMessage {
  const cote = estObjet(message.metadata) ? message.metadata.cote : undefined
  if (cote === 'donneur_ordre' || cote === 'artisan') return cote
  if (message.type === 'ordre_mission') return 'donneur_ordre'
  return artisanId && message.sender_id === artisanId ? 'artisan' : 'donneur_ordre'
}

const TYPES_DOCUMENT: readonly TypeDocumentPrestataire[] = ['devis', 'rapport', 'facture']

/** Document du message (metadata.document), ou null si absent ou mal formé. */
export function documentDuMessage(metadata: unknown): DocumentPrestataire | null {
  if (!estObjet(metadata) || !estObjet(metadata.document)) return null
  const d = metadata.document
  if (typeof d.type !== 'string' || !TYPES_DOCUMENT.includes(d.type as TypeDocumentPrestataire)) return null
  const montant = typeof d.montant_ttc === 'number' && Number.isFinite(d.montant_ttc) ? d.montant_ttc : undefined
  return {
    type: d.type as TypeDocumentPrestataire,
    reference: typeof d.reference === 'string' ? d.reference : '',
    ...(montant !== undefined ? { montant_ttc: montant } : {}),
    description: typeof d.description === 'string' ? d.description : '',
    date: typeof d.date === 'string' ? d.date : '',
  }
}

/** Statut d'un ordre de mission, tel qu'écrit par PATCH /api/pro/messagerie. */
export type StatutOrdreMission = 'en_attente' | 'accepte' | 'refuse' | 'en_cours' | 'termine'

const STATUTS_ORDRE: readonly StatutOrdreMission[] = ['en_attente', 'accepte', 'refuse', 'en_cours', 'termine']

/** Statut lu dans le JSON ordre_mission (valeur inconnue ou absente → 'en_attente'). */
export function statutOrdre(ordre: unknown): StatutOrdreMission {
  const s = estObjet(ordre) ? ordre.statut : undefined
  return typeof s === 'string' && STATUTS_ORDRE.includes(s as StatutOrdreMission) ? (s as StatutOrdreMission) : 'en_attente'
}
