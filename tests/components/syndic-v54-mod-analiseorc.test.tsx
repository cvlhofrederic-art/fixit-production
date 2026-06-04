import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModAnaliseOrc from '@/components/syndic-dashboard/v54/modules/ModAnaliseOrc'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'

/** Phase 3 (lot IA) — ModAnaliseOrc : analyse de texte câblée à l'agent Léa (lea-comptable). */

afterEach(cleanup)

describe('ModAnaliseOrc', () => {
  it('rend le titre, les features et le dépôt PDF (preview byte-exact, onglet par défaut)', () => {
    render(<ModAnaliseOrc />)
    expect(screen.getByRole('heading', { name: /Análise Orçamentos & Faturas/ })).toBeInTheDocument()
    expect(screen.getByText('Conformidade jurídica')).toBeInTheDocument()
    expect(screen.getByText('Arraste o seu PDF aqui')).toBeInTheDocument()
  })

  it('Phase 3 : « Inserir o texto » → analyse via /api/syndic/lea-comptable + résultat affiché', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ response: 'ANÁLISE IA: NIF válido, IVA 23%, seguro RC em falta — risco de litígio médio.' }), { status: 200 }))
    const d: SyndicData = { authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], token: 'tok-ao' }
    render(<SyndicDataContext.Provider value={d}><ModAnaliseOrc /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('tab', { name: /Inserir o texto/ }))
    fireEvent.change(screen.getByPlaceholderText(/Cole aqui o texto/), { target: { value: 'Orçamento limpeza 2026: 4800€ + IVA' } })
    fireEvent.click(screen.getByRole('button', { name: /Analisar o documento/ }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/lea-comptable', expect.objectContaining({ method: 'POST' })))
    await screen.findByText(/ANÁLISE IA: NIF válido/)
    vi.restoreAllMocks()
  })
})
