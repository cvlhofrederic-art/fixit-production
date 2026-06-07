import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SyndicDataContext } from '@/lib/syndic/v54/data-context'
import type { SyndicData } from '@/lib/syndic/v54/data-context'
import ModVotacaoOnline from '@/components/syndic-dashboard/v54/modules/ModVotacaoOnline'
import ModTrackerDelibs from '@/components/syndic-dashboard/v54/modules/ModTrackerDelibs'

/** Lot A interactivité — les onglets filtrent vraiment le contenu (Tabs contrôlés). */

afterEach(cleanup)

const wrap = (value: Partial<SyndicData>, ui: ReactNode) =>
  render(<SyndicDataContext.Provider value={{ authenticated: true, loading: false, token: 't', refresh: vi.fn(), ...value } as SyndicData}>{ui}</SyndicDataContext.Provider>)

describe('Lot A — onglets filtrants', () => {
  it('ModVotacaoOnline : onglet Histórico filtre les votações fermées', () => {
    wrap({ votacoes: [
      { id: 'a', titulo: 'Voto Ativo', descricao: '', edificio: '', estado: 'aberta', maioria: 'simples', artigo: '', prazo: '', permTotal: 1000, options: [] },
      { id: 'b', titulo: 'Voto Aprovado', descricao: '', edificio: '', estado: 'aprovada', maioria: 'simples', artigo: '', prazo: '', permTotal: 1000, options: [] },
    ] }, <ModVotacaoOnline />)
    expect(screen.getByText('Voto Ativo')).toBeInTheDocument()
    expect(screen.queryByText('Voto Aprovado')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Histórico/ }))
    expect(screen.getByText('Voto Aprovado')).toBeInTheDocument()
    expect(screen.queryByText('Voto Ativo')).not.toBeInTheDocument()
  })

  it('ModTrackerDelibs : onglet Concluídas filtre par estado', () => {
    wrap({ deliberacoes: [
      { id: 'a', deliberacao: 'Delib em curso', ag: '', responsavel: '', prazo: '', estado: 'em_curso', origem: 'manual' },
      { id: 'b', deliberacao: 'Delib concluida', ag: '', responsavel: '', prazo: '', estado: 'concluida', origem: 'manual' },
    ] }, <ModTrackerDelibs />)
    expect(screen.getByText('Delib em curso')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Concluídas/ }))
    expect(screen.getByText('Delib concluida')).toBeInTheDocument()
    expect(screen.queryByText('Delib em curso')).not.toBeInTheDocument()
  })
})
