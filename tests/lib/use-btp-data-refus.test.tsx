// tests/lib/use-btp-data-refus.test.tsx — un enregistrement BTP refusé par le serveur affiche sa raison
// (relecture adverse du 15/11/2026).
//
// Avant : add, update et remove de useBTPData jetaient la réponse en erreur sans la lire, et les écrans BTP fermaient
// leur fenêtre sans un mot : un refus du serveur (valeur hors bornes, suppression d'un chantier retenue par une
// situation de travaux, fiche disparue…) passait inaperçu. Maintenant : la raison donnée par le serveur s'affiche
// (toast), ou un message général en français si la réponse n'en donne pas. Les fonctions renvoient toujours null ou
// false, comme avant : les écrans gardent leur comportement.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) } },
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

import { toast } from 'sonner'
import { signalerEcritureRefusee, useBTPData } from '@/lib/hooks/use-btp-data'

const json = (corps: unknown, status: number) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

/** Réponse du faux serveur aux écritures (POST) ; les lectures renvoient un chantier. */
let reponseEcriture: () => Response

beforeEach(() => {
  vi.mocked(toast.error).mockClear()
  reponseEcriture = () => json({ row: { id: 'c-1', titre: 'Villa', statut: 'En cours' } }, 201)
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') return reponseEcriture()
    const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
    return json({ [table]: [{ id: 'c-1', titre: 'Villa', statut: 'En cours' }] }, 200)
  })
  // Le hook note chaque échec dans la console : sans intérêt ici.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Un compte par montage : le hook met ses lectures en cache par compte.
let montages = 0
const monter = async () => {
  montages += 1
  const userId = `u-refus-${montages}`
  const hook = renderHook(() => useBTPData({ table: 'chantiers', artisanId: 'a1', userId, autoImport: false }))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook.result
}

const messagesErreur = () => vi.mocked(toast.error).mock.calls.map(([message]) => String(message))

describe('useBTPData — écriture refusée par le serveur', () => {
  it('création refusée (budget négatif) : la raison du serveur s’affiche, add renvoie null', async () => {
    reponseEcriture = () => json({ error: 'Valeur refusée pour le budget (-5000) : elle doit être positive ou nulle.' }, 400)
    const hook = await monter()

    let cree: unknown = 'pas encore appelé'
    await act(async () => { cree = await hook.current.add({ titre: 'Toiture', budget: '-5000' }) })

    expect(cree).toBeNull()
    expect(messagesErreur()).toEqual(['Valeur refusée pour le budget (-5000) : elle doit être positive ou nulle.'])
  })

  it('suppression d’un chantier retenue par une situation de travaux : le message du serveur s’affiche, remove renvoie false', async () => {
    reponseEcriture = () => json({ error: 'Ce chantier ne peut pas être supprimé : une situation de travaux y est rattachée.' }, 409)
    const hook = await monter()

    let supprime = true
    await act(async () => { supprime = await hook.current.remove('c-1') })

    expect(supprime).toBe(false)
    expect(messagesErreur()).toEqual(['Ce chantier ne peut pas être supprimé : une situation de travaux y est rattachée.'])
  })

  it('modification d’une fiche disparue : le message du serveur s’affiche, update renvoie false', async () => {
    reponseEcriture = () => json({ error: 'Fiche introuvable : elle a peut-être été supprimée entre-temps.' }, 404)
    const hook = await monter()

    let modifie = true
    await act(async () => { modifie = await hook.current.update('c-1', { statut: 'Terminé' }) })

    expect(modifie).toBe(false)
    expect(messagesErreur()).toEqual(['Fiche introuvable : elle a peut-être été supprimée entre-temps.'])
  })

  it('réponse sans message lisible (page d’erreur d’un intermédiaire) : message général en français, lecture ratée notée', async () => {
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => {})
    reponseEcriture = () => new Response('<html>Bad gateway</html>', { status: 502 })
    const hook = await monter()

    let modifie = true
    await act(async () => { modifie = await hook.current.update('c-1', { statut: 'Terminé' }) })

    expect(modifie).toBe(false)
    expect(messagesErreur()).toEqual(['La modification n\'a pas été enregistrée. Réessayez dans un instant.'])
    expect(avertissement).toHaveBeenCalledWith(expect.stringContaining('[btp]'), expect.anything())
  })

  it('trop d’écritures d’affilée (429) : message en français au lieu du texte anglais de la limite de débit', async () => {
    reponseEcriture = () => json({ error: 'Too many requests. Please wait before retrying.' }, 429)
    const hook = await monter()

    await act(async () => { await hook.current.add({ titre: 'Toiture' }) })

    expect(messagesErreur()).toEqual(['Trop d\'enregistrements en peu de temps : patientez une minute, puis réessayez.'])
  })

  it('témoin : écritures réussies, aucun message d’erreur', async () => {
    const hook = await monter()

    await act(async () => {
      await hook.current.add({ titre: 'Toiture' })
      await hook.current.update('c-1', { statut: 'Terminé' })
      await hook.current.remove('c-1')
    })

    expect(messagesErreur()).toEqual([])
  })
})

describe('signalerEcritureRefusee — écrans qui écrivent sans le hook (frais fixes de la compta BTP)', () => {
  it('affiche la raison donnée par le serveur, sinon le message général fourni', async () => {
    await signalerEcritureRefusee(json({ error: 'Valeur refusée pour le montant (-90) : elle doit être positive ou nulle.' }, 400), 'Le frais fixe n\'a pas été enregistré.')
    await signalerEcritureRefusee(json({ error: '' }, 500), 'Le frais fixe n\'a pas été enregistré.')
    await signalerEcritureRefusee(json({ autre: 'champ' }, 400), 'Le frais fixe n\'a pas été enregistré.')

    expect(messagesErreur()).toEqual([
      'Valeur refusée pour le montant (-90) : elle doit être positive ou nulle.',
      'Le frais fixe n\'a pas été enregistré.',
      'Le frais fixe n\'a pas été enregistré.',
    ])
  })
})
