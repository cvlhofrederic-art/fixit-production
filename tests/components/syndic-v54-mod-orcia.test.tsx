// tests/components/syndic-v54-mod-orcia.test.tsx
//
// Module d23 : ModOrcIA (KPIs + paramètres de génération + état vide).
// Phase 3 (lot IA) : générateur câblé à l'agent Léa (lea-comptable).

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import ModOrcIA from '@/components/syndic-dashboard/v54/modules/ModOrcIA'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'

afterEach(cleanup)

describe('syndic v54 — ModOrcIA', () => {
  it('rend titre, KPIs, paramètres et état vide', () => {
    render(<ModOrcIA />)
    expect(screen.getByRole('heading', { name: 'Orçamento Anual com IA' })).toBeTruthy()
    expect(screen.getByText('Total Orçamentos')).toBeTruthy()
    expect(screen.getByText('Parâmetros de Geração')).toBeTruthy()
    expect(screen.getByLabelText('Edifício')).toBeTruthy()
    expect(screen.getByText('Gere o seu primeiro orçamento com IA')).toBeTruthy()
  })

  it('Phase 3 : « Gerar » appelle l\'agent Léa (/api/syndic/lea-comptable) et affiche le résultat', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ response: 'ORÇAMENTO IA: total previsto 14 200€ · fundo reserva 1 420€' }), { status: 200 }))
    const d: SyndicData = { authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], token: 'tok-orcia' }
    render(<SyndicDataContext.Provider value={d}><ModOrcIA /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Gerar Orçamento 2027/ }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/lea-comptable', expect.objectContaining({ method: 'POST' })))
    await screen.findByText(/ORÇAMENTO IA: total previsto/)
    vi.restoreAllMocks()
  })
})
