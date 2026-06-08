'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PillKind } from '../primitives/pill'
import type { IconName } from '@/lib/syndic/icon-names'

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

const TYPE_LABEL: Record<string, string> = {
  facture_artisan: 'Fatura',
  facture_syndic: 'Fatura',
  devis: 'Orçamento',
  contrat: 'Contrato',
  rib: 'RIB',
  ata_ag: 'Ata Assembleia',
  releve_bancaire: 'Extrato bancário',
  pv_assemblee: 'Ata Assembleia',
  autre: 'Documento',
}
export const docTypeLabel = (t: string): string => TYPE_LABEL[t] ?? 'Documento'

export const docTypeKind = (t: string): PillKind => {
  const l = docTypeLabel(t)
  if (l === 'Fatura') return 'sage'
  if (l.includes('Ata')) return 'gold'
  if (l === 'Orçamento') return 'amber'
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

const STATUS_LABEL: Record<LeaDocument['status'], string> = {
  pending: 'Em fila',
  processing: 'A processar',
  processed: 'Processado',
  error: 'Erro',
}
export const docStatusLabel = (s: LeaDocument['status']): string => STATUS_LABEL[s] ?? s
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
