import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModCondominos from '@/components/syndic-dashboard/v54/modules/ModCondominos'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'

/** Création condómino : ouvre la modale, valide le nom requis, POST le bon payload. */

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const authed = (over: Partial<SyndicData>): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], ...over })

describe('Condóminos — criação', () => {
  it('Adicionar → POST /api/syndic/coproprios avec les champs saisis', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ coproprios: [{}], count: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ToastProvider><SyndicDataContext.Provider value={authed({ token: 'tok', refresh: vi.fn() })}><ModCondominos /></SyndicDataContext.Provider></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    fireEvent.change(screen.getByPlaceholderText('Nome do proprietário'), { target: { value: 'Ana Silva' } })
    fireEvent.change(screen.getByPlaceholderText('Ex.: Edifício Aurora'), { target: { value: 'Edifício Aurora' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar condómino' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/syndic/coproprios', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.nomProprietaire).toBe('Ana Silva')
    expect(body.immeuble).toBe('Edifício Aurora')
  })

  it('validation : sans nom → aucun POST, message d’erreur', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<ToastProvider><SyndicDataContext.Provider value={authed({ token: 'tok', refresh: vi.fn() })}><ModCondominos /></SyndicDataContext.Provider></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Criar condómino' }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText('Indique o nome do proprietário.')).toBeInTheDocument()
  })
})
