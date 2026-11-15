// tests/lib/use-btp-data-echecs.test.tsx — échecs d'enregistrement et de chargement annoncés à l'utilisateur
// (constat donnees-btp-2 de l'audit du 11/11/2026).
//
// Avant : une coupure réseau pendant un enregistrement ne laissait qu'une trace dans la console ; un chargement en échec
// donnait une liste vide (« Aucun chantier, créez votre premier chantier ») sans un mot ; un réglage refusé revenait
// en arrière en silence. Maintenant : un message en français (toast) le dit. L'accueil partagé avec l'artisan, qui passe
// son rôle, garde le comportement d'avant pour un artisan.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) } },
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

import { toast } from 'sonner'
import { useBTPData, useBTPSettings } from '@/lib/hooks/use-btp-data'

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

/** Réponses du faux serveur : écritures (POST) et lectures (GET). */
let ecriture: () => Promise<Response>
let lecture: (table: string) => Promise<Response>

beforeEach(() => {
  vi.mocked(toast.error).mockClear()
  ecriture = async () => json({ row: { id: 'c-1', titre: 'Villa', statut: 'En cours' } }, 201)
  lecture = async (table) => json(table === 'settings' ? { settings: null } : { [table]: [{ id: 'c-1', titre: 'Villa', statut: 'En cours' }] })
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') return ecriture()
    return lecture(new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? '')
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

const messagesErreur = () => vi.mocked(toast.error).mock.calls.map(([message]) => String(message))
const coupureReseau = async (): Promise<Response> => { throw new TypeError('Failed to fetch') }

let montages = 0
async function monter(orgRole?: string) {
  montages += 1
  const userId = `u-echecs-${montages}`
  const hook = renderHook(() => useBTPData({ table: 'chantiers', artisanId: 'a1', userId, autoImport: false, orgRole }))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook.result
}

describe('useBTPData — enregistrement coupé par le réseau', () => {
  it('création : un message le dit, add renvoie null', async () => {
    const hook = await monter()
    ecriture = coupureReseau
    let cree: unknown = 'pas encore appelé'
    await act(async () => { cree = await hook.current.add({ titre: 'Toiture' }) })
    expect(cree).toBeNull()
    expect(messagesErreur()).toEqual(['L\'enregistrement n\'a pas abouti. Réessayez dans un instant.'])
  })

  it('modification et suppression : un message chacune, update et remove renvoient false', async () => {
    const hook = await monter()
    ecriture = coupureReseau
    let modifie = true
    let supprime = true
    await act(async () => { modifie = await hook.current.update('c-1', { statut: 'Terminé' }) })
    await act(async () => { supprime = await hook.current.remove('c-1') })
    expect([modifie, supprime]).toEqual([false, false])
    expect(messagesErreur()).toEqual([
      'La modification n\'a pas été enregistrée. Réessayez dans un instant.',
      'La suppression n\'a pas abouti. Réessayez dans un instant.',
    ])
  })

  it('refus du serveur : un seul message, celui du serveur (pas de second message général)', async () => {
    const hook = await monter()
    ecriture = async () => json({ error: 'Fiche introuvable : elle a peut-être été supprimée entre-temps.' }, 404)
    await act(async () => { await hook.current.update('c-1', { statut: 'Terminé' }) })
    expect(messagesErreur()).toEqual(['Fiche introuvable : elle a peut-être été supprimée entre-temps.'])
  })
})

describe('useBTPData — chargement en échec', () => {
  it('écran du BTP pro : un message dit que la liste n’a pas pu être chargée (au lieu d’une liste vide muette)', async () => {
    lecture = async () => json({ error: 'Les données n\'ont pas pu être chargées. Réessayez dans un instant.' }, 500)
    const hook = await monter()
    expect(hook.current.items).toEqual([])
    expect(messagesErreur()).toEqual(['Les données n\'ont pas pu être chargées : la liste affichée peut être vide ou incomplète. Réessayez dans un instant.'])
  })

  it('coupure réseau au chargement : même message', async () => {
    lecture = coupureReseau
    await monter('pro_societe')
    expect(messagesErreur()).toHaveLength(1)
  })

  it('accueil partagé, compte artisan : comportement d’avant, aucun message', async () => {
    lecture = async () => json({ error: 'Les données n\'ont pas pu être chargées. Réessayez dans un instant.' }, 500)
    const hook = await monter('artisan')
    expect(hook.current.error).toBe('Erreur de chargement')
    expect(messagesErreur()).toEqual([])
  })
})

describe('useBTPSettings — réglages', () => {
  // Les réglages sont gardés en cache pour la session : ce test-ci passe avant ceux qui en chargent.
  it('réglages non chargés : un message dit que les valeurs affichées sont celles par défaut', async () => {
    lecture = async () => json({ error: 'Les données n\'ont pas pu être chargées. Réessayez dans un instant.' }, 500)
    const { result } = renderHook(() => useBTPSettings())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(messagesErreur()).toEqual(['Vos réglages n\'ont pas pu être chargés : les valeurs affichées sont celles par défaut. Réessayez dans un instant.'])
  })

  it('réglage refusé par le serveur : sa raison s’affiche et la valeur d’avant revient', async () => {
    const { result } = renderHook(() => useBTPSettings())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const avant = result.current.settings.taux_is
    ecriture = async () => json({ error: 'Valeur refusée pour le taux d\'impôt sur les sociétés (150) : elle doit être comprise entre 0 et 100.' }, 400)

    await act(async () => { await result.current.save({ taux_is: 150 }) })

    expect(result.current.settings.taux_is).toBe(avant)
    expect(messagesErreur()).toEqual(['Valeur refusée pour le taux d\'impôt sur les sociétés (150) : elle doit être comprise entre 0 et 100.'])
  })
})
