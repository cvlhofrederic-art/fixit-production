// P1 Léa Documents — Panel collapsible avec drag & drop + liste paginée.
// Référence /api/syndic/lea-documents{,/upload,/[id]} (cf 20260521_lea_documents.sql).
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type Locale = 'fr' | 'pt'

type DocumentType =
  | 'facture_artisan' | 'facture_syndic' | 'devis' | 'contrat'
  | 'rib' | 'ata_ag' | 'releve_bancaire' | 'pv_assemblee' | 'autre'

type DocumentStatus = 'pending' | 'processing' | 'processed' | 'error'

interface ExtractedMetadata {
  date_doc?: string | null
  montant_ttc?: number | null
  montant_ht?: number | null
  fournisseur?: string | null
  numero_facture?: string | null
  iban?: string | null
  type_detected?: DocumentType | null
  summary_short?: string | null
}

interface DocumentRow {
  id: string
  filename: string
  mime_type: string
  size_bytes: number
  type: DocumentType
  status: DocumentStatus
  immeuble_id: string | null
  tags: string[]
  uploaded_at: string
  processed_at: string | null
  error_message: string | null
  extracted_metadata?: ExtractedMetadata | null
}

const TYPE_LABELS_FR: Record<DocumentType, string> = {
  facture_artisan: '🔧 Facture artisan',
  facture_syndic: '🏢 Facture syndic',
  devis: '📋 Devis',
  contrat: '📝 Contrat',
  rib: '🏦 RIB',
  ata_ag: '🗒️ Ata AG',
  releve_bancaire: '📊 Relevé bancaire',
  pv_assemblee: '🗳️ PV assemblée',
  autre: '📄 Autre',
}

const TYPE_LABELS_PT: Record<DocumentType, string> = {
  facture_artisan: '🔧 Fatura profissional',
  facture_syndic: '🏢 Fatura administrador',
  devis: '📋 Orçamento',
  contrat: '📝 Contrato',
  rib: '🏦 IBAN',
  ata_ag: '🗒️ Ata AG',
  releve_bancaire: '📊 Extrato bancário',
  pv_assemblee: '🗳️ Ata assembleia',
  autre: '📄 Outro',
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  locale: Locale
  immeubleId?: string
}

export default function LeaDocumentsPanel({ locale, immeubleId }: Props) {
  const [open, setOpen] = useState(false)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filterType, setFilterType] = useState<DocumentType | ''>('')
  const [docType, setDocType] = useState<DocumentType>('autre')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const labels = locale === 'pt' ? TYPE_LABELS_PT : TYPE_LABELS_FR
  const isPt = locale === 'pt'

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterType) params.set('type', filterType)
      if (immeubleId) params.set('immeuble_id', immeubleId)
      params.set('limit', '50')
      const res = await fetch(`/api/syndic/lea-documents?${params.toString()}`)
      if (!res.ok) throw new Error(`status_${res.status}`)
      const json = await res.json() as { documents: DocumentRow[] }
      setDocuments(json.documents)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [filterType, immeubleId])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return
    setUploading(true)
    let okCount = 0
    let failCount = 0
    for (const file of list) {
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('type', docType)
        if (immeubleId) form.append('immeuble_id', immeubleId)
        const res = await fetch('/api/syndic/lea-documents/upload', { method: 'POST', body: form })
        if (res.ok) okCount += 1
        else failCount += 1
      } catch {
        failCount += 1
      }
    }
    setUploading(false)
    if (okCount > 0) {
      toast.success(isPt
        ? `${okCount} documento(s) carregado(s)`
        : `${okCount} document(s) uploadé(s)`)
      void refresh()
    }
    if (failCount > 0) {
      toast.error(isPt
        ? `${failCount} falha(s) no upload`
        : `${failCount} échec(s) d'upload`)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer?.files?.length) void handleFiles(e.dataTransfer.files)
  }

  const onView = async (id: string) => {
    try {
      const res = await fetch(`/api/syndic/lea-documents/${id}`)
      if (!res.ok) throw new Error(`status_${res.status}`)
      const json = await res.json() as { signed_url: string }
      window.open(json.signed_url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error(isPt ? 'Não foi possível abrir o documento' : "Impossible d'ouvrir le document")
    }
  }

  const onDelete = async (id: string, filename: string) => {
    const confirmMsg = isPt
      ? `Eliminar ${filename} ?`
      : `Supprimer ${filename} ?`
    if (!window.confirm(confirmMsg)) return
    try {
      const res = await fetch(`/api/syndic/lea-documents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`status_${res.status}`)
      setDocuments(prev => prev.filter(d => d.id !== id))
      toast.success(isPt ? 'Documento eliminado' : 'Document supprimé')
    } catch {
      toast.error(isPt ? 'Erro ao eliminar' : 'Erreur lors de la suppression')
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-[#F7F4EE] transition"
        type="button"
      >
        📎 {isPt ? 'Documentos' : 'Documents'}
        {documents.length > 0 && (
          <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#C9A84C] text-white text-[10px] font-bold">
            {documents.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[420px] z-30 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#0D1B2E]">
              {isPt ? 'Os meus documentos contabilísticos' : 'Mes documents comptables'}
            </h3>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg" type="button" aria-label="close">×</button>
          </div>

          {/* Type sélecteur upload */}
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-gray-500 font-medium">{isPt ? 'Tipo' : 'Type'} :</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value as DocumentType)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              {(Object.keys(labels) as DocumentType[]).map(t => (
                <option key={t} value={t}>{labels[t]}</option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${dragging ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300 hover:bg-[#F7F4EE]'}`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={e => e.target.files && handleFiles(e.target.files)}
            />
            <div className="text-2xl mb-1">📥</div>
            <p className="text-xs text-gray-600">
              {uploading
                ? (isPt ? 'A carregar…' : 'Upload en cours…')
                : (isPt
                    ? 'Largue um PDF/imagem aqui ou clique para escolher'
                    : 'Glissez un PDF/image ici ou cliquez pour choisir')}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">PDF / PNG / JPG / WebP · 25 MB max</p>
          </div>

          {/* Filtre liste */}
          <div className="flex items-center gap-2 mt-3 mb-2">
            <label className="text-xs text-gray-500 font-medium">{isPt ? 'Filtrar' : 'Filtrer'} :</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as DocumentType | '')}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              <option value="">{isPt ? 'Todos os tipos' : 'Tous les types'}</option>
              {(Object.keys(labels) as DocumentType[]).map(t => (
                <option key={t} value={t}>{labels[t]}</option>
              ))}
            </select>
          </div>

          {/* Liste */}
          {loading ? (
            <p className="text-xs text-gray-500 text-center py-4">{isPt ? 'A carregar…' : 'Chargement…'}</p>
          ) : documents.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">
              {isPt ? 'Nenhum documento ainda. Faça upload do primeiro!' : 'Aucun document pour le moment. Uploadez-en un !'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {documents.map(doc => (
                <li key={doc.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#F7F4EE] transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{labels[doc.type]}</span>
                      {doc.status === 'pending' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{isPt ? 'Pendente' : 'En attente'}</span>}
                      {doc.status === 'processing' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{isPt ? 'A processar' : 'Traitement'}</span>}
                      {doc.status === 'processed' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">✓</span>}
                      {doc.status === 'error' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">!</span>}
                    </div>
                    <div className="text-xs text-gray-700 truncate" title={doc.filename}>{doc.filename}</div>
                    {doc.extracted_metadata && (doc.extracted_metadata.fournisseur || doc.extracted_metadata.montant_ttc != null || doc.extracted_metadata.date_doc) && (
                      <div className="text-[10px] text-[#0D1B2E] mt-0.5 truncate">
                        {doc.extracted_metadata.fournisseur && <span className="font-semibold">{doc.extracted_metadata.fournisseur}</span>}
                        {doc.extracted_metadata.montant_ttc != null && <span className="ml-1">· {doc.extracted_metadata.montant_ttc.toFixed(2)} €</span>}
                        {doc.extracted_metadata.date_doc && <span className="ml-1">· {doc.extracted_metadata.date_doc}</span>}
                      </div>
                    )}
                    {doc.extracted_metadata?.summary_short && (
                      <div className="text-[10px] text-gray-500 italic truncate" title={doc.extracted_metadata.summary_short}>
                        {doc.extracted_metadata.summary_short}
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400">
                      {formatBytes(doc.size_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR')}
                      {doc.status === 'error' && doc.error_message && <span className="ml-1 text-red-500" title={doc.error_message}>· {isPt ? 'erro' : 'erreur'}</span>}
                    </div>
                  </div>
                  <button onClick={() => onView(doc.id)} className="text-xs px-2 py-1 rounded bg-[#0D1B2E] text-white hover:bg-[#152338]" type="button">
                    {isPt ? 'Ver' : 'Voir'}
                  </button>
                  <button onClick={() => onDelete(doc.id, doc.filename)} className="text-xs px-1.5 py-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50" type="button" aria-label="delete">
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
