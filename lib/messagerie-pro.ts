// Messagerie Pro — conversations prestataire ↔ donneur d'ordre (syndic, gestionnaire…)
//
// Règles partagées entre la route /api/pro/messagerie (écriture) et le composant
// MessagerieArtisan (affichage), communes aux tableaux de bord Artisan et BTP.
//
// Tables : `conversations` (artisan_id = compte du prestataire, contact_id = compte du
// donneur d'ordre, contact_type 'pro') et `conversation_messages`.

export type CoteMessage = 'artisan' | 'donneur_ordre'

export interface MessageCoteInput {
  type?: string | null
  sender_id?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Côté d'un message dans une conversation prestataire ↔ donneur d'ordre.
 *
 * Le syndic et le prestataire peuvent être le MÊME compte (démo avec un seul compte
 * super admin) : l'identifiant de l'expéditeur ne suffit donc plus. Règle du contrat :
 *   1. `metadata.cote` renseigné → on lui fait confiance ;
 *   2. sinon un ordre de mission vient toujours du donneur d'ordre ;
 *   3. sinon `sender_id === conversation.artisan_id` → prestataire, autrement donneur d'ordre.
 */
export function coteDuMessage(msg: MessageCoteInput, artisanIdConversation: string): CoteMessage {
  const cote = msg.metadata?.cote
  if (cote === 'artisan' || cote === 'donneur_ordre') return cote
  if (msg.type === 'ordre_mission') return 'donneur_ordre'
  return msg.sender_id === artisanIdConversation ? 'artisan' : 'donneur_ordre'
}

// ── Documents envoyés par le prestataire (devis, rapport, facture) ──────────────
// Un document est un message `type: 'text'` (la contrainte CHECK de la table limite les
// types) dont `metadata.document` décrit la pièce ; `content` en est le résumé lisible.

export const TYPES_DOCUMENT_PRO = ['devis', 'rapport', 'facture'] as const
export type TypeDocumentPro = typeof TYPES_DOCUMENT_PRO[number]

export interface DocumentPro {
  type: TypeDocumentPro
  reference: string
  montant_ttc?: number
  description: string
  /** AAAA-MM-JJ */
  date: string
}

type LangueDocument = 'fr' | 'pt'

export const ICONES_DOCUMENT_PRO: Record<TypeDocumentPro, string> = {
  devis: '📄',
  rapport: '📝',
  facture: '🧾',
}

const LIBELLES_DOCUMENT_PRO: Record<LangueDocument, Record<TypeDocumentPro, string>> = {
  fr: { devis: 'Devis', rapport: "Rapport d'intervention", facture: 'Facture' },
  pt: { devis: 'Orçamento', rapport: 'Relatório de intervenção', facture: 'Fatura' },
}

const langue = (locale?: string): LangueDocument => (locale === 'pt' ? 'pt' : 'fr')

export function libelleDocumentPro(type: TypeDocumentPro, locale?: string): string {
  return LIBELLES_DOCUMENT_PRO[langue(locale)][type]
}

/** Montant TTC lisible : « 1 240,50 € TTC » (fr) / « 1 240,50 € c/ IVA » (pt). */
export function formaterMontantDocumentPro(montant: number, locale?: string): string {
  const lg = langue(locale)
  const nombre = montant.toLocaleString(lg === 'pt' ? 'pt-PT' : 'fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${nombre} € ${lg === 'pt' ? 'c/ IVA' : 'TTC'}`
}

/**
 * Résumé texte d'un document (colonne `content`), lisible par toute interface qui ne sait
 * pas afficher la carte : « 📄 Devis D-2026-014 — 640,00 € TTC — Remplacement colonne EF ».
 */
export function resumeDocumentPro(doc: DocumentPro, locale?: string): string {
  const morceaux = [`${ICONES_DOCUMENT_PRO[doc.type]} ${libelleDocumentPro(doc.type, locale)} ${doc.reference}`]
  if (typeof doc.montant_ttc === 'number') morceaux.push(formaterMontantDocumentPro(doc.montant_ttc, locale))
  if (doc.description) morceaux.push(doc.description)
  return morceaux.join(' — ')
}

const estTypeDocument = (v: unknown): v is TypeDocumentPro =>
  typeof v === 'string' && (TYPES_DOCUMENT_PRO as readonly string[]).includes(v)

/**
 * Lit `metadata.document` d'un message pour l'afficher en carte. Lecture tolérante (les
 * lignes viennent de la base) : renvoie null si la pièce est absente ou inexploitable,
 * l'interface retombe alors sur le texte du message.
 */
export function lireDocumentPro(metadata: unknown): DocumentPro | null {
  if (!metadata || typeof metadata !== 'object') return null
  const brut = (metadata as Record<string, unknown>).document
  if (!brut || typeof brut !== 'object') return null
  const d = brut as Record<string, unknown>
  if (!estTypeDocument(d.type) || typeof d.reference !== 'string' || !d.reference.trim()) return null
  const montant = typeof d.montant_ttc === 'number' && Number.isFinite(d.montant_ttc) ? d.montant_ttc : undefined
  return {
    type: d.type,
    reference: d.reference,
    ...(montant !== undefined ? { montant_ttc: montant } : {}),
    description: typeof d.description === 'string' ? d.description : '',
    date: typeof d.date === 'string' ? d.date : '',
  }
}

// ── Notifications du prestataire ────────────────────────────────────────────────

interface NotificationLue {
  type?: string | null
  data_json?: unknown
}

/**
 * Une notification 'new_mission' qui accompagne un ordre de mission (validation dans le
 * Syndic v54, assign-mission) ouvre la Messagerie, où l'ordre s'accepte ; les autres
 * missions (planning) restent sur l'Agenda. data_json peut arriver en texte JSON.
 */
export function notificationOuvreMessagerie(n: NotificationLue): boolean {
  if (n.type !== 'new_mission') return false
  let data: unknown = n.data_json
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return false // data_json illisible : navigation historique (Agenda)
    }
  }
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.message_type === 'ordre_mission' && typeof d.conversation_id === 'string' && d.conversation_id.length > 0
}
