import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SyndicDataContext } from '@/lib/syndic/v54/data-context'
import type { SyndicData } from '@/lib/syndic/v54/data-context'
import ModPlanoMan from '@/components/syndic-dashboard/v54/modules/ModPlanoMan'
import ModTrackerDelibs from '@/components/syndic-dashboard/v54/modules/ModTrackerDelibs'
import ModNotificJud from '@/components/syndic-dashboard/v54/modules/ModNotificJud'

/** Lot 2 « gestão » (PlanoMan, TrackerDelibs, NotificJud) — câblage data réel.
 * Connecté → vraies données du cabinet + Empty + modal. (Anonyme → Empty byte-exact :
 * couvert par mod-{planomã via d10, trackerdelibs, notificjud}.) */

afterEach(cleanup)

const wrap = (value: Partial<SyndicData>, ui: ReactNode) =>
  render(<SyndicDataContext.Provider value={{ authenticated: true, loading: false, token: 't', refresh: vi.fn(), ...value } as SyndicData}>{ui}</SyndicDataContext.Provider>)

describe('Lot 2 gestão — câblage data réel', () => {
  it('ModPlanoMan : vrais plans, état vide + modal', () => {
    wrap({ planosMan: [{ id: 'p1', titulo: 'Conservação fachada norte', edificio: 'Ed. A', estado: 'aprovado', orcamento: 12000, anoInicio: 2026, periodicidade: '8 anos', descricao: '' }] }, <ModPlanoMan />)
    expect(screen.getByText('Conservação fachada norte')).toBeInTheDocument()
    cleanup()
    wrap({ planosMan: [] }, <ModPlanoMan />)
    expect(screen.getByText('Nenhum plano de manutenção')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /Criar plano/ })[0])
    expect(screen.getByLabelText(/Título/)).toBeInTheDocument()
  })

  it('ModTrackerDelibs : vraies délibérations du cabinet', () => {
    wrap({ deliberacoes: [{ id: 'd1', deliberacao: 'Reparar telhado bloco B', ag: 'AG Ord 2026', responsavel: 'Síndico', prazo: '2026-07-01', estado: 'em_curso', origem: 'manual' }] }, <ModTrackerDelibs />)
    expect(screen.getByText('Reparar telhado bloco B')).toBeInTheDocument()
  })

  it('ModNotificJud : vrais processus judiciaires', () => {
    wrap({ processosJud: [{ id: 'j1', tipo: 'Embargo', contraparte: 'Condómino Faltoso', processo: '999/26.0T8PRT', data: '2026-06-01', prazo: '', estado: 'ativo', valor: 5000, descricao: '' }] }, <ModNotificJud />)
    expect(screen.getByText('Condómino Faltoso')).toBeInTheDocument()
    expect(screen.getByText('999/26.0T8PRT')).toBeInTheDocument()
  })
})
