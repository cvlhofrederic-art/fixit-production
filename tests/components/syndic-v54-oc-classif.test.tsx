import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModOcClassif from '@/components/syndic-dashboard/v54/modules/ModOcClassif'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'

/** Classificador IA (Alfredo) : POST /api/syndic/oc-classif + affichage du résultat. */

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const authed = (over: Partial<SyndicData>): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], token: 'tok', ...over })

describe('OcClassif — classificador IA', () => {
  it('classe une ocorrência via Alfredo et affiche le résultat', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ classificacao: { categoria: 'Elevador', prioridade: 'urgente', localizacao: '3.º andar', resumo: 'Fuga no elevador', sugestao: 'Despachar técnico' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ToastProvider><SyndicDataContext.Provider value={authed({})}><ModOcClassif /></SyndicDataContext.Provider></ToastProvider>)
    fireEvent.change(screen.getByLabelText(/Descrição do problema/), { target: { value: 'Está a chover dentro do elevador' } })
    fireEvent.click(screen.getByRole('button', { name: /Analisar e Classificar/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/syndic/oc-classif', expect.objectContaining({ method: 'POST' })))
    expect(await screen.findByText('Elevador')).toBeInTheDocument()
    expect(screen.getByText('Fuga no elevador')).toBeInTheDocument()
  })

  it('validation : description trop courte → aucun appel', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<ToastProvider><SyndicDataContext.Provider value={authed({})}><ModOcClassif /></SyndicDataContext.Provider></ToastProvider>)
    fireEvent.change(screen.getByLabelText(/Descrição do problema/), { target: { value: 'curto' } })
    fireEvent.click(screen.getByRole('button', { name: /Analisar e Classificar/ }))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
