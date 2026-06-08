import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ModCondominos from '@/components/syndic-dashboard/v54/modules/ModCondominos'
import ModBenchmarking from '@/components/syndic-dashboard/v54/modules/ModBenchmarking'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { downloadCsv } from '@/lib/syndic/v54/export-csv'
import type { Coprop } from '@/lib/syndic/v54/api'

vi.mock('@/lib/syndic/v54/export-csv', () => ({ downloadCsv: vi.fn() }))

afterEach(() => { cleanup(); vi.clearAllMocks() })

const mockedDownload = vi.mocked(downloadCsv)

const authed = (over: Partial<SyndicData>): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], ...over })

const coprop = (over: Partial<Coprop>): Coprop => ({ id: 'c1', immeuble: 'Edifício Aurora', batiment: 'A', etage: 2, numeroPorte: '21', proprietario: 'Ana Silva', email: 'ana@x.pt', telefone: '910000000', ocupado: true, tantieme: 70, solde: 0, ...over })

describe('Export CSV v54', () => {
  it('Condóminos : exporte les données réelles du cabinet', () => {
    render(<ToastProvider><SyndicDataContext.Provider value={authed({ coproprios: [coprop({}), coprop({ id: 'c2', proprietario: 'Bruno Costa' })] })}><ModCondominos /></SyndicDataContext.Provider></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/ }))
    expect(mockedDownload).toHaveBeenCalledTimes(1)
    const [filename, headers, rows] = mockedDownload.mock.calls[0]
    expect(filename).toBe('condominos.csv')
    expect(headers[0]).toBe('Fração')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('Ana Silva')
  })

  it('Condóminos anonyme : aucun export, toast d’invitation', () => {
    render(<ToastProvider><ModCondominos /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/ }))
    expect(mockedDownload).not.toHaveBeenCalled()
    expect(screen.getByText(/Conecte-se como síndico para exportar/)).toBeInTheDocument()
  })

  it('Benchmarking anonyme : aucun export, toast d’invitation', () => {
    render(<ToastProvider><ModBenchmarking /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Exportar/ }))
    expect(mockedDownload).not.toHaveBeenCalled()
    expect(screen.getByText(/Conecte-se como síndico para exportar/)).toBeInTheDocument()
  })
})
