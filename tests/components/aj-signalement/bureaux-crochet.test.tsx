// tests/components/aj-signalement/bureaux-crochet.test.tsx
//
// Bureaux des cabinets clients (PR 2 : écrans du super admin) — crochet partagé useBureauxCabinetQr : les bureaux d'un
// cabinet, lus par GET /cabinets/[id]/bureaux, pour la fenêtre « Bureaux » (E1) et les listes « Bureau » des autres
// écrans (fiche, copropriété, import).
//   - cabinet sans bureau (aucune clé nbBureaux : aucun bureau, ou migration absente) : AUCUNE requête, liste vide tout
//     de suite (les écrans restent ceux d'avant) ; `toujours` force la lecture (fenêtre E1 : créer le premier bureau,
//     dire que la fonction n'est pas encore disponible) ;
//   - 503 base_absente → « indisponible » ; autre échec → « erreur » avec son code ;
//   - les bureaux ouverts à part (choix d'un rattachement) ; recharger() relit et rend la lecture ;
//   - autre cabinet choisi : « chargement » jusqu'à sa réponse, jamais les bureaux du précédent ;
//   - réseau coupé : un toast (Sonner), une seule fois, à la réponse ; jamais pour une réponse dépassée.
// Données fictives : « Cabinet Exemple », bureaux « Nord » et « Sud ».

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { useBureauxCabinetQr } from '@/components/aj-signalement/useBureauxCabinetQr'
import { TEXTES_TABLEAU_QR as T } from '@/lib/aj-signalement/affichage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const K2 = 'a0000000-0000-4000-8000-0000000000a2'
const nord = { id: 'b1', nom: 'Nord', ferme: false, cabinetId: K1, fermeLe: null, creeLe: '', nbGestionnaires: 1, nbCoproprietes: 0 }
const sud = { ...nord, id: 'b2', nom: 'Sud', ferme: true }
const est = { ...nord, id: 'b3', nom: 'Est', cabinetId: K2 }

let urls: string[] = []
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })
function simulerFetch(routeur: (url: string) => Response | Promise<Response>) {
  urls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url)
    return routeur(url)
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  simulerFetch((url) => json({ bureaux: url.includes(K2) ? [est] : [nord, sud] }))
})
afterEach(() => vi.unstubAllGlobals())

describe('useBureauxCabinetQr', () => {
  it('cabinet sans bureau (aucune clé nbBureaux) ou aucun cabinet : aucune requête, liste vide tout de suite', async () => {
    const { result, rerender } = renderHook(({ cabinet }) => useBureauxCabinetQr(cabinet), {
      initialProps: { cabinet: { id: K1 } as { id: string; nbBureaux?: number } | null },
    })
    expect(result.current.lecture).toEqual({ etat: 'pret', bureaux: [] })
    expect(result.current.ouverts).toEqual([])
    rerender({ cabinet: null })
    expect(result.current.lecture).toEqual({ etat: 'pret', bureaux: [] })
    await act(async () => { await Promise.resolve() })
    expect(urls).toEqual([])
  })

  it('cabinet avec bureaux : chargement, puis les bureaux et les ouverts à part', async () => {
    const { result } = renderHook(() => useBureauxCabinetQr({ id: K1, nbBureaux: 2 }))
    expect(result.current.lecture).toEqual({ etat: 'chargement' })
    await waitFor(() => expect(result.current.lecture.etat).toBe('pret'))
    expect(result.current.bureaux.map((b) => b.nom)).toEqual(['Nord', 'Sud'])
    expect(result.current.ouverts.map((b) => b.nom)).toEqual(['Nord'])
    expect(urls).toEqual([`/api/aj-signalement/cabinets/${K1}/bureaux`])
  })

  it('« toujours » : lecture même sans bureau annoncé (fenêtre E1)', async () => {
    simulerFetch(() => json({ bureaux: [] }))
    const { result } = renderHook(() => useBureauxCabinetQr({ id: K1 }, { toujours: true }))
    await waitFor(() => expect(result.current.lecture).toEqual({ etat: 'pret', bureaux: [] }))
    expect(urls).toEqual([`/api/aj-signalement/cabinets/${K1}/bureaux`])
  })

  it('503 base_absente → indisponible ; autre échec → erreur avec son code', async () => {
    simulerFetch(() => json({ error: 'base_absente' }, 503))
    const absente = renderHook(() => useBureauxCabinetQr({ id: K1 }, { toujours: true }))
    await waitFor(() => expect(absente.result.current.lecture).toEqual({ etat: 'indisponible' }))
    expect(absente.result.current.bureaux).toEqual([])
    simulerFetch(() => json({ error: 'serveur' }, 500))
    const panne = renderHook(() => useBureauxCabinetQr({ id: K1, nbBureaux: 1 }))
    await waitFor(() => expect(panne.result.current.lecture).toEqual({ etat: 'erreur', code: 'serveur' }))
  })

  it('recharger : relit et rend la nouvelle lecture ; la liste affichée reste en place pendant la relecture', async () => {
    const { result } = renderHook(() => useBureauxCabinetQr({ id: K1, nbBureaux: 2 }))
    await waitFor(() => expect(result.current.lecture.etat).toBe('pret'))
    let relache: () => void = () => {}
    simulerFetch(() => new Promise<Response>((resoudre) => { relache = () => resoudre(json({ bureaux: [nord] })) }))
    let promesse: Promise<unknown> = Promise.resolve()
    act(() => { promesse = result.current.recharger() })
    expect(result.current.bureaux.map((b) => b.nom)).toEqual(['Nord', 'Sud'])
    await act(async () => { relache(); await promesse })
    await expect(promesse).resolves.toEqual({ etat: 'pret', bureaux: [nord] })
    expect(result.current.bureaux.map((b) => b.nom)).toEqual(['Nord'])
  })

  it('autre cabinet : chargement jusqu’à sa réponse, jamais les bureaux du précédent', async () => {
    const { result, rerender } = renderHook(({ id }) => useBureauxCabinetQr({ id, nbBureaux: 1 }), { initialProps: { id: K1 } })
    await waitFor(() => expect(result.current.lecture.etat).toBe('pret'))
    rerender({ id: K2 })
    expect(result.current.lecture).toEqual({ etat: 'chargement' })
    await waitFor(() => expect(result.current.bureaux.map((b) => b.nom)).toEqual(['Est']))
  })

  it('réseau coupé : erreur « reseau » et un toast, une seule fois, à la réponse (rendus suivants : aucun autre)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    simulerFetch(() => { throw new TypeError('Failed to fetch') })
    const { result, rerender } = renderHook(() => useBureauxCabinetQr({ id: K1, nbBureaux: 1 }))
    await waitFor(() => expect(result.current.lecture).toEqual({ etat: 'erreur', code: 'reseau' }))
    rerender()
    rerender()
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(T.erreurs.reseau)
  })

  it('autre échec (500) : aucun toast, le message reste celui de l’écran', async () => {
    simulerFetch(() => json({ error: 'serveur' }, 500))
    const { result } = renderHook(() => useBureauxCabinetQr({ id: K1, nbBureaux: 1 }))
    await waitFor(() => expect(result.current.lecture).toEqual({ etat: 'erreur', code: 'serveur' }))
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('réponse « réseau coupé » dépassée par une plus récente (autre cabinet) : aucun toast', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let relache: () => void = () => {}
    simulerFetch((url) => {
      if (url.includes(K2)) return json({ bureaux: [est] })
      return new Promise<Response>((_resoudre, rejeter) => { relache = () => rejeter(new TypeError('Failed to fetch')) })
    })
    const { result, rerender } = renderHook(({ id }) => useBureauxCabinetQr({ id, nbBureaux: 1 }), { initialProps: { id: K1 } })
    rerender({ id: K2 })
    await waitFor(() => expect(result.current.bureaux.map((b) => b.nom)).toEqual(['Est']))
    await act(async () => {
      relache()
      await new Promise((r) => { setTimeout(r, 0) })
    })
    expect(console.warn).toHaveBeenCalled()
    expect(result.current.bureaux.map((b) => b.nom)).toEqual(['Est'])
    expect(toast.error).not.toHaveBeenCalled()
  })
})
