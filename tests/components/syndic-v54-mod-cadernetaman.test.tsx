import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import ModCadernetaMan from '@/components/syndic-dashboard/v54/modules/ModCadernetaMan'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Caderneta } from '@/lib/syndic/v54/api'
import { downloadReportPdf } from '@/lib/syndic/v54/report-pdf'

vi.mock('@/lib/syndic/v54/report-pdf', () => ({ downloadReportPdf: vi.fn().mockResolvedValue(undefined) }))

/** Étape d (batch d51) — ModCadernetaMan : rendu byte-exact + modal + Export PDF (Phase démo). */

afterEach(cleanup)

describe('ModCadernetaMan', () => {
  it('rend l\'état vide et les KPIs', () => {
    render(<ModCadernetaMan />)
    expect(screen.getByRole('heading', { name: 'Caderneta de Manutenção & Técnica', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Caderneta vazia')).toBeInTheDocument()
    expect(screen.getByText('Intervenções')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Intervenção »', () => {
    render(<ModCadernetaMan />)
    fireEvent.click(screen.getAllByRole('button', { name: /\+ Intervenção/ })[0])
    expect(screen.getByText('Nova intervenção')).toBeInTheDocument()
    expect(screen.getByLabelText(/Natureza das obras/)).toBeInTheDocument()
  })
})

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [], contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] }, impayes: [], recouvrements: [], faturas: [],
})
const cad = (over: Partial<Caderneta>): Caderneta => ({
  id: 'k1', data: '2026-05-01', estado: 'realizado', natureza: 'manutencao-corrente', edificio: 'EDIF-K',
  localizacao: '', prestador: 'ProK', custo: 480, garantia: '', cee: 'na', notas: '', ...over,
})

describe('ModCadernetaMan (Phase démo — Export PDF)', () => {
  it('« Export PDF » génère le PDF de la caderneta réelle', async () => {
    vi.mocked(downloadReportPdf).mockClear()
    const d: SyndicData = { ...base(), caderneta: [cad({ edificio: 'EDIF-K', natureza: 'reparacao' })] }
    render(<SyndicDataContext.Provider value={d}><ModCadernetaMan /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Export PDF/ }))
    await waitFor(() => expect(downloadReportPdf).toHaveBeenCalled())
    const [model, filename] = vi.mocked(downloadReportPdf).mock.calls[0]
    expect(model.docTitle).toBe('Caderneta de Manutenção')
    expect(model.rows).toHaveLength(1)
    expect(filename).toBe('caderneta-manutencao.pdf')
    cleanup()
  })
})
