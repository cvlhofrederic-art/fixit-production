import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SyndicDataContext } from '@/lib/syndic/v54/data-context'
import type { SyndicData } from '@/lib/syndic/v54/data-context'
import ModPontuacao from '@/components/syndic-dashboard/v54/modules/ModPontuacao'

/** Lot 6 — ModPontuacao : score de saúde dérivé de data.immeubles (aucune table).
 * Anonyme / vide → statique byte-exact couvert par mod-pontuacao. */

afterEach(cleanup)

const im = (o: Partial<{ id: string; nom: string; nbLots: number; nbInterventions: number; budgetAnnuel: number; depensesAnnee: number }>) =>
  ({ id: 'x', nom: '', adresse: '', ville: 'Porto', codePostal: '', nbLots: 10, anneeConstruction: 2010, typeImmeuble: '', gestionnaire: '', nbInterventions: 0, budgetAnnuel: 40000, depensesAnnee: 20000, ...o })

const wrap = (value: Partial<SyndicData>, ui: ReactNode) =>
  render(<SyndicDataContext.Provider value={{ authenticated: true, loading: false, token: 't', refresh: vi.fn(), ...value } as SyndicData}>{ui}</SyndicDataContext.Provider>)

describe('Lot 6 — ModPontuacao câblage réel', () => {
  it('scores dérivés des immeubles réels (pas le statique vide)', () => {
    wrap({ immeubles: [im({ id: 'a', nom: 'Torre Alfa', nbInterventions: 1, budgetAnnuel: 40000, depensesAnnee: 20000 })] }, <ModPontuacao />)
    expect(screen.getAllByText('Torre Alfa').length).toBeGreaterThan(0)
    expect(screen.queryByText('Nenhum edifício')).not.toBeInTheDocument()
    cleanup()
    wrap({ immeubles: [] }, <ModPontuacao />)
    expect(screen.getByText('Nenhum edifício')).toBeInTheDocument()
    expect(screen.getByText('Tudo em ordem!')).toBeInTheDocument()
  })
})
