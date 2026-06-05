import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SyndicDataContext } from '@/lib/syndic/v54/data-context'
import type { SyndicData } from '@/lib/syndic/v54/data-context'
import ModVotacaoOnline from '@/components/syndic-dashboard/v54/modules/ModVotacaoOnline'
import ModMultiImoveis from '@/components/syndic-dashboard/v54/modules/ModMultiImoveis'

/** Lot 4 (VotacaoOnline, MultiImoveis) — câblage data réel. Anonyme → preview (d9) /
 * ErrorState (errorstate-multiimoveis) byte-exact couverts ailleurs. */

afterEach(cleanup)

const wrap = (value: Partial<SyndicData>, ui: ReactNode) =>
  render(<SyndicDataContext.Provider value={{ authenticated: true, loading: false, token: 't', refresh: vi.fn(), ...value } as SyndicData}>{ui}</SyndicDataContext.Provider>)

describe('Lot 4 — câblage data réel', () => {
  it('ModVotacaoOnline : vraies votações + permilagem dérivée + Empty', () => {
    wrap({ votacoes: [{ id: 'x1', titulo: 'Mudança de administrador', descricao: '', edificio: 'Ed. A', estado: 'aberta', maioria: 'qualificada', artigo: 'Art.° 1433.° CC', prazo: '2026-09-01', permTotal: 1000, options: [{ label: 'A favor', perm: 600 }, { label: 'Contra', perm: 100 }] }] }, <ModVotacaoOnline />)
    expect(screen.getByText('Mudança de administrador')).toBeInTheDocument()
    expect(screen.queryByText('Aprovação do orçamento anual 2026')).not.toBeInTheDocument()
    expect(screen.getByText('700 / 1000 permilagem')).toBeInTheDocument()
    cleanup()
    wrap({ votacoes: [] }, <ModVotacaoOnline />)
    expect(screen.getByText('Sem deliberações')).toBeInTheDocument()
  })

  it('ModMultiImoveis : portefeuille consolidé depuis data.immeubles', () => {
    wrap({ immeubles: [{ id: 'b1', nom: 'Residência Atlântico', adresse: 'Rua X', ville: 'Porto', codePostal: '4000', nbLots: 12, anneeConstruction: 2010, typeImmeuble: 'Habitação', gestionnaire: 'Síndico', nbInterventions: 0, budgetAnnuel: 50000, depensesAnnee: 30000 }] }, <ModMultiImoveis />)
    expect(screen.getByText('Residência Atlântico')).toBeInTheDocument()
    expect(screen.getByText('Porto')).toBeInTheDocument()
    expect(screen.getAllByText('60%').length).toBeGreaterThan(0)
  })
})
