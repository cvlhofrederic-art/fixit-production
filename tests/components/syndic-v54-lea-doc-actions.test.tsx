import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModDocsGED from '@/components/syndic-dashboard/v54/modules/ModDocsGED'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { LeaDocument } from '@/components/syndic-dashboard/v54/modules/use-lea-documents'

/** Actions sur un document Léa depuis la liste GED : ouvrir (signed URL) + supprimer (confirm → DELETE). */

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const authed: SyndicData = { authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [] }

const doc: LeaDocument = {
  id: 'doc-42', filename: 'fatura.pdf', mime_type: 'application/pdf', size_bytes: 1000,
  type: 'facture_artisan', status: 'processed', immeuble_id: null, tags: null,
  uploaded_at: '2026-06-01T10:00:00.000Z', processed_at: null, error_message: null, extracted_metadata: null,
}

function setupFetch() {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (typeof url === 'string' && url.includes('limit=100')) return Promise.resolve(new Response(JSON.stringify({ documents: [doc] }), { status: 200 }))
    if (init?.method === 'DELETE') return Promise.resolve(new Response(JSON.stringify({ deleted: true, id: 'doc-42' }), { status: 200 }))
    return Promise.resolve(new Response(JSON.stringify({ signed_url: 'https://signed.example/doc-42' }), { status: 200 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('GED — actions document', () => {
  it('Abrir → GET signed URL + window.open', async () => {
    const fetchMock = setupFetch()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<SyndicDataContext.Provider value={authed}><ModDocsGED /></SyndicDataContext.Provider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir documento' }))
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('https://signed.example/doc-42', '_blank', 'noopener,noreferrer'))
    expect(fetchMock).toHaveBeenCalledWith('/api/syndic/lea-documents/doc-42')
  })

  it('Eliminar → confirmation puis DELETE', async () => {
    const fetchMock = setupFetch()
    render(<SyndicDataContext.Provider value={authed}><ModDocsGED /></SyndicDataContext.Provider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar documento' }))
    expect(await screen.findByText(/irreversível/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/syndic/lea-documents/doc-42', { method: 'DELETE' }))
  })
})
