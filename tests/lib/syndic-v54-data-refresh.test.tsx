import { describe, it, expect, vi, afterEach, beforeEach, type MockInstance } from 'vitest'
import { render, waitFor, cleanup, act } from '@testing-library/react'

/**
 * SyndicDataProvider : au retour sur l'onglet (focus / page redevenue visible), les données du cabinet
 * sont rechargées — une seule fois pour les deux événements — afin que le Syndic v54 voie sans recharger
 * la page ce qui a été fait ailleurs (demande déposée depuis l'espace copropriétaire). Anonyme : rien.
 */

const h = vi.hoisted(() => ({
  session: null as null | { access_token: string; user: { id: string; app_metadata: { role?: string } } },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: h.session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

import { SyndicDataProvider, useSyndicData, DELAI_REFRESH_FOCUS_MS } from '@/lib/syndic/v54/data-context'

function Sonde() {
  const d = useSyndicData()
  return <span data-testid="etat">{d.authenticated ? `authed:${d.signalements?.length ?? 0}` : 'anon'}</span>
}

let fetchSpy: MockInstance<typeof fetch>
const appelsMissions = () => fetchSpy.mock.calls.filter(([u]) => String(u) === '/api/syndic/missions').length

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (entree) =>
    String(entree) === '/api/syndic/signalements'
      ? new Response(JSON.stringify({ signalements: [{ id: 's1', statut: 'en_attente' }] }), { status: 200 })
      : new Response(JSON.stringify({}), { status: 200 }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('SyndicDataProvider — rechargement au retour sur la page', () => {
  it('syndic connecté : focus + visibilitychange → un seul rechargement, sans cache', async () => {
    h.session = { access_token: 'jeton', user: { id: 'cab', app_metadata: { role: 'super_admin' } } }
    const { getByTestId } = render(<SyndicDataProvider><Sonde /></SyndicDataProvider>)
    await waitFor(() => expect(getByTestId('etat').textContent).toBe('authed:1'))
    expect(appelsMissions()).toBe(1)

    act(() => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(appelsMissions()).toBe(2))
    // Les deux événements sont regroupés.
    await new Promise((r) => setTimeout(r, DELAI_REFRESH_FOCUS_MS + 100))
    expect(appelsMissions()).toBe(2)
    const init = fetchSpy.mock.calls.find(([u]) => String(u) === '/api/syndic/signalements')?.[1] as RequestInit
    expect(init.cache).toBe('no-store')
  })

  it('page masquée : pas de rechargement', async () => {
    h.session = { access_token: 'jeton', user: { id: 'cab', app_metadata: { role: 'syndic' } } }
    const { getByTestId } = render(<SyndicDataProvider><Sonde /></SyndicDataProvider>)
    await waitFor(() => expect(getByTestId('etat').textContent).toBe('authed:1'))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await new Promise((r) => setTimeout(r, DELAI_REFRESH_FOCUS_MS + 100))
    expect(appelsMissions()).toBe(1)
  })

  it('anonyme : aucun appel, même au focus', async () => {
    h.session = null
    const { getByTestId } = render(<SyndicDataProvider><Sonde /></SyndicDataProvider>)
    await waitFor(() => expect(getByTestId('etat').textContent).toBe('anon'))
    act(() => { window.dispatchEvent(new Event('focus')) })
    await new Promise((r) => setTimeout(r, DELAI_REFRESH_FOCUS_MS + 100))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
