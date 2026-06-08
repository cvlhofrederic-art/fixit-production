import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModSegEdificio from '@/components/syndic-dashboard/v54/modules/ModSegEdificio'
import ModAcessibilidade from '@/components/syndic-dashboard/v54/modules/ModAcessibilidade'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'

/** Flux IA Alfredo : plano de emergência (SCIE) + diagnóstico de acessibilidade. */

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const authed = (over: Partial<SyndicData>): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], token: 'tok', ...over })

describe('Alfredo — plano emergência + acessibilidade', () => {
  it('SegEdificio génère un plano de emergência via Alfredo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ plano: '## Plano de emergência\nProcedimentos de evacuação' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ToastProvider><SyndicDataContext.Provider value={authed({})}><ModSegEdificio /></SyndicDataContext.Provider></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Gerar plano emergência/ }))
    fireEvent.change(screen.getByPlaceholderText('Nome do edifício'), { target: { value: 'Edifício Aurora' } })
    fireEvent.click(screen.getByRole('button', { name: /^Gerar plano$/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/syndic/seg-edificio-plano', expect.objectContaining({ method: 'POST' })))
    expect(await screen.findByText(/Procedimentos de evacuação/)).toBeInTheDocument()
  })

  it('Acessibilidade : diagnostic via Alfredo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ analise: '## Diagnóstico\nParcialmente conforme' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ToastProvider><SyndicDataContext.Provider value={authed({})}><ModAcessibilidade /></SyndicDataContext.Provider></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Análise IA Alfredo/ }))
    fireEvent.change(screen.getByPlaceholderText('Nome do edifício'), { target: { value: 'Edifício Aurora' } })
    fireEvent.click(screen.getByRole('button', { name: /^Analisar$/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/syndic/acessibilidade-analise', expect.objectContaining({ method: 'POST' })))
    expect(await screen.findByText(/Parcialmente conforme/)).toBeInTheDocument()
  })
})
