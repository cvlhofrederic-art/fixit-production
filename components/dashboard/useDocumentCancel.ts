'use client'

import { useState, useCallback } from 'react'

// FR-V1 — Hook partagé entre FacturesSection et DevisSection pour gérer le
// flow d'annulation : brouillon → hard delete localStorage ; émis → modal.
// Évite de dupliquer la logique de manipulation localStorage et d'état.

export interface CancellableDoc {
  docNumber?: string
  status?: string
}

// FR-V1.1 — paramétré par docType pour éviter le bug "doc fantôme"
// (cf. audit code-reviewer #16). Pour facture, l'état émis se reconnaît à
// 'pending'/'paid'/'overdue'/'cancelled'/'refunded' (DB EN) ou 'paye'/
// 'en_retard'/'annule'/'rembourse' (localStorage FR).
const DEVIS_EMITTED = new Set([
  'sent', 'signed', 'expired', 'cancelled',
  'envoye', 'signe', 'expire', 'annule',
])
const FACTURE_EMITTED = new Set([
  'pending', 'paid', 'overdue', 'cancelled', 'refunded',
  'paye', 'en_retard', 'annule', 'rembourse',
])

export function isDocDraftStatus(
  status: string | undefined,
  docType: 'devis' | 'facture',
): boolean {
  if (!status) return true
  const emitted = docType === 'devis' ? DEVIS_EMITTED : FACTURE_EMITTED
  return !emitted.has(status)
}

interface UseDocumentCancelOptions<T extends CancellableDoc> {
  artisanId: string | undefined
  /** Type de document — déterminé l'enum DB pour isDocDraftStatus + autorise
   *  la modal côté caller (devis vs facture). */
  docType: 'devis' | 'facture'
  /** Identité unique d'un doc — par défaut comparaison par docNumber. */
  isSameDoc?: (a: T, b: T) => boolean
  /** Confirme la suppression brouillon ; retourner false annule. */
  confirmDraftDelete: (doc: T) => boolean
  /** Callback pour rafraîchir la liste après mutation. */
  setSavedDocuments: (docs: T[]) => void
}

interface UseDocumentCancelReturn<T extends CancellableDoc> {
  cancellingDoc: T | null
  setCancellingDoc: (doc: T | null) => void
  /** Appelé sur clic « Supprimer/Annuler » : route vers hard delete OU modal. */
  handleRemoveDoc: (doc: T) => void
  /** Appelé après succès API — marque le doc comme `annule` localement. */
  handleCancelled: () => void
}

/**
 * Logique partagée d'annulation/suppression pour les listes devis/facture.
 * Pas de hard delete côté DB — Supabase RLS refuse DELETE sur ces tables ;
 * la « suppression » brouillon retire seulement de localStorage côté client.
 */
export function useDocumentCancel<T extends CancellableDoc>(
  opts: UseDocumentCancelOptions<T>,
): UseDocumentCancelReturn<T> {
  const { artisanId, docType, isSameDoc, confirmDraftDelete, setSavedDocuments } = opts
  const [cancellingDoc, setCancellingDoc] = useState<T | null>(null)

  const matchDoc = (a: T, b: T): boolean => {
    if (isSameDoc) return isSameDoc(a, b)
    return Boolean(a.docNumber) && a.docNumber === b.docNumber
  }

  const handleRemoveDoc = useCallback((doc: T) => {
    if (isDocDraftStatus(doc.status, docType)) {
      if (!confirmDraftDelete(doc)) return
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisanId}`) || '[]') as T[]
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisanId}`) || '[]') as T[]
      const updDocs = docs.filter(d => !matchDoc(d, doc))
      const updDrafts = drafts.filter(d => !matchDoc(d, doc))
      localStorage.setItem(`fixit_documents_${artisanId}`, JSON.stringify(updDocs))
      localStorage.setItem(`fixit_drafts_${artisanId}`, JSON.stringify(updDrafts))
      setSavedDocuments([...updDocs, ...updDrafts])
      return
    }
    setCancellingDoc(doc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artisanId, docType, confirmDraftDelete, setSavedDocuments])

  const handleCancelled = useCallback(() => {
    if (!cancellingDoc) return
    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisanId}`) || '[]') as T[]
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisanId}`) || '[]') as T[]
    const mark = (d: T): T => matchDoc(d, cancellingDoc) ? ({ ...d, status: 'annule' } as T) : d
    const updDocs = docs.map(mark)
    const updDrafts = drafts.map(mark)
    localStorage.setItem(`fixit_documents_${artisanId}`, JSON.stringify(updDocs))
    localStorage.setItem(`fixit_drafts_${artisanId}`, JSON.stringify(updDrafts))
    setSavedDocuments([...updDocs, ...updDrafts])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancellingDoc, artisanId, setSavedDocuments])

  return { cancellingDoc, setCancellingDoc, handleRemoveDoc, handleCancelled }
}
