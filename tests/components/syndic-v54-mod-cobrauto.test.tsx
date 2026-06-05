// tests/components/syndic-v54-mod-cobrauto.test.tsx
//
// Module d17 : ModCobrAuto (KPIs + Tabs + état vide).
// Phase 3 : impayés réels (table syndic_impayes) — liste, relance (PATCH), ouverture (POST).

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import ModCobrAuto from '@/components/syndic-dashboard/v54/modules/ModCobrAuto'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Impaye } from '@/lib/syndic/v54/api'

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [], contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] }, impayes: [],
})

const imp = (over: Partial<Impaye>): Impaye => ({
  id: 'ip1', immeubleId: '', coproprioId: '', montant: 1200, nature: 'charges_courantes',
  depuis: '2026-01-01', derniereRelanceAt: '', nbRelances: 1, statut: 'ouvert', notes: '',
  ...over,
})

describe('syndic v54 — ModCobrAuto', () => {
  it('rend titre, KPIs, onglets et état vide', () => {
    render(<ModCobrAuto />)
    expect(screen.getByRole('heading', { name: 'Cobrança Automática · Juros & Sanções' })).toBeTruthy()
    expect(screen.getByText('Em curso de cobrança')).toBeTruthy()
    expect(screen.getByText('Recuperados')).toBeTruthy()
    expect(screen.getByText('Nenhum processo')).toBeTruthy()
  })

  it('Phase 3 : affiche les impayés réels quand authentifié', () => {
    const d: SyndicData = { ...base(), impayes: [imp({ montant: 3456, nature: 'travaux' })] }
    render(<SyndicDataContext.Provider value={d}><ModCobrAuto /></SyndicDataContext.Provider>)
    expect(screen.getByText('Obras')).toBeTruthy() // natureLabel(travaux)
    expect(screen.queryByText('Nenhum processo')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « Novo processo » → POST /api/syndic/impayes + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ impaye: {} }), { status: 200 }))
    const d: SyndicData = { ...base(), token: 'tok-imp', refresh }
    render(<SyndicDataContext.Provider value={d}><ModCobrAuto /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: /Novo processo/ })[0])
    fireEvent.change(screen.getByLabelText(/Montante/), { target: { value: '900' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir processo' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/impayes', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/impayes')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ montant: 900 })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })

  it('Phase 3 relance : « Relançar » → PATCH /api/syndic/impayes (nbRelances+1) + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ impaye: {} }), { status: 200 }))
    const d: SyndicData = { ...base(), token: 'tok-imp', refresh, impayes: [imp({ id: 'ipX', nbRelances: 2, statut: 'ouvert' })] }
    render(<SyndicDataContext.Provider value={d}><ModCobrAuto /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Relançar/ }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/impayes', expect.objectContaining({ method: 'PATCH' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/impayes')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ id: 'ipX', nbRelances: 3 })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
