import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ModReembolsos from '@/components/syndic-dashboard/v54/modules/ModReembolsos'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Reembolso } from '@/lib/syndic/v54/api'

/** Les onglets Pendentes/Liquidados/Todos filtrent vraiment la table par statut. */

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const reb = (over: Partial<Reembolso>): Reembolso => ({ id: 'r1', immeuble: 'Edifício A', antigoProprietario: 'Ana Silva', fracao: 'B', dataVenda: '2026-05-01', quotasPagas: 100, montanteReembolso: 50, metodo: 'OpenBanking', statut: 'pendente', notes: '', ...over })

const data = (rows: Reembolso[]): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], reembolsos: rows })

describe('Reembolsos — onglets filtrants', () => {
  it('défaut « Pendentes » + onglet « Liquidados » filtrent par statut', () => {
    render(<SyndicDataContext.Provider value={data([
      reb({ id: 'p', antigoProprietario: 'Pendente Person', statut: 'pendente' }),
      reb({ id: 'l', antigoProprietario: 'Liquidado Person', statut: 'liquidado' }),
    ])}><ModReembolsos /></SyndicDataContext.Provider>)
    expect(screen.getByText('Pendente Person')).toBeInTheDocument()
    expect(screen.queryByText('Liquidado Person')).toBeNull()
    fireEvent.click(screen.getByText('Liquidados'))
    expect(screen.getByText('Liquidado Person')).toBeInTheDocument()
    expect(screen.queryByText('Pendente Person')).toBeNull()
  })
})
