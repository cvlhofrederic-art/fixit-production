import { describe, it, expect, afterEach, vi, type MockInstance } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import ModQuadroAvisos from '@/components/syndic-dashboard/v54/modules/ModQuadroAvisos'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider, type V54Locale } from '@/lib/syndic/v54/i18n'

/**
 * Correctif ModQuadroAvisos : l'action rapide « Aviso Urgente » / « Avis urgent » envoyait
 * categoria='urgente', valeur absente de l'enum de l'API (syndicAvisoSchema → 400). 'urgente'
 * est une priorité : l'action pré-remplit désormais la priorité seule, la catégorie reste celle
 * par défaut du formulaire ('outro'). Les deux autres actions rapides sont inchangées.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function rendre(locale: V54Locale) {
  const refresh = vi.fn()
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ aviso: {} }), { status: 200 }))
  const d: SyndicData = { authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], avisos: [], token: 'tok-av', refresh }
  render(<V54LocaleProvider locale={locale}><SyndicDataContext.Provider value={d}><ModQuadroAvisos /></SyndicDataContext.Provider></V54LocaleProvider>)
  return { fetchSpy, refresh }
}

const selectDuFormulaire = (id: string): HTMLSelectElement => within(screen.getByRole('dialog')).getAllByRole('combobox').find((s) => s.id === id) as HTMLSelectElement

/** Ouvre l'action rapide, saisit un titre, publie et renvoie le corps du POST. */
async function publierDepuisAction(fetchSpy: MockInstance<typeof fetch>, action: RegExp, placeholder: string, publier: string) {
  fireEvent.click(screen.getByRole('button', { name: action }))
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: 'Titre test' } })
  fireEvent.click(screen.getByRole('button', { name: publier }))
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/avisos', expect.objectContaining({ method: 'POST' })))
  const appel = fetchSpy.mock.calls.find((c) => c[0] === '/api/syndic/avisos')!
  // Publication réussie : la boîte de dialogue se ferme.
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  return JSON.parse((appel[1] as RequestInit).body as string) as Record<string, unknown>
}

describe('ModQuadroAvisos — action rapide « avis urgent »', () => {
  it('PT : catégorie par défaut (Outro) et priorité urgente dans le formulaire', () => {
    rendre('pt-PT')
    fireEvent.click(screen.getByRole('button', { name: /Aviso Urgente/ }))
    const cat = selectDuFormulaire('na-cat')
    expect(cat.value).toBe('outro')
    expect(cat.selectedOptions[0].textContent).toBe('Outro')
    expect(selectDuFormulaire('na-prio').value).toBe('urgente')
  })

  it('PT : POST /api/syndic/avisos avec une catégorie acceptée par l’API', async () => {
    const { fetchSpy, refresh } = rendre('pt-PT')
    const body = await publierDepuisAction(fetchSpy, /Aviso Urgente/, 'Ex.: Corte de água programado', 'Publicar')
    expect(body).toMatchObject({ titulo: 'Titre test', categoria: 'outro', prioridade: 'urgente' })
    expect(['manutencao', 'assembleia', 'financeiro', 'seguranca', 'social', 'outro']).toContain(body.categoria)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('FR : catégorie « Autre » et priorité urgente, POST identique', async () => {
    const { fetchSpy } = rendre('fr-FR')
    fireEvent.click(screen.getByRole('button', { name: /Avis urgent/ }))
    expect(selectDuFormulaire('na-cat').selectedOptions[0].textContent).toBe('Autre')
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    const body = await publierDepuisAction(fetchSpy, /Avis urgent/, "Ex. : Coupure d'eau programmée", 'Publier')
    expect(body).toMatchObject({ categoria: 'outro', prioridade: 'urgente' })
  })

  it('les autres actions rapides gardent leur catégorie et la priorité importante', async () => {
    const { fetchSpy } = rendre('pt-PT')
    const ag = await publierDepuisAction(fetchSpy, /Convocatória AG/, 'Ex.: Corte de água programado', 'Publicar')
    expect(ag).toMatchObject({ categoria: 'assembleia', prioridade: 'importante' })
    fetchSpy.mockClear()
    const fin = await publierDepuisAction(fetchSpy, /Aviso Financeiro/, 'Ex.: Corte de água programado', 'Publicar')
    expect(fin).toMatchObject({ categoria: 'financeiro', prioridade: 'importante' })
  })
})
