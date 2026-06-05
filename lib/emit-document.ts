// Émission directe d'un document (méthode pro 2026).
//
// Tire le numéro légal SEULEMENT à l'émission (un brouillon n'en consomme aucun,
// art. 242 nonies A I 2° CGI), fige le statut « envoye », persiste dans
// fixit_documents_<artisan> (dédup par id), retire des brouillons et synchronise
// la DB. Source unique du flux « Émettre l'acompte » (FacturesSection).
//
// Miroir de la logique saveAndSend du form BTP (DevisFactureFormBTP) — GARDER LES
// DEUX ALIGNÉS : mêmes clés localStorage, même statut, même sync.

export interface EmitDocumentOptions {
  /** Document prêt à émettre (brouillon scalé : acompte au %, TVA conservées). */
  payload: Record<string, unknown>
  artisanId: string
  /** Tire le numéro légal définitif (cf. lib/doc-number.fetchNextDocNumber). */
  getNumber: () => Promise<string>
  /** Sync DB (cf. lib/document-sync.syncDocumentSafe). Optionnel pour les tests. */
  sync?: (doc: Record<string, unknown>, artisanId: string) => void
  /** Horodatage injectable (tests). Défaut : maintenant. */
  nowIso?: string
}

function safeArray(raw: string | null): Array<Record<string, unknown>> {
  try {
    const v = JSON.parse(raw || '[]')
    return Array.isArray(v)
      ? v.filter((d): d is Record<string, unknown> => d != null && typeof d === 'object')
      : []
  } catch {
    return []
  }
}

export async function emitDocument(opts: EmitDocumentOptions): Promise<Record<string, unknown>> {
  const { payload, artisanId, getNumber, sync } = opts

  // Numéro définitif : tiré seulement si le doc n'en a pas (vide) ou porte un
  // numéro provisoire BR- (brouillon). Un numéro déjà légal n'est jamais réécrit.
  const provisional = String(payload.docNumber || '')
  const docNumber = (!provisional || provisional.toUpperCase().startsWith('BR-'))
    ? await getNumber()
    : provisional

  const now = opts.nowIso || new Date().toISOString()
  const finalDoc: Record<string, unknown> = {
    ...payload,
    docNumber,
    status: 'envoye',
    savedAt: now,
    sentAt: now,
  }

  // Persistance : (ré)insère dans les documents émis (dédup par id), retire des brouillons.
  const docsKey = `fixit_documents_${artisanId}`
  const docs = safeArray(localStorage.getItem(docsKey))
  localStorage.setItem(docsKey, JSON.stringify([...docs.filter(d => d.id !== finalDoc.id), finalDoc]))

  const draftsKey = `fixit_drafts_${artisanId}`
  const drafts = safeArray(localStorage.getItem(draftsKey))
  localStorage.setItem(draftsKey, JSON.stringify(drafts.filter(d => d.id !== finalDoc.id)))

  sync?.(finalDoc, artisanId)
  return finalDoc
}
