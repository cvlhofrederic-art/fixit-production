import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModQuadroAvisos from '@/components/syndic-dashboard/v54/modules/ModQuadroAvisos'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Aviso } from '@/lib/syndic/v54/api'

/** Étape d (batch d48) — byte-exact + Phase 3 : avisos réels. */

afterEach(cleanup)

const aviso = (over: Partial<Aviso>): Aviso => ({
  id: 'a1', immeuble: 'Edifício Aurora', titulo: 'Corte de água', descricao: 'Manutenção',
  categoria: 'manutencao', prioridade: 'urgente', fixado: true, views: 12, createdAt: '2026-05-01T10:00:00Z',
  ...over,
})

describe('ModQuadroAvisos', () => {
  it('rend le titre, les avisos mock et les panneaux (preview)', () => {
    render(<ModQuadroAvisos />)
    expect(screen.getByRole('heading', { name: 'Quadro de Avisos', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Corte de água — Manutenção urgente da canalização')).toBeInTheDocument()
    expect(screen.getByText('Distribuição por Categoria')).toBeInTheDocument()
    cleanup()
  })

  it('Phase 3 : affiche les vrais avisos du cabinet quand authentifié', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [],
      avisos: [aviso({ titulo: 'Aviso Real Importante' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModQuadroAvisos /></SyndicDataContext.Provider>)
    expect(screen.getByText('Aviso Real Importante')).toBeInTheDocument()
    expect(screen.queryByText('Corte de água — Manutenção urgente da canalização')).toBeNull()
    cleanup()
  })

  it('Phase 3 écriture : « Novo Aviso » → POST /api/syndic/avisos + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ aviso: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [],
      avisos: [], token: 'tok-a', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModQuadroAvisos /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Novo Aviso/ }))
    fireEvent.change(screen.getByPlaceholderText('Ex.: Corte de água programado'), { target: { value: 'Limpeza geral sábado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/avisos', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/avisos')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ titulo: 'Limpeza geral sábado' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
    cleanup()
  })
})
