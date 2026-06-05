import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModSegEdificio from '@/components/syndic-dashboard/v54/modules/ModSegEdificio'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { SegEdificio } from '@/lib/syndic/v54/api'

/** Étape d (batch d34) — byte-exact + Phase 3 : classifications SCIE réelles. */

afterEach(cleanup)

const seg = (over: Partial<SegEdificio>): SegEdificio => ({
  id: 's1', immeuble: 'Edifício Aurora', categoria: '3', encarregado: 'João Silva',
  planoEmergencia: true, ultimoExercicio: '2026-03-01', notes: '',
  ...over,
})

describe('ModSegEdificio', () => {
  it('rend le titre, l\'Empty et les catégories de risque (preview)', () => {
    render(<ModSegEdificio />)
    expect(screen.getByRole('heading', { name: 'Segurança Contra Incêndio', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum edifício classificado')).toBeInTheDocument()
    expect(screen.getByText('Categoria 1 — Reduzido')).toBeInTheDocument()
    cleanup()
  })

  it('Phase 3 : affiche les classifications réelles quand authentifié', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [],
      segEdificios: [seg({ immeuble: 'Torre Real SCIE' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModSegEdificio /></SyndicDataContext.Provider>)
    expect(screen.getByText('Torre Real SCIE')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum edifício classificado')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « Classificar edifício » → POST /api/syndic/seg-edificio + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ segEdificio: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [],
      segEdificios: [], token: 'tok-se', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModSegEdificio /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Classificar edifício/ }))
    fireEvent.change(screen.getByPlaceholderText('Nome do edifício'), { target: { value: 'Edifício SCIE Novo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Classificar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/seg-edificio', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/seg-edificio')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ immeuble: 'Edifício SCIE Novo', categoria: '1' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
