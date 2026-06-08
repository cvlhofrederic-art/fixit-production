import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModDocsGED from '@/components/syndic-dashboard/v54/modules/ModDocsGED'
import ModDocsInterv from '@/components/syndic-dashboard/v54/modules/ModDocsInterv'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { LeaDocument } from '@/components/syndic-dashboard/v54/modules/use-lea-documents'

/**
 * Chemin authentifié : GED + DocsInterv affichent les vrais documents Léa du
 * cabinet (GET /api/syndic/lea-documents) au lieu du mock de preview.
 */

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const authed: SyndicData = { authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [] }

const doc = (over: Partial<LeaDocument>): LeaDocument => ({
  id: 'd1', filename: 'fatura-x.pdf', mime_type: 'application/pdf', size_bytes: 1000,
  type: 'facture_artisan', status: 'processed', immeuble_id: null, tags: null,
  uploaded_at: '2026-06-01T10:00:00.000Z', processed_at: '2026-06-01T10:01:00.000Z',
  error_message: null, extracted_metadata: { fournisseur: 'HidroPro' },
  ...over,
})

function mockDocs(docs: LeaDocument[]) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ documents: docs, total: docs.length }), { status: 200 }))
}

describe('GED / DocsInterv — liste live Léa', () => {
  it('GED authentifié affiche les vrais documents + statut OCR', async () => {
    mockDocs([
      doc({ id: 'a', filename: 'Contrato Limpezas.pdf', type: 'contrat', status: 'processed' }),
      doc({ id: 'b', filename: 'Fatura pendente.pdf', type: 'facture_syndic', status: 'processing' }),
    ])
    render(<SyndicDataContext.Provider value={authed}><ModDocsGED /></SyndicDataContext.Provider>)
    expect(await screen.findByText('Contrato Limpezas.pdf')).toBeInTheDocument()
    expect(screen.getByText('Fatura pendente.pdf')).toBeInTheDocument()
    // le statut de traitement OCR en cours est visible
    expect(screen.getByText('A processar')).toBeInTheDocument()
    // la preview mock anonyme ne doit plus apparaître
    expect(screen.queryByText('Ata AG Anual 2026 - Edifício Atlântico.pdf')).toBeNull()
  })

  it('GED authentifié sans documents → état vide (jamais le mock)', async () => {
    mockDocs([])
    render(<SyndicDataContext.Provider value={authed}><ModDocsGED /></SyndicDataContext.Provider>)
    expect(await screen.findByText('Nenhum documento')).toBeInTheDocument()
    expect(screen.queryByText('Ata AG Anual 2026 - Edifício Atlântico.pdf')).toBeNull()
  })

  it('DocsInterv ne montre que les documents de intervenção (filtre type)', async () => {
    mockDocs([
      doc({ id: 'f', filename: 'Fatura artisan.pdf', type: 'facture_artisan' }),
      doc({ id: 'o', filename: 'Orcamento obra.pdf', type: 'devis' }),
      doc({ id: 'c', filename: 'Contrato seguro.pdf', type: 'contrat' }),
    ])
    render(<SyndicDataContext.Provider value={authed}><ModDocsInterv /></SyndicDataContext.Provider>)
    expect(await screen.findByText('Fatura artisan.pdf')).toBeInTheDocument()
    expect(screen.getByText('Orcamento obra.pdf')).toBeInTheDocument()
    // un contrat n'est pas un document de intervenção → exclu
    expect(screen.queryByText('Contrato seguro.pdf')).toBeNull()
  })
})
