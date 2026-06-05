import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SyndicDataContext } from '@/lib/syndic/v54/data-context'
import type { SyndicData } from '@/lib/syndic/v54/data-context'
import ModBenchmarking from '@/components/syndic-dashboard/v54/modules/ModBenchmarking'

/** Lot 5 — ModBenchmarking : ranking dérivé de data.immeubles (aucune table).
 * Anonyme → preview byte-exact couvert par modules-d57. */

afterEach(cleanup)

const im = (o: Partial<{ id: string; nom: string; nbLots: number; nbInterventions: number; budgetAnnuel: number; depensesAnnee: number }>) =>
  ({ id: 'x', nom: '', adresse: '', ville: 'Porto', codePostal: '', nbLots: 10, anneeConstruction: 2010, typeImmeuble: '', gestionnaire: '', nbInterventions: 0, budgetAnnuel: 40000, depensesAnnee: 20000, ...o })

const wrap = (value: Partial<SyndicData>, ui: ReactNode) =>
  render(<SyndicDataContext.Provider value={{ authenticated: true, loading: false, token: 't', refresh: vi.fn(), ...value } as SyndicData}>{ui}</SyndicDataContext.Provider>)

describe('Lot 5 — ModBenchmarking câblage réel', () => {
  it('ranking dérivé des immeubles réels (pas la preview) + état vide', () => {
    wrap({ immeubles: [im({ id: 'a', nom: 'Torre Alfa', nbInterventions: 1, budgetAnnuel: 40000, depensesAnnee: 20000 }), im({ id: 'b', nom: 'Torre Beta', nbInterventions: 9, budgetAnnuel: 20000, depensesAnnee: 19500 })] }, <ModBenchmarking />)
    expect(screen.getAllByText('Torre Alfa').length).toBeGreaterThan(0)
    expect(screen.getByText('Torre Beta')).toBeInTheDocument()
    expect(screen.queryByText('Edifício Aurora')).not.toBeInTheDocument()
    expect(screen.getByText('Melhor performance')).toBeInTheDocument()
    cleanup()
    wrap({ immeubles: [] }, <ModBenchmarking />)
    expect(screen.getByText('Sem edifícios para comparar')).toBeInTheDocument()
  })
})
