'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../primitives/toast'
import type { PillKind } from '../primitives/pill'
import type { IconName } from '@/lib/syndic/icon-names'
import { useMessages } from '@/lib/syndic/v54/i18n'
import type { V54Locale } from '@/lib/syndic/v54/i18n/locale'
import { HOOKS_MESSAGES, STATUTS_DOCUMENT, TYPES_DOCUMENT } from './i18n/hooks.messages'

/** Document Léa tel que renvoyé par GET /api/syndic/lea-documents. */
export interface LeaDocument {
  id: string
  filename: string
  mime_type: string
  size_bytes: number
  type: string
  status: 'pending' | 'processing' | 'processed' | 'error'
  immeuble_id: string | null
  tags: string[] | null
  uploaded_at: string
  processed_at: string | null
  error_message: string | null
  extracted_metadata: Record<string, unknown> | null
}

/** Métadonnées OCR extraites par Léa (P2) — sous-ensemble utilisé à l'affichage. */
export interface LeaDocMeta {
  fournisseur?: string
  summary_short?: string
  numero_facture?: string
  montant_ttc?: number
  date_doc?: string
}

/** Libellé du type de document (PT par défaut). */
export const docTypeLabel = (t: string, locale: V54Locale = 'pt-PT'): string =>
  TYPES_DOCUMENT[locale][t] ?? TYPES_DOCUMENT[locale].autre

/** Couleur du type de document, d'après le code (factures, procès-verbaux, devis, autres). */
export const docTypeKind = (t: string): PillKind => {
  if (t === 'facture_artisan' || t === 'facture_syndic') return 'sage'
  if (t === 'ata_ag' || t === 'pv_assemblee') return 'gold'
  if (t === 'devis') return 'amber'
  return 'rust'
}

export const docTypeIcon = (t: string): IconName => {
  const ICONS: Record<string, IconName> = {
    contrat: 'stamp',
    facture_artisan: 'clipboard',
    facture_syndic: 'clipboard',
    devis: 'pencil',
    ata_ag: 'key',
    pv_assemblee: 'key',
    rib: 'bank',
    releve_bancaire: 'bank',
    autre: 'doc',
  }
  return ICONS[t] ?? 'doc'
}

/** Libellé du statut de traitement Léa (PT par défaut). */
export const docStatusLabel = (s: LeaDocument['status'], locale: V54Locale = 'pt-PT'): string => STATUTS_DOCUMENT[locale][s] ?? s
export const docStatusKind = (s: LeaDocument['status']): PillKind =>
  s === 'processed' ? 'sage' : s === 'error' ? 'rust' : s === 'processing' ? 'amber' : 'gold'

/** ISO → JJ/MM/AA (format compact des tables v54). */
export const docDateShort = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`
}

interface UseLeaDocumentsResult {
  docs: LeaDocument[]
  loading: boolean
  refresh: () => Promise<void>
}

/**
 * Liste des documents Léa du cabinet (GET /api/syndic/lea-documents, limit 100).
 * Ne fetch que si `enabled` (typiquement data.authenticated) — anonyme conserve
 * la preview mock du module. Échecs réseau silencieux (le module reste utilisable).
 */
export function useLeaDocuments(opts: { enabled: boolean }): UseLeaDocumentsResult {
  const { enabled } = opts
  const [docs, setDocs] = useState<LeaDocument[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setDocs((cur) => (cur.length ? [] : cur))
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/syndic/lea-documents?limit=100')
      if (!res.ok) {
        setDocs([])
        return
      }
      const data = (await res.json()) as { documents?: LeaDocument[] }
      setDocs(Array.isArray(data.documents) ? data.documents : [])
    } catch {
      // réseau indisponible — garder l'état courant sans casser le rendu
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { docs, loading, refresh }
}

/** Référence minimale d'un document pour les actions (ouvrir / supprimer). */
export interface LeaDocRef { id: string; filename: string }

interface UseLeaDocActionsResult {
  /** Ouvre le document dans un nouvel onglet via une signed URL (10 min). */
  open: (id: string) => Promise<void>
  /** Document en attente de confirmation de suppression (null = aucune). */
  pending: LeaDocRef | null
  /** Arme la confirmation de suppression pour un document. */
  askDelete: (doc: LeaDocRef) => void
  /** Annule la confirmation de suppression. */
  cancelDelete: () => void
  /** Confirme et exécute la suppression (Storage + row) puis rafraîchit. */
  confirmDelete: () => Promise<void>
  busy: boolean
}

/**
 * Actions sur un document Léa : ouverture (signed URL) et suppression (avec
 * confirmation à deux temps via `pending`). Utilise les endpoints existants
 * GET/DELETE /api/syndic/lea-documents/[id]. `onChanged` rafraîchit la liste.
 */
export function useLeaDocActions(onChanged?: () => void): UseLeaDocActionsResult {
  const { push } = useToast()
  const t = useMessages(HOOKS_MESSAGES).documents
  const [pending, setPending] = useState<LeaDocRef | null>(null)
  const [busy, setBusy] = useState(false)

  const open = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/syndic/lea-documents/${id}`)
      if (!res.ok) {
        push({ kind: 'error', title: t.ouvertureImpossible, desc: t.indisponible })
        return
      }
      const data = (await res.json()) as { signed_url?: string }
      if (data.signed_url) window.open(data.signed_url, '_blank', 'noopener,noreferrer')
    } catch {
      push({ kind: 'error', title: t.erreurReseau, desc: t.ouvertureReseau })
    }
  }, [push, t])

  const confirmDelete = useCallback(async () => {
    if (!pending) return
    setBusy(true)
    try {
      const res = await fetch(`/api/syndic/lea-documents/${pending.id}`, { method: 'DELETE' })
      if (!res.ok) {
        push({ kind: 'error', title: t.erreurSuppression, desc: t.reessayerPlusTardPoint })
        return
      }
      push({ kind: 'success', title: t.supprime, desc: pending.filename })
      setPending(null)
      onChanged?.()
    } catch {
      push({ kind: 'error', title: t.erreurReseau, desc: t.suppressionReseau })
    } finally {
      setBusy(false)
    }
  }, [pending, push, onChanged, t])

  return {
    open,
    pending,
    askDelete: setPending,
    cancelDelete: () => setPending(null),
    confirmDelete,
    busy,
  }
}
