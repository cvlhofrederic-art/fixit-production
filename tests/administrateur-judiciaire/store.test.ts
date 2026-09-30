import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { creerStore, creerStoreVanille } from '@/lib/administrateur-judiciaire/store'

describe('store (remplaçant zustand)', () => {
  it('fusionne les mises à jour partielles et notifie les abonnés', () => {
    const api = creerStoreVanille<{ a: number; b: string }>(() => ({ a: 1, b: 'x' }))
    const ecouteur = vi.fn()
    api.subscribe(ecouteur)
    api.setState({ a: 2 })
    expect(api.getState()).toEqual({ a: 2, b: 'x' })
    expect(ecouteur).toHaveBeenCalledWith({ a: 2, b: 'x' }, { a: 1, b: 'x' })
  })

  it('accepte une fonction de mise à jour et le mode remplacement', () => {
    const api = creerStoreVanille<{ n: number; m?: number }>(() => ({ n: 1, m: 5 }))
    api.setState((e) => ({ n: e.n + 1 }))
    expect(api.getState()).toEqual({ n: 2, m: 5 })
    api.setState({ n: 9 }, true)
    expect(api.getState()).toEqual({ n: 9 })
  })

  it('ne notifie pas quand l’état est identique', () => {
    const api = creerStoreVanille<{ n: number }>(() => ({ n: 1 }))
    const ecouteur = vi.fn()
    api.subscribe(ecouteur)
    api.setState((e) => e)
    expect(ecouteur).not.toHaveBeenCalled()
  })

  it('expose get/set à l’initialiseur (actions asynchrones)', async () => {
    const useS = creerStore<{ n: number; incr: () => Promise<void> }>((set, get) => ({
      n: 0,
      incr: async () => set({ n: get().n + 1 }),
    }))
    await useS.getState().incr()
    expect(useS.getState().n).toBe(1)
  })

  it('forme currifiée create()(init) et hook avec sélecteur', () => {
    const useS = creerStore<{ code: string | null; choisir: (c: string) => void }>()((set) => ({
      code: null,
      choisir: (c) => set({ code: c }),
    }))
    const { result } = renderHook(() => useS((e) => e.code))
    expect(result.current).toBeNull()
    act(() => useS.getState().choisir('LM'))
    expect(result.current).toBe('LM')
  })

  it('un sélecteur renvoyant un nouvel objet ne provoque pas de boucle de rendu', () => {
    const useS = creerStore<{ l: number[] }>(() => ({ l: [1, 2, 3] }))
    const { result } = renderHook(() => useS((e) => e.l.filter((x) => x > 1)))
    expect(result.current).toEqual([2, 3])
  })
})
