/**
 * Organisation du menu (écran « Modules ») enregistrée par compte pour une société BTP (constat coquille-10 de
 * l'audit du 11/11/2026). Elle était rangée sous une clé commune à tous les comptes du navigateur : une société qui
 * masquait « Factures » le masquait aussi pour l'autre compte ouvert sur le même poste.
 *
 * Désormais, avec un identifiant de compte, l'organisation est lue et enregistrée sous une clé propre au compte ;
 * l'ancienne clé commune sert de point de départ tant que le compte n'a rien enregistré : elle est lue, jamais
 * supprimée ni réécrite. Sans identifiant (tableau de bord artisan et autres rôles), la clé commune est inchangée.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useModulesConfig, type ModuleDef } from '@/hooks/useModulesConfig'
import { buildDefaultCategories, useModuleCategories, type ModCategory } from '@/hooks/useModuleCategories'

const ANCIENNE_CLE = 'fixit_modules_categories_v3'
const t = (cle: string, repli?: string) => repli ?? cle
const modules = (): ModuleDef[] => renderHook(() => useModulesConfig('fiche-a', t, false)).result.current.ALL_MODULES

/** Interrupteur d'un module dans une organisation. */
const allume = (categories: ModCategory[], id: string) => categories.flatMap((c) => c.modules).find((m) => m.id === id)?.on
/** Rubrique qui contient un module. */
const rubriqueDe = (categories: ModCategory[], id: string) => categories.find((c) => c.modules.some((m) => m.id === id))?.id
const eteindre = (categories: ModCategory[], id: string): ModCategory[] =>
  categories.map((c) => ({ ...c, modules: c.modules.map((m) => (m.id === id ? { ...m, on: false } : m)) }))

async function monter(ALL: ModuleDef[], compteId?: string) {
  const rendu = renderHook(() => useModuleCategories(ALL, compteId))
  await waitFor(() => expect(rendu.result.current.ready).toBe(true))
  return rendu
}

describe('organisation du menu — une clé par compte (société BTP)', () => {
  let ALL: ModuleDef[]
  let ancienneValeur: string

  beforeEach(() => {
    localStorage.clear()
    ALL = modules()
    // Organisation enregistrée avant le correctif, sous la clé commune : une rubrique renommée par l'utilisateur.
    const ancienne = buildDefaultCategories(ALL).map((c) => (c.id === 'cat-commercial' ? { ...c, name: 'Ventes' } : c))
    ancienneValeur = JSON.stringify(ancienne)
    localStorage.setItem(ANCIENNE_CLE, ancienneValeur)
  })

  it('deux sociétés du même navigateur : masquer « Factures » chez l’une ne le masque pas chez l’autre', async () => {
    const a = await monter(ALL, 'fiche-a')
    // L'ancienne organisation sert de point de départ.
    expect(a.result.current.categories.find((c) => c.id === 'cat-commercial')?.name).toBe('Ventes')
    expect(allume(a.result.current.categories, 'factures')).toBe(true)

    act(() => { a.result.current.setCategories(eteindre(a.result.current.categories, 'factures')) })
    expect(allume(a.result.current.categories, 'factures')).toBe(false)

    // L'ancienne clé commune n'est ni supprimée ni réécrite ; la modification part sous la clé du compte.
    expect(localStorage.getItem(ANCIENNE_CLE)).toBe(ancienneValeur)
    expect(allume(JSON.parse(localStorage.getItem(`${ANCIENNE_CLE}_fiche-a`) ?? '[]'), 'factures')).toBe(false)

    const b = await monter(ALL, 'fiche-b')
    expect(allume(b.result.current.categories, 'factures')).toBe(true)
    expect(b.result.current.categories.find((c) => c.id === 'cat-commercial')?.name).toBe('Ventes')

    const aEncore = await monter(ALL, 'fiche-a')
    expect(allume(aEncore.result.current.categories, 'factures')).toBe(false)
  })

  it('l’identifiant du compte arrive après le montage (chargement du tableau de bord) : son organisation est relue', async () => {
    const propre = eteindre(buildDefaultCategories(ALL), 'devis')
    localStorage.setItem(`${ANCIENNE_CLE}_fiche-a`, JSON.stringify(propre))

    const rendu = renderHook(({ compteId }) => useModuleCategories(ALL, compteId), { initialProps: { compteId: undefined as string | undefined } })
    await waitFor(() => expect(rendu.result.current.ready).toBe(true))
    expect(allume(rendu.result.current.categories, 'devis')).toBe(true)

    rendu.rerender({ compteId: 'fiche-a' })
    await waitFor(() => expect(allume(rendu.result.current.categories, 'devis')).toBe(false))
    expect(localStorage.getItem(ANCIENNE_CLE)).toBe(ancienneValeur)
  })

  it('sans identifiant de compte (artisan, autres rôles) : la clé commune, lue et enregistrée comme avant', async () => {
    const rendu = await monter(ALL)
    expect(rendu.result.current.categories.find((c) => c.id === 'cat-commercial')?.name).toBe('Ventes')
    act(() => { rendu.result.current.setCategories(eteindre(rendu.result.current.categories, 'factures')) })
    expect(allume(JSON.parse(localStorage.getItem(ANCIENNE_CLE) ?? '[]'), 'factures')).toBe(false)
    expect(Object.keys(localStorage).filter((k) => k.startsWith(`${ANCIENNE_CLE}_`))).toEqual([])
  })

  describe('déplacement unique d’« Estimation matériaux » vers « Chantiers » (organisation commune d’avant ce déplacement)', () => {
    let communeAvantDeplacement: string

    beforeEach(() => {
      const parDefaut = buildDefaultCategories(ALL)
      const estimation = parDefaut.flatMap((c) => c.modules).find((m) => m.id === 'estimation_materiaux')
      if (!estimation) throw new Error('module « estimation_materiaux » absent de la liste des modules')
      // Organisation commune enregistrée avant le déplacement : le module rangé dans « Commercial ».
      const ancienne = parDefaut.map((c) => {
        const sansEstimation = c.modules.filter((m) => m.id !== 'estimation_materiaux')
        return { ...c, modules: c.id === 'cat-commercial' ? [...sansEstimation, estimation] : sansEstimation }
      })
      communeAvantDeplacement = JSON.stringify(ancienne)
      localStorage.setItem(ANCIENNE_CLE, communeAvantDeplacement)
    })

    it('compte sans organisation propre : module replacé à l’affichage, aucune clé du compte créée au montage, clé commune intacte', async () => {
      const rendu = await monter(ALL, 'fiche-a')

      expect(rubriqueDe(rendu.result.current.categories, 'estimation_materiaux')).toBe('cat-chantiers')
      // La clé du compte ne naît qu'à sa première modification du menu : jusque-là, il suit la clé commune.
      expect(localStorage.getItem(`${ANCIENNE_CLE}_fiche-a`)).toBeNull()
      expect(localStorage.getItem(ANCIENNE_CLE)).toBe(communeAvantDeplacement)
    })

    it('sans identifiant de compte (artisan, autres rôles) : déplacement enregistré sous la clé commune, comme avant', async () => {
      const rendu = await monter(ALL)

      expect(rubriqueDe(rendu.result.current.categories, 'estimation_materiaux')).toBe('cat-chantiers')
      expect(rubriqueDe(JSON.parse(localStorage.getItem(ANCIENNE_CLE) ?? '[]'), 'estimation_materiaux')).toBe('cat-chantiers')
      expect(Object.keys(localStorage).filter((k) => k.startsWith(`${ANCIENNE_CLE}_`))).toEqual([])
    })
  })
})
