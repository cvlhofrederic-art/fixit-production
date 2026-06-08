import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import ModMod3Orcamentos from '@/components/syndic-dashboard/v54/modules/ModMod3Orcamentos'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Obra, Orcamento } from '@/lib/syndic/v54/api'

/** Comparaison « 3 orçamentos » : modale triée par valeur + ajout d'un orçamento (POST). */

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const obra = (over: Partial<Obra>): Obra => ({ id: 'o1', titulo: 'Cobertura', tipo: 'Reparação', descricao: '', local: '', prazo: '', estado: 'orcamentacao', orcamento: 0, empresa: '', numOrcamentos: 0, ...over } as Obra)
const orcamento = (over: Partial<Orcamento>): Orcamento => ({ id: 'q1', obraId: 'o1', empresa: 'A', valor: 1000, prazoDias: 30, validade: '', notas: '', recomendado: false, ...over })

const data = (obras: Obra[], orcamentos: Orcamento[]): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], obras, orcamentos, token: 'tok', refresh: vi.fn() })

describe('Comparar orçamentos', () => {
  it('ouvre la comparaison triée + ajoute un orçamento (POST)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ orcamento: {} }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ToastProvider><SyndicDataContext.Provider value={data(
      [obra({ id: 'o1' })],
      [orcamento({ id: 'a', empresa: 'CaraLda', valor: 9000 }), orcamento({ id: 'b', empresa: 'BaratoLda', valor: 5000 })],
    )}><ModMod3Orcamentos /></SyndicDataContext.Provider></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Comparar/ }))
    expect(await screen.findByText('BaratoLda')).toBeInTheDocument()
    expect(screen.getByText('CaraLda')).toBeInTheDocument()
    expect(screen.getByText('Mais baixo')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Nome da empresa'), { target: { value: 'NovaLda' } })
    fireEvent.click(screen.getByRole('button', { name: /Adicionar orçamento/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/syndic/orcamentos', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toMatchObject({ obraId: 'o1', empresa: 'NovaLda' })
  })
})
