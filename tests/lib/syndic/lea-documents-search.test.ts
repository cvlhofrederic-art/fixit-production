import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DocSearchHit } from '@/lib/syndic/lea-documents-search'

const embedMock = vi.fn()

vi.mock('@/lib/syndic/embed', () => ({
  embedText: embedMock,
}))

describe('lib/syndic/lea-documents-search', () => {
  beforeEach(() => {
    embedMock.mockReset()
  })

  describe('searchDocuments', () => {
    it('retourne [] si query trop courte (< 3 chars)', async () => {
      const { searchDocuments } = await import('@/lib/syndic/lea-documents-search')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = { rpc: vi.fn() } as any
      const result = await searchDocuments(supabase, 'cabinet-123', 'ab')
      expect(result).toEqual([])
      expect(supabase.rpc).not.toHaveBeenCalled()
      expect(embedMock).not.toHaveBeenCalled()
    })

    it('retourne [] si embedding échoue (best-effort)', async () => {
      embedMock.mockRejectedValueOnce(new Error('embed_failed'))
      const { searchDocuments } = await import('@/lib/syndic/lea-documents-search')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = { rpc: vi.fn() } as any
      const result = await searchDocuments(supabase, 'cabinet-123', 'facture plomberie Dupont')
      expect(result).toEqual([])
      expect(supabase.rpc).not.toHaveBeenCalled()
    })

    it('appelle RPC avec cabinet_id + embedding + locale FR par défaut', async () => {
      embedMock.mockResolvedValueOnce(Array(1024).fill(0.1))
      const rpcMock = vi.fn().mockResolvedValue({ data: [], error: null })
      const { searchDocuments } = await import('@/lib/syndic/lea-documents-search')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await searchDocuments({ rpc: rpcMock } as any, 'cabinet-123', 'facture plomberie')
      expect(rpcMock).toHaveBeenCalledWith('search_syndic_documents_hybrid', expect.objectContaining({
        p_cabinet_id: 'cabinet-123',
        query_text: 'facture plomberie',
        query_locale: 'french',
        match_count: 5,
      }))
    })

    it('utilise locale portuguese si opts.locale=pt', async () => {
      embedMock.mockResolvedValueOnce(Array(1024).fill(0.1))
      const rpcMock = vi.fn().mockResolvedValue({ data: [], error: null })
      const { searchDocuments } = await import('@/lib/syndic/lea-documents-search')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await searchDocuments({ rpc: rpcMock } as any, 'cabinet-123', 'fatura', { locale: 'pt' })
      expect(rpcMock).toHaveBeenCalledWith('search_syndic_documents_hybrid', expect.objectContaining({
        query_locale: 'portuguese',
      }))
    })

    it('retourne [] si RPC échoue', async () => {
      embedMock.mockResolvedValueOnce(Array(1024).fill(0.1))
      const rpcMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'rpc_failed' } })
      const { searchDocuments } = await import('@/lib/syndic/lea-documents-search')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await searchDocuments({ rpc: rpcMock } as any, 'cabinet-123', 'facture plomberie')
      expect(result).toEqual([])
    })
  })

  describe('formatSearchHitsForPrompt', () => {
    it('retourne chaîne vide si aucun hit', async () => {
      const { formatSearchHitsForPrompt } = await import('@/lib/syndic/lea-documents-search')
      expect(formatSearchHitsForPrompt([])).toBe('')
    })

    it('formate les hits avec metadata et snippet (FR)', async () => {
      const { formatSearchHitsForPrompt } = await import('@/lib/syndic/lea-documents-search')
      const hits: DocSearchHit[] = [{
        id: 'abc-123',
        filename: 'facture-plomberie.pdf',
        type: 'facture_artisan',
        status: 'processed',
        immeuble_id: null,
        uploaded_at: '2026-03-15T10:00:00Z',
        extracted_metadata: {
          fournisseur: 'Plomberie Dupont',
          date_doc: '2026-03-15',
          montant_ttc: 1250.5,
          numero_facture: 'FACT-007',
        },
        snippet: 'Réparation fuite … chaudière',
        vector_score: 0.9, bm25_score: 0.7, rrf_score: 0.05,
      }]
      const out = formatSearchHitsForPrompt(hits)
      expect(out).toContain('Documents comptables pertinents')
      expect(out).toContain('facture-plomberie.pdf')
      expect(out).toContain('Plomberie Dupont')
      expect(out).toContain('1250.5')
      expect(out).toContain('FACT-007')
      expect(out).toContain('Réparation fuite')
      expect(out).toContain('doc_id: abc-123')
    })

    it('localise le header en PT', async () => {
      const { formatSearchHitsForPrompt } = await import('@/lib/syndic/lea-documents-search')
      const hits: DocSearchHit[] = [{
        id: 'xyz', filename: 'fatura.pdf', type: 'facture_artisan',
        status: 'processed', immeuble_id: null, uploaded_at: '2026-03-15T10:00:00Z',
        extracted_metadata: null, snippet: null,
        vector_score: 0, bm25_score: 0, rrf_score: 0.01,
      }]
      const out = formatSearchHitsForPrompt(hits, 'pt')
      expect(out).toContain('Documentos contabilísticos relevantes')
    })
  })
})
