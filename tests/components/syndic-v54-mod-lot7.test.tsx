import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SyndicDataContext } from '@/lib/syndic/v54/data-context'
import type { SyndicData } from '@/lib/syndic/v54/data-context'
import ModNPSPosIntervencao from '@/components/syndic-dashboard/v54/modules/ModNPSPosIntervencao'
import ModMod3Orcamentos from '@/components/syndic-dashboard/v54/modules/ModMod3Orcamentos'

/** Lot 7 (NPS, Obras) — câblage data réel. Anonyme → Empty (mod-nps) / preview (mod-3orcamentos). */

afterEach(cleanup)

const wrap = (value: Partial<SyndicData>, ui: ReactNode) =>
  render(<SyndicDataContext.Provider value={{ authenticated: true, loading: false, token: 't', refresh: vi.fn(), ...value } as SyndicData}>{ui}</SyndicDataContext.Provider>)

describe('Lot 7 — câblage data réel', () => {
  it('ModNPSPosIntervencao : réponses réelles + état vide', () => {
    wrap({ nps: [{ id: 'n1', prestador: 'EletroPorto', condomino: 'X · 2B', intervencao: 'Reparação elétrica', tipo: 'elétrica', nota: 9, comentario: 'Ótimo serviço' }] }, <ModNPSPosIntervencao />)
    expect(screen.getByText('EletroPorto')).toBeInTheDocument()
    expect(screen.getByText('9/10')).toBeInTheDocument()
    cleanup()
    wrap({ nps: [] }, <ModNPSPosIntervencao />)
    expect(screen.getByText('Nenhum inquérito enviado ainda')).toBeInTheDocument()
  })

  it('ModMod3Orcamentos : obras réelles groupées par estado (pas la preview)', () => {
    wrap({ obras: [{ id: 'o1', titulo: 'Substituição do elevador', tipo: 'Renovação', descricao: 'Troca completa', local: 'Ed. A', prazo: '2026-10-01', estado: 'execucao', orcamento: 45000, empresa: 'LiftPro', numOrcamentos: 3 }] }, <ModMod3Orcamentos />)
    expect(screen.getByText('Substituição do elevador')).toBeInTheDocument()
    expect(screen.queryByText('Impermeabilização da cobertura')).not.toBeInTheDocument()
  })
})
