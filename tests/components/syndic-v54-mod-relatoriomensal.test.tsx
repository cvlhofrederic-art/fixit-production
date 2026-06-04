import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModRelatorioMensal from '@/components/syndic-dashboard/v54/modules/ModRelatorioMensal'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Mission, Immeuble } from '@/components/syndic-dashboard/types'
import { downloadReportPdf } from '@/lib/syndic/v54/report-pdf'

vi.mock('@/lib/syndic/v54/report-pdf', () => ({ downloadReportPdf: vi.fn().mockResolvedValue(undefined) }))

/** Phase 3 — ModRelatorioMensal : aperçu calculé (lecture seule) depuis data.missions filtrées par mois. */

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [], contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] }, impayes: [], recouvrements: [], faturas: [],
})
const imm = (over: Partial<Immeuble>): Immeuble => ({
  id: 'b1', nom: 'EDIF', adresse: '', ville: 'Porto', codePostal: '4000', nbLots: 10,
  anneeConstruction: 2000, typeImmeuble: 'habitacional', gestionnaire: '', nbInterventions: 0,
  budgetAnnuel: 10000, depensesAnnee: 5000, ...over,
})
const mission = (over: Partial<Mission>): Mission => ({
  id: 'm1', immeuble: 'EDIF', artisan: 'Pro', type: 'X', description: '',
  priorite: 'normale', statut: 'terminee', dateCreation: '2026-05-01', montantFacture: 1000, ...over,
})

describe('ModRelatorioMensal', () => {
  it('rend le titre et l\'aperçu preview byte-exact (anonyme)', () => {
    render(<ModRelatorioMensal />)
    expect(screen.getByRole('heading', { name: 'Relatório Mensal', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Residencial Cedofeita — Inspeção técnica')).toBeInTheDocument()
    expect(screen.getByText('Abril 2026')).toBeInTheDocument()
  })

  it('Phase 3 : filtre les intervenções par mois et bascule via le sélecteur', () => {
    const d: SyndicData = {
      ...base(),
      immeubles: [imm({ id: 'a' }), imm({ id: 'b' })], // budget 20000 · dépenses 10000 → 50%
      missions: [
        mission({ id: 'mai', immeuble: 'EDIF-MAI', type: 'Maio interv', dateIntervention: '2026-05-10' }),
        mission({ id: 'abr', immeuble: 'EDIF-ABR', type: 'Abril interv', dateIntervention: '2026-04-12' }),
      ],
    }
    render(<SyndicDataContext.Provider value={d}><ModRelatorioMensal /></SyndicDataContext.Provider>)
    // défaut = mois le plus récent (Maio 2026)
    expect(screen.getByText('Maio 2026')).toBeInTheDocument()
    expect(screen.getByText('EDIF-MAI — Maio interv')).toBeInTheDocument()
    expect(screen.queryByText('EDIF-ABR — Abril interv')).toBeNull()
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0) // orçamento consumido
    // bascule sur Abril
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: 'Abril' } })
    expect(screen.getByText('EDIF-ABR — Abril interv')).toBeInTheDocument()
    expect(screen.queryByText('EDIF-MAI — Maio interv')).toBeNull()
    cleanup()
  })

  it('Phase 3 : état vide quand le mois sélectionné n\'a aucune intervenção', () => {
    const d: SyndicData = { ...base(), missions: [] }
    render(<SyndicDataContext.Provider value={d}><ModRelatorioMensal /></SyndicDataContext.Provider>)
    expect(screen.getByText('Nenhuma intervenção neste mês.')).toBeInTheDocument()
    cleanup()
  })

  it('Phase 3 : « Descarregar PDF » génère le PDF du mois sélectionné', async () => {
    vi.mocked(downloadReportPdf).mockClear()
    const d: SyndicData = {
      ...base(), immeubles: [imm({})],
      missions: [mission({ id: 'mai', immeuble: 'EDIF-MAI', type: 'Maio interv', dateIntervention: '2026-05-10' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModRelatorioMensal /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Descarregar PDF/ }))
    await waitFor(() => expect(downloadReportPdf).toHaveBeenCalled())
    const [model, filename] = vi.mocked(downloadReportPdf).mock.calls[0]
    expect(model.periodLabel).toBe('Maio 2026')
    expect(model.rows).toHaveLength(1)
    expect(model.rows[0].label).toBe('EDIF-MAI — Maio interv')
    expect(filename).toContain('2026-05')
    cleanup()
  })
})
