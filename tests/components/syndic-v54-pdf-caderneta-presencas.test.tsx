import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ModCadernetaMan from '@/components/syndic-dashboard/v54/modules/ModCadernetaMan'
import ModProcuracoes from '@/components/syndic-dashboard/v54/modules/ModProcuracoes'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { downloadReportPdf } from '@/lib/syndic/v54/report-pdf'
import type { Caderneta, Procuracao } from '@/lib/syndic/v54/api'

vi.mock('@/lib/syndic/v54/report-pdf', () => ({ downloadReportPdf: vi.fn() }))
const mockedPdf = vi.mocked(downloadReportPdf)

afterEach(() => { cleanup(); vi.clearAllMocks() })

const cad = (over: Partial<Caderneta>): Caderneta => ({ id: 'c1', data: '2026-05-01', estado: 'realizado', natureza: 'reparacao', edificio: 'Edifício A', localizacao: '', prestador: 'HidroPro', custo: 1200, garantia: '2 anos', cee: 'na', notas: '', ...over } as unknown as Caderneta)
const proc = (over: Partial<Procuracao>): Procuracao => ({ id: 'p1', immeuble: 'Edifício A', condomino: 'Ana Silva', procurador: 'Bruno Costa', fracao: 'B', dataValidade: '2026-12-31', agRef: 'AG-2026', statut: 'valida', notes: '', ...over })
const authed = (over: Partial<SyndicData>): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], ...over })

describe('PDF Caderneta + Lista presenças', () => {
  it('Caderneta « Export PDF » génère le PDF avec la table', () => {
    render(<ToastProvider><SyndicDataContext.Provider value={authed({ caderneta: [cad({})] })}><ModCadernetaMan /></SyndicDataContext.Provider></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Export PDF/ }))
    expect(mockedPdf).toHaveBeenCalledTimes(1)
    expect(mockedPdf.mock.calls[0][0]).toBe('caderneta-manutencao.pdf')
    expect(mockedPdf.mock.calls[0][1].tables?.[0]?.rows.length).toBe(1)
  })

  it('Procurações « Gerar lista presenças AG » → PDF avec colonne Assinatura', () => {
    render(<ToastProvider><SyndicDataContext.Provider value={authed({ procuracoes: [proc({})] })}><ModProcuracoes /></SyndicDataContext.Provider></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Gerar lista presenças/ }))
    expect(mockedPdf).toHaveBeenCalledTimes(1)
    expect(mockedPdf.mock.calls[0][0]).toBe('lista-presencas-ag.pdf')
    expect(mockedPdf.mock.calls[0][1].tables?.[0]?.headers ?? []).toContain('Assinatura')
  })

  it('Caderneta vide / anonyme : pas de PDF', () => {
    render(<ToastProvider><ModCadernetaMan /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Export PDF/ }))
    expect(mockedPdf).not.toHaveBeenCalled()
  })
})
