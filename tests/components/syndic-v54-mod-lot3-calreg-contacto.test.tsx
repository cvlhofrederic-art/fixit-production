import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SyndicDataContext } from '@/lib/syndic/v54/data-context'
import type { SyndicData } from '@/lib/syndic/v54/data-context'
import ModCalReg from '@/components/syndic-dashboard/v54/modules/ModCalReg'
import ModContacto from '@/components/syndic-dashboard/v54/modules/ModContacto'

/** Lot 3 (CalReg, Contacto) — câblage data réel. Anonyme → preview/Empty byte-exact
 * couvert par modules-d6 (CalReg) + modules-d10 (Contacto). */

afterEach(cleanup)

const wrap = (value: Partial<SyndicData>, ui: ReactNode) =>
  render(<SyndicDataContext.Provider value={{ authenticated: true, loading: false, token: 't', refresh: vi.fn(), ...value } as SyndicData}>{ui}</SyndicDataContext.Provider>)

describe('Lot 3 — câblage data réel', () => {
  it('ModCalReg : vraies obrigações (pas la preview), état vide + modal', () => {
    wrap({ obrigacoes: [{ id: 'o1', edificio: 'Ed. Teste', tipo: 'Inspeção gás', descricao: 'Inspeção quinquenal gás', prazo: '2027-01-01', concluido: false }] }, <ModCalReg />)
    expect(screen.getByText('Inspeção quinquenal gás')).toBeInTheDocument()
    expect(screen.queryByText('AG Anual obrigatória')).not.toBeInTheDocument()
    cleanup()
    wrap({ obrigacoes: [] }, <ModCalReg />)
    expect(screen.getByText('Sem obrigações registadas')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar obrigação/ })[0])
    expect(screen.getByLabelText(/Tipo/)).toBeInTheDocument()
  })

  it('ModContacto : vraies campanhas du cabinet + état vide', () => {
    wrap({ campanhas: [{ id: 'k1', nome: 'Aviso fachada junho', tipo: 'aviso', edificio: 'Ed. A', destinatarios: 24, estado: 'enviada', mensagem: '' }] }, <ModContacto />)
    expect(screen.getByText('Aviso fachada junho')).toBeInTheDocument()
    cleanup()
    wrap({ campanhas: [] }, <ModContacto />)
    expect(screen.getByText('Sem campanhas')).toBeInTheDocument()
  })
})
