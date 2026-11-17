import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useCodeCoproCourant, useCoproCourante, useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Lecture réactive de la copropriété choisie dans le sélecteur du haut de page : contrairement à
 * codeCoproSelectionne (lu une fois au montage), ces hooks suivent chaque changement de sélection.
 */

beforeEach(() => {
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

afterEach(() => {
  cleanup()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

describe('useCodeCoproCourant', () => {
  it('null tant qu’aucune copropriété n’est choisie, puis suit chaque choix', () => {
    const { result } = renderHook(() => useCodeCoproCourant())
    expect(result.current).toBeNull()
    act(() => useSelectionDossier.getState().choisirCopro('CV'))
    expect(result.current).toBe('CV')
    act(() => useSelectionDossier.getState().choisirCopro('TL'))
    expect(result.current).toBe('TL')
  })

  it('le défaut de l’écran ne sert que sans sélection', () => {
    const { result } = renderHook(() => useCodeCoproCourant('VM'))
    expect(result.current).toBe('VM')
    act(() => useSelectionDossier.getState().choisirCopro('LM'))
    expect(result.current).toBe('LM')
    act(() => useSelectionDossier.getState().choisirCopro(null))
    expect(result.current).toBe('VM')
  })
})

describe('useCoproCourante', () => {
  it('copropriété du code choisi, mise à jour sans remontage', () => {
    useSelectionDossier.setState({ code: 'LM' })
    const { result } = renderHook(() => useCoproCourante())
    expect(result.current.code).toBe('LM')
    expect(result.current.nom).toBe('Résidence Le Méridien')
    act(() => useSelectionDossier.getState().choisirCopro('TL'))
    expect(result.current.nom).toBe('Copropriété Les Tilleuls')
  })

  it('sans sélection : la copropriété du défaut de l’écran', () => {
    const { result } = renderHook(() => useCoproCourante('VM'))
    expect(result.current.nom).toBe('Villa Montaigne')
  })
})
