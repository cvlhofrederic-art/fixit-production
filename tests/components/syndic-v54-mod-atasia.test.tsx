import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModAtasIA from '@/components/syndic-dashboard/v54/modules/ModAtasIA'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'

/** Phase 3 (lot IA) — ModAtasIA : génération d'ata câblée à l'agent Alfredo (alfredo-chat). */

afterEach(cleanup)

describe('ModAtasIA', () => {
  it('rend le CTA byte-exact par défaut', () => {
    render(<ModAtasIA />)
    expect(screen.getByRole('heading', { name: /Atas com IA/ })).toBeInTheDocument()
    expect(screen.getByText('Gerar uma nova ata')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Começar do zero/ })).toBeInTheDocument()
  })

  it('Phase 3 : « Começar do zero » → notas → génère via /api/syndic/alfredo-chat + affiche l\'ata', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: 'ATA DE ASSEMBLEIA Nº 1 — Reunidos os condóminos…' }), { status: 200 }))
    const d: SyndicData = { authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], token: 'tok-atas' }
    render(<SyndicDataContext.Provider value={d}><ModAtasIA /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Começar do zero/ }))
    fireEvent.change(screen.getByPlaceholderText(/Aprovação das contas/), { target: { value: '1. Contas 2025\n2. Orçamento 2026' } })
    fireEvent.click(screen.getByRole('button', { name: /Gerar ata com IA/ }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/alfredo-chat', expect.objectContaining({ method: 'POST' })))
    await screen.findByText(/ATA DE ASSEMBLEIA Nº 1/)
    vi.restoreAllMocks()
  })
})
