import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModElevadores from '@/components/syndic-dashboard/v54/modules/ModElevadores'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Elevador } from '@/lib/syndic/v54/api'

/** Étape d (batch d34) — byte-exact + Phase 3 : parc d'ascenseurs réel. */

afterEach(cleanup)

const elevador = (over: Partial<Elevador>): Elevador => ({
  id: 'e1', immeuble: 'Edifício Aurora', marca: 'Otis Gen2', categoria: 'habitacional', ema: 'Otis Manutenção',
  ultimaInspecao: '2024-06-01', proximaInspecao: '2030-06-01', estado: 'conforme', notes: '',
  ...over,
})

describe('ModElevadores', () => {
  it('rend le titre, le tableau vide et le workflow risco grave (mock/preview)', () => {
    render(<ModElevadores />)
    expect(screen.getByRole('heading', { name: 'Gestão de Elevadores', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum elevador registado. Registe o primeiro elevador.')).toBeInTheDocument()
    expect(screen.getByText('EMA deteta risco grave')).toBeInTheDocument()
    expect(screen.getByText('Administrador notifica Câmara')).toBeInTheDocument()
    cleanup()
  })

  it('Phase 3 : affiche le parc réel quand authentifié', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [],
      elevadores: [elevador({ immeuble: 'Edifício Real Lift', marca: 'Schindler 3300' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModElevadores /></SyndicDataContext.Provider>)
    expect(screen.getByText('Edifício Real Lift')).toBeInTheDocument()
    expect(screen.getByText('Schindler 3300')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum elevador registado. Registe o primeiro elevador.')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « + Registar elevador » → POST /api/syndic/elevadores + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ elevador: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [],
      elevadores: [], token: 'tok-e', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModElevadores /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Registar elevador/ }))
    fireEvent.change(screen.getByPlaceholderText('Nome do edifício'), { target: { value: 'Edifício Novo Lift' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/elevadores', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/elevadores')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ immeuble: 'Edifício Novo Lift', categoria: 'habitacional' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
