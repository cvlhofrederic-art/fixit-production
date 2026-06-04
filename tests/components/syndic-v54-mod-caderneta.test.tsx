import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModCadernetaMan from '@/components/syndic-dashboard/v54/modules/ModCadernetaMan'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Caderneta } from '@/lib/syndic/v54/api'

/** Phase 3 slice 12 — byte-exact preview + caderneta réelle + écriture POST. */

afterEach(cleanup)

const cad = (over: Partial<Caderneta>): Caderneta => ({
  id: 'c1', data: '2026-05-10', estado: 'realizado', natureza: 'reparacao',
  edificio: 'Edifício Aurora', localizacao: 'Bloco A', prestador: 'EletroPorto',
  custo: 480, garantia: '2 anos', cee: 'na', notas: '',
  ...over,
})

describe('ModCadernetaMan', () => {
  it('rend le titre et l\'Empty (preview anonyme)', () => {
    render(<ModCadernetaMan />)
    expect(screen.getByRole('heading', { name: 'Caderneta de Manutenção & Técnica', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Caderneta vazia')).toBeInTheDocument()
    cleanup()
  })

  it('Phase 3 : affiche les interventions réelles quand authentifié', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [],
      caderneta: [cad({ edificio: 'Torre Real Caderneta' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModCadernetaMan /></SyndicDataContext.Provider>)
    expect(screen.getByText('Torre Real Caderneta')).toBeInTheDocument()
    expect(screen.queryByText('Caderneta vazia')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « + Intervenção » → POST /api/syndic/caderneta + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ caderneta: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [],
      caderneta: [], token: 'tok-cad', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModCadernetaMan /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /\+ Intervenção/ }))
    fireEvent.change(screen.getByDisplayValue('Escolher…'), { target: { value: 'reparacao' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/caderneta', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/caderneta')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ natureza: 'reparacao', estado: 'realizado' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
