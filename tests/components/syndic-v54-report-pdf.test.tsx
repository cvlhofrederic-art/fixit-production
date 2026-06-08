import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ModRelGestao from '@/components/syndic-dashboard/v54/modules/ModRelGestao'
import ModRelatorioMensal from '@/components/syndic-dashboard/v54/modules/ModRelatorioMensal'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { downloadReportPdf } from '@/lib/syndic/v54/report-pdf'
import type { Immeuble, Mission } from '@/components/syndic-dashboard/types'

vi.mock('@/lib/syndic/v54/report-pdf', () => ({ downloadReportPdf: vi.fn() }))
const mockedPdf = vi.mocked(downloadReportPdf)

afterEach(() => { cleanup(); vi.clearAllMocks() })

const im = (over: Partial<Immeuble>): Immeuble => ({ id: 'i1', nom: 'Edifício A', adresse: '', ville: '', codePostal: '', nbLots: 10, anneeConstruction: 2010, typeImmeuble: '', gestionnaire: '', nbInterventions: 0, budgetAnnuel: 48000, depensesAnnee: 12000, ...over } as Immeuble)
const mi = (over: Partial<Mission>): Mission => ({ id: 'm1', immeuble: 'Edifício A', type: 'Canalização', description: 'Fuga', statut: 'terminee', dateIntervention: '2026-05-10', montantFacture: 500, ...over } as unknown as Mission)
const authed = (over: Partial<SyndicData>): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], ...over })

describe('Rapports PDF v54', () => {
  it('RelGestão : Descarregar PDF génère le rapport réel', () => {
    render(<ToastProvider><SyndicDataContext.Provider value={authed({ immeubles: [im({})], missions: [mi({})] })}><ModRelGestao /></SyndicDataContext.Provider></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Descarregar PDF/ }))
    expect(mockedPdf).toHaveBeenCalledTimes(1)
    expect(mockedPdf.mock.calls[0][0]).toBe('relatorio-gestao.pdf')
    expect(mockedPdf.mock.calls[0][1].kpis?.length ?? 0).toBeGreaterThan(0)
  })

  it('RelGestão anonyme : pas de PDF, toast d’invitation', () => {
    render(<ToastProvider><ModRelGestao /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Descarregar PDF/ }))
    expect(mockedPdf).not.toHaveBeenCalled()
    expect(screen.getByText(/Conecte-se como síndico/)).toBeInTheDocument()
  })

  it('Relatório Mensal : Descarregar PDF inclut la table des intervenções', () => {
    render(<ToastProvider><SyndicDataContext.Provider value={authed({ immeubles: [im({})], missions: [mi({ id: 'a', dateIntervention: '2026-05-10' })] })}><ModRelatorioMensal /></SyndicDataContext.Provider></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Descarregar PDF/ }))
    expect(mockedPdf).toHaveBeenCalledTimes(1)
    expect(mockedPdf.mock.calls[0][0]).toMatch(/^relatorio-mensal-/)
    expect(mockedPdf.mock.calls[0][1].tables?.[0]?.headers ?? []).toContain('Descrição')
  })
})
