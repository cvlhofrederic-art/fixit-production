// tests/components/modules-section-pt.test.tsx
//
// Page « Módulos » (components/dashboard/ModulesSection.tsx, artisan et société BTP) et noms des rubriques du menu
// (hooks/useModuleCategories.ts) en portugais : rapport i18n PT-PT du 17/11/2026. Les rubriques par défaut sont
// enregistrées avec leur nom français ; en portugais, leur nom portugais s'affiche tant que l'utilisateur ne les a pas
// renommées, et valider le champ sans rien changer ne remplace pas le nom enregistré.

import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook } from '@testing-library/react'

const etat = vi.hoisted(() => ({ locale: 'pt' as 'pt' | 'fr' }))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle }),
  useLocale: () => etat.locale,
}))

import ModulesSection from '@/components/dashboard/ModulesSection'
import { useModulesConfig } from '@/hooks/useModulesConfig'
import { buildDefaultCategories, nomDeRubrique, nomRubriqueApresSaisie, type ModCategory } from '@/hooks/useModuleCategories'

afterEach(() => {
  cleanup()
  etat.locale = 'pt'
})

describe('nomDeRubrique / nomRubriqueApresSaisie', () => {
  it('rubrique par défaut : nom portugais en portugais, nom enregistré en français', () => {
    expect(nomDeRubrique({ id: 'cat-pilotage', name: 'Pilotage' }, true)).toBe('Gestão')
    expect(nomDeRubrique({ id: 'cat-pilotage', name: 'Pilotage' }, false)).toBe('Pilotage')
    expect(nomDeRubrique({ id: 'cat-compte', name: 'Compte' }, true)).toBe('Conta')
    // Rubrique recréée par la migration (son identifiant pour nom).
    expect(nomDeRubrique({ id: 'cat-chantiers', name: 'cat-chantiers' }, true)).toBe('Obras')
  })

  it('rubrique renommée ou créée par l’utilisateur : son nom, dans les deux langues', () => {
    expect(nomDeRubrique({ id: 'cat-pilotage', name: 'Direção' }, true)).toBe('Direção')
    expect(nomDeRubrique({ id: 'cat-1731830000000', name: 'Nova categoria' }, true)).toBe('Nova categoria')
  })

  it('valider le champ sans changer le nom affiché garde le nom enregistré', () => {
    const cat = { id: 'cat-pilotage', name: 'Pilotage' }
    expect(nomRubriqueApresSaisie(cat, 'Gestão', true)).toBe('Pilotage')
    expect(nomRubriqueApresSaisie(cat, '  ', true)).toBe('Pilotage')
    expect(nomRubriqueApresSaisie(cat, 'Direção geral', true)).toBe('Direção geral')
    expect(nomRubriqueApresSaisie(cat, 'Pilotage', false)).toBe('Pilotage')
  })
})

function monter(locale: 'pt' | 'fr') {
  etat.locale = locale
  const { result } = renderHook(() => useModulesConfig('artisan-test', (cle: string) => cle, locale === 'pt'))
  const modules = result.current.ALL_MODULES
  const categories = buildDefaultCategories(modules)
  const setCategories = vi.fn<(suivantes: ModCategory[]) => void>()
  const vue = render(
    <ModulesSection
      orgRole="pro_societe"
      ALL_MODULES={modules}
      modulesConfig={modules.map((m, i) => ({ id: m.id, enabled: true, order: i }))}
      saveModulesConfig={vi.fn()}
      reorderModuleTo={vi.fn()}
      categories={categories}
      setCategories={setCategories}
    />,
  )
  return { ...vue, setCategories }
}

describe('page Módulos', () => {
  it('portugais : textes, noms de rubriques et de modules en PT-PT', () => {
    const { container } = monter('pt')
    const texte = (container.textContent ?? '').replace(/\s/g, ' ')
    expect(texte).toContain('Módulos')
    expect(texte).toContain('ORGANIZAÇÃO DO MENU')
    expect(texte).toContain('+ Categoria')
    expect(texte).toContain('↻ Repor')
    expect(texte).toContain('ativos)')
    expect(texte).toContain('Autos de medição')
    expect(texte).toContain('Retenções para garantia')
    expect(texte).toContain('Programa de recomendação')
    expect(texte).not.toMatch(/Activez|Catégorie|Réinitialiser|actifs|Glissez|Aucun module|Pilotagem|Prestações|DC4|DPGF|Marketplace BTP/)
    expect(texte).not.toMatch(/[—–]/)
    const noms = [...container.querySelectorAll<HTMLInputElement>('.mc-cat-name')].map(champ => champ.value)
    expect(noms.slice(0, 3)).toEqual(['Gestão', 'Obras', 'Comercial'])
  })

  it('portugais : quitter le champ d’une rubrique sans la renommer ne remplace pas son nom enregistré', () => {
    const { container, setCategories } = monter('pt')
    const champ = container.querySelector<HTMLInputElement>('.mc-cat-name')
    if (!champ) throw new Error('champ de rubrique absent')
    fireEvent.blur(champ)
    const suivantes = setCategories.mock.calls.at(-1)?.[0]
    expect(suivantes?.[0]).toMatchObject({ id: 'cat-pilotage', name: 'Pilotage' })
  })

  it('français : inchangé', () => {
    const { container } = monter('fr')
    const texte = (container.textContent ?? '').replace(/\s/g, ' ')
    expect(texte).toContain('Activez, désactivez et réorganisez vos modules par catégorie — la sidebar se met à jour en temps réel')
    expect(texte).toContain('📦 ORGANISATION DU MENU')
    const noms = [...container.querySelectorAll<HTMLInputElement>('.mc-cat-name')].map(champ => champ.value)
    expect(noms.slice(0, 3)).toEqual(['Pilotage', 'Chantiers', 'Commercial'])
  })
})
