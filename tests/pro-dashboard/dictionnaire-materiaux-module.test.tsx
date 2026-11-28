// Branchement du Dictionnaire matériaux dans le tableau de bord pro : le module existe dans les langues dont le pays
// a un dictionnaire (Portugal), se range sous « Estimation matériaux », et disparaît de la barre latérale en
// français même si l'état enregistré du navigateur le contient encore (compte ouvert dans les deux langues).
// Côté artisan (menu fixe), il se range sous « Materiais », en portugais seulement (demande du 15/11/2026).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

import V5Sidebar from '@/components/dashboard/V5Sidebar'
import V5SidebarArtisan from '@/components/dashboard/V5SidebarArtisan'
import { useModulesConfig, type ModuleDef } from '@/hooks/useModulesConfig'
import { buildDefaultCategories, useModuleCategories, type ModCategory } from '@/hooks/useModuleCategories'
import {
  ID_MODULE_DICTIONNAIRE,
  PAYS_AVEC_DICTIONNAIRE,
  dictionnaireDisponible,
  paysDeLaLangue,
} from '@/lib/dictionnaire-materiaux/disponibilite'
import { dictionnairePour, paysInscrits } from '@/lib/dictionnaire-materiaux'

const CLE_CATEGORIES = 'fixit_modules_categories_v3'
const t = (cle: string, repli?: string) => repli ?? cle

const modules = (isPt: boolean): ModuleDef[] => renderHook(() => useModulesConfig('artisan-1', t, isPt)).result.current.ALL_MODULES
const chantiers = (categories: ModCategory[]) => categories.find((c) => c.id === 'cat-chantiers')?.modules.map((m) => m.id) ?? []
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

describe('Dictionnaire matériaux — module du tableau de bord pro', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('n’est disponible que pour les pays inscrits au registre', () => {
    expect([...PAYS_AVEC_DICTIONNAIRE].sort((a, b) => a.localeCompare(b))).toEqual(paysInscrits().sort((a, b) => a.localeCompare(b)))
    for (const pays of PAYS_AVEC_DICTIONNAIRE) expect(dictionnairePour(pays)?.pays).toBe(pays)
    expect(dictionnaireDisponible('PT')).toBe(true)
    expect(dictionnaireDisponible('FR')).toBe(false)
    expect(dictionnairePour('FR')).toBeNull()
    expect(paysDeLaLangue('pt')).toBe('PT')
    expect(paysDeLaLangue('fr')).toBe('FR')
    expect(paysDeLaLangue('en')).toBe('FR')
  })

  it('figure en portugais juste après l’estimation des matériaux, pas en français', () => {
    const pt = modules(true)
    const position = pt.findIndex((m) => m.id === ID_MODULE_DICTIONNAIRE)
    expect(pt[position - 1].id).toBe('estimation_materiaux')
    expect(pt[position]).toMatchObject({ label: 'Dicionário de materiais', category: 'chantiers', icon: '📖' })
    expect(modules(false).some((m) => m.id === ID_MODULE_DICTIONNAIRE)).toBe(false)
    // Rien d'autre ne change entre les deux langues.
    expect(modules(false).map((m) => m.id)).toEqual(pt.map((m) => m.id).filter((id) => id !== ID_MODULE_DICTIONNAIRE))
  })

  it('se range par défaut sous « Estimation matériaux » dans la catégorie Chantiers', () => {
    const ordre = chantiers(buildDefaultCategories(modules(true)))
    expect(ordre.slice(ordre.indexOf('estimation_materiaux'), ordre.indexOf('estimation_materiaux') + 3)).toEqual([
      'estimation_materiaux',
      ID_MODULE_DICTIONNAIRE,
      'calendar',
    ])
    expect(chantiers(buildDefaultCategories(modules(false)))).not.toContain(ID_MODULE_DICTIONNAIRE)
  })

  it('s’insère sous l’estimation dans une barre latérale déjà enregistrée, sans rien déplacer d’autre', async () => {
    const enregistre: ModCategory[] = [
      {
        id: 'cat-chantiers',
        name: 'Mes chantiers',
        open: true,
        modules: [
          { id: 'rapports', icon: '📋', name: 'Rapports', on: true },
          { id: 'estimation_materiaux', icon: '📐', name: 'Estimation', on: false },
          { id: 'chantiers', icon: '🏗️', name: 'Chantiers', on: true },
        ],
      },
    ]
    localStorage.setItem(CLE_CATEGORIES, JSON.stringify(enregistre))
    const ALL = modules(true)
    const { result } = renderHook(() => useModuleCategories(ALL))
    await waitFor(() => expect(result.current.ready).toBe(true))
    const cat = result.current.categories.find((c) => c.id === 'cat-chantiers') as ModCategory
    expect(cat.name).toBe('Mes chantiers')
    expect(cat.modules.slice(0, 4).map((m) => m.id)).toEqual(['rapports', 'estimation_materiaux', ID_MODULE_DICTIONNAIRE, 'chantiers'])
    expect(cat.modules.find((m) => m.id === ID_MODULE_DICTIONNAIRE)).toMatchObject({ name: 'Dicionário de materiais', on: true })
    // Le choix de l'utilisateur (module éteint) est conservé.
    expect(cat.modules.find((m) => m.id === 'estimation_materiaux')?.on).toBe(false)
    // L'état enregistré n'est pas réécrit par ce simple affichage.
    expect(JSON.parse(localStorage.getItem(CLE_CATEGORIES) ?? '[]')).toEqual(enregistre)
  })

  it('suit l’estimation quand celle-ci avait été rangée ailleurs par l’utilisateur', async () => {
    localStorage.setItem(CLE_CATEGORIES, JSON.stringify([
      { id: 'cat-chantiers', name: 'Chantiers', open: true, modules: [{ id: 'chantiers', icon: '🏗️', name: 'Chantiers', on: true }] },
      { id: 'cat-perso', name: 'Perso', open: true, modules: [{ id: 'estimation_materiaux', icon: '📐', name: 'Estimation', on: true }] },
    ]))
    const ALL = modules(true)
    const { result } = renderHook(() => useModuleCategories(ALL))
    await waitFor(() => expect(result.current.ready).toBe(true))
    // « estimation_materiaux » est d'abord ramenée dans Chantiers (migration existante), puis le dictionnaire la suit.
    const ordre = chantiers(result.current.categories)
    expect(ordre.indexOf(ID_MODULE_DICTIONNAIRE)).toBe(ordre.indexOf('estimation_materiaux') + 1)
  })

  it('disparaît de la barre latérale française même si l’état enregistré le contient', async () => {
    const ALL_PT = modules(true)
    localStorage.setItem(CLE_CATEGORIES, JSON.stringify([
      {
        id: 'cat-chantiers',
        name: 'Chantiers',
        open: true,
        modules: [
          { id: 'estimation_materiaux', icon: '📐', name: 'Estimativa de materiais', on: true },
          { id: ID_MODULE_DICTIONNAIRE, icon: '📖', name: 'Dicionário de materiais', on: true },
          { id: 'module-inconnu', icon: '❔', name: 'Ancien module', on: true },
        ],
      },
    ]))
    const ALL_FR = modules(false)
    const fr = renderHook(() => useModuleCategories(ALL_FR))
    await waitFor(() => expect(fr.result.current.ready).toBe(true))
    const ordreFr = chantiers(fr.result.current.categories)
    expect(ordreFr).not.toContain(ID_MODULE_DICTIONNAIRE)
    // Seul ce module dépend du pays : un identifiant inconnu enregistré reste affiché, comme avant.
    expect(ordreFr).toContain('module-inconnu')
    expect(ordreFr).toContain('estimation_materiaux')

    // De retour en portugais, le même état enregistré le montre toujours.
    const pt = renderHook(() => useModuleCategories(ALL_PT))
    await waitFor(() => expect(pt.result.current.ready).toBe(true))
    expect(chantiers(pt.result.current.categories)).toContain(ID_MODULE_DICTIONNAIRE)
  })

  it('garde sa place et son interrupteur réglés en portugais quand on modifie la barre latérale en français', async () => {
    const ALL_PT = modules(true)
    const ALL_FR = modules(false)
    // En portugais : le dictionnaire a été éteint et rangé en tête de « Chantiers ».
    localStorage.setItem(CLE_CATEGORIES, JSON.stringify([
      {
        id: 'cat-chantiers',
        name: 'Chantiers',
        open: true,
        modules: [
          { id: ID_MODULE_DICTIONNAIRE, icon: '📖', name: 'Dicionário de materiais', on: false },
          { id: 'estimation_materiaux', icon: '📐', name: 'Estimativa de materiais', on: true },
          { id: 'chantiers', icon: '🏗️', name: 'Obras', on: true },
        ],
      },
    ]))
    // En français, n'importe quelle modification enregistre l'état (ici, la catégorie renommée).
    const fr = renderHook(() => useModuleCategories(ALL_FR))
    await waitFor(() => expect(fr.result.current.ready).toBe(true))
    expect(chantiers(fr.result.current.categories)).not.toContain(ID_MODULE_DICTIONNAIRE)
    act(() => {
      fr.result.current.setCategories(fr.result.current.categories.map((c) => (c.id === 'cat-chantiers' ? { ...c, name: 'Mes chantiers' } : c)))
    })
    expect(chantiers(fr.result.current.categories)).not.toContain(ID_MODULE_DICTIONNAIRE)

    // De retour en portugais : toujours éteint, toujours en tête, et la modification faite en français est là.
    const pt = renderHook(() => useModuleCategories(ALL_PT))
    await waitFor(() => expect(pt.result.current.ready).toBe(true))
    const cat = pt.result.current.categories.find((c) => c.id === 'cat-chantiers') as ModCategory
    expect(cat.name).toBe('Mes chantiers')
    expect(cat.modules[0]).toMatchObject({ id: ID_MODULE_DICTIONNAIRE, on: false })
    expect(cat.modules.filter((m) => m.id === ID_MODULE_DICTIONNAIRE)).toHaveLength(1)
  })

  it('garde l’interrupteur du module réglé en portugais quand on règle les modules en français', async () => {
    const CLE_REGLAGES = 'fixit_modules_config_artisan-1'
    const pt = modules(true)
    // En portugais : le dictionnaire éteint, en dernière position.
    localStorage.setItem(CLE_REGLAGES, JSON.stringify(pt.map((m, i) => ({
      id: m.id,
      enabled: m.id !== ID_MODULE_DICTIONNAIRE,
      order: m.id === ID_MODULE_DICTIONNAIRE ? 500 : i,
    }))))
    // En français : un module éteint, ce qui enregistre les réglages de cette langue.
    const fr = renderHook(() => useModulesConfig('artisan-1', t, false))
    await waitFor(() => expect(fr.result.current.modulesConfig.length).toBeGreaterThan(0))
    expect(fr.result.current.modulesConfig.some((c) => c.id === ID_MODULE_DICTIONNAIRE)).toBe(false)
    act(() => {
      fr.result.current.setModulesConfig(fr.result.current.modulesConfig.map((c) => (c.id === 'meteo' ? { ...c, enabled: false } : c)))
    })

    // De retour en portugais : le dictionnaire est toujours éteint, à sa place ; la météo éteinte en français aussi.
    const retour = renderHook(() => useModulesConfig('artisan-1', t, true))
    await waitFor(() => expect(retour.result.current.modulesConfig.length).toBeGreaterThan(0))
    expect(retour.result.current.isModuleEnabled(ID_MODULE_DICTIONNAIRE)).toBe(false)
    expect(retour.result.current.modulesConfig.find((c) => c.id === ID_MODULE_DICTIONNAIRE)?.order).toBe(500)
    expect(retour.result.current.isModuleEnabled('meteo')).toBe(false)
  })

  describe('dans la barre latérale BTP', () => {
    async function monterBarre(isPt: boolean) {
      const ALL = modules(isPt)
      const navigateTo = vi.fn()
      await act(async () => {
        render(
          <V5Sidebar
            activePage="home"
            navigateTo={navigateTo}
            handleLogout={vi.fn()}
            isProGerant
            proCanAccess={() => true}
            isModuleEnabled={() => true}
            isPt={isPt}
            pendingBookings={{ length: 0 }}
            unreadMsgCount={0}
            dynamicCategories={buildDefaultCategories(ALL)}
            definitionsModules={ALL}
          />,
        )
      })
      const champ = screen.getByRole('textbox', { name: isPt ? 'Pesquisar um módulo' : 'Rechercher un module' })
      const libelles = () =>
        screen.getAllByRole('button').map((b) => b.querySelector('.v5-sb-label')?.textContent).filter((l): l is string => !!l)
      return { navigateTo, champ, libelles }
    }

    it('apparaît en portugais sous « Estimativa de materiais » et s’ouvre au clic', async () => {
      const { navigateTo, libelles } = await monterBarre(true)
      const menu = libelles()
      expect(menu[menu.indexOf('Estimativa de materiais') + 1]).toBe('Dicionário de materiais')
      fireEvent.click(screen.getByRole('button', { name: /Dicionário de materiais$/ }))
      expect(navigateTo).toHaveBeenCalledWith(ID_MODULE_DICTIONNAIRE)
    })

    it('se trouve par la recherche de modules : son nom, ou ce qu’on y cherche (« silicone », « espátula »)', async () => {
      const { navigateTo, champ, libelles } = await monterBarre(true)
      fireEvent.change(champ, { target: { value: 'dicion' } })
      expect(libelles()).toEqual(['Dicionário de materiais'])
      for (const saisie of ['silicone', 'espatula']) {
        fireEvent.change(champ, { target: { value: saisie } })
        expect(libelles(), saisie).toEqual(['Dicionário de materiais'])
      }
      fireEvent.keyDown(champ, { key: 'Enter' })
      expect(navigateTo).toHaveBeenCalledWith(ID_MODULE_DICTIONNAIRE)
    })

    it('n’existe pas dans la barre latérale française', async () => {
      const { champ, libelles } = await monterBarre(false)
      expect(libelles()).toContain('Estimation matériaux')
      expect(libelles()).not.toContain('Dictionnaire matériaux')
      fireEvent.change(champ, { target: { value: 'dictionnaire' } })
      expect(libelles()).toEqual([])
    })
  })

  describe('dans la barre latérale artisan', () => {
    async function monterBarreArtisan(isPt: boolean, isModuleEnabled: (id: string) => boolean = () => true) {
      const navigateTo = vi.fn()
      await act(async () => {
        render(
          <V5SidebarArtisan
            activePage="home"
            navigateTo={navigateTo}
            handleLogout={vi.fn()}
            isModuleEnabled={isModuleEnabled}
            isPt={isPt}
            pendingBookings={{ length: 0 }}
            unreadMsgCount={0}
          />,
        )
      })
      const libelles = () =>
        screen.getAllByRole('button').map((b) => b.querySelector('.v5-sb-label')?.textContent).filter((l): l is string => !!l)
      return { navigateTo, libelles }
    }

    it('apparaît en portugais juste sous « Materiais » et s’ouvre au clic', async () => {
      const { navigateTo, libelles } = await monterBarreArtisan(true)
      const menu = libelles()
      expect(menu[menu.indexOf('Materiais') + 1]).toBe('Dicionário de materiais')
      expect(menu.filter((l) => l === 'Dicionário de materiais')).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: /Dicionário de materiais$/ }))
      expect(navigateTo).toHaveBeenCalledWith(ID_MODULE_DICTIONNAIRE)
    })

    it('suit son propre interrupteur de module, pas celui de « Materiais »', async () => {
      const sansMateriaux = await monterBarreArtisan(true, (id) => id !== 'materiaux')
      expect(sansMateriaux.libelles()).not.toContain('Materiais')
      expect(sansMateriaux.libelles()).toContain('Dicionário de materiais')
      cleanup()
      const eteint = await monterBarreArtisan(true, (id) => id !== ID_MODULE_DICTIONNAIRE)
      expect(eteint.libelles()).toContain('Materiais')
      expect(eteint.libelles()).not.toContain('Dicionário de materiais')
    })

    it('n’existe pas dans la barre latérale artisan française, et rien d’autre n’y change', async () => {
      const fr = await monterBarreArtisan(false)
      const menuFr = fr.libelles()
      expect(menuFr).toContain('Matériaux')
      expect(menuFr).not.toContain('Dictionnaire matériaux')
      expect(menuFr).not.toContain('Dicionário de materiais')
      cleanup()
      // Même nombre d'entrées qu'en portugais, à l'entrée du dictionnaire près.
      const pt = await monterBarreArtisan(true)
      expect(pt.libelles()).toHaveLength(menuFr.length + 1)
    })
  })

  it('est rendu par la page du tableau de bord et préchargé par la barre latérale', () => {
    const page = lire('app/(commun)/pro/dashboard/page.tsx')
    expect(page).toContain("const DictionnaireMateriauxSection = dynamic(() => import('@/components/dashboard/DictionnaireMateriauxSection')")
    expect(page).toContain("{activePage === 'dictionnaire_materiaux' && (")
    expect(page).toContain("dictionnaire_materiaux: 'Dictionnaire matériaux'")
    expect(page).toContain("dictionnaire_materiaux: 'Dicionário de materiais'")
    for (const barre of ['components/dashboard/V5Sidebar.tsx', 'components/dashboard/V5SidebarArtisan.tsx']) {
      expect(lire(barre), barre).toContain(
        "dictionnaire_materiaux: () => import('@/components/dashboard/DictionnaireMateriauxSection')",
      )
    }
    // La section est rendue pour tout compte pro : aucune condition de rôle sur son bloc.
    expect(page).toMatch(/\{activePage === 'dictionnaire_materiaux' && \(\s*<SectionErrorBoundary[^>]*>\s*<DictionnaireMateriauxSection \/>/)
    expect(ID_MODULE_DICTIONNAIRE).toBe('dictionnaire_materiaux')
  })

  it('ne charge pas le catalogue avec la barre latérale', () => {
    // La barre latérale ne lit que la disponibilité : aucun import des données ni du registre.
    for (const fichier of [
      'hooks/useModulesConfig.ts',
      'hooks/useModuleCategories.ts',
      'lib/dictionnaire-materiaux/disponibilite.ts',
      'components/dashboard/V5Sidebar.tsx',
      'components/dashboard/V5SidebarArtisan.tsx',
    ]) {
      const source = lire(fichier)
      expect(source, fichier).not.toMatch(/from ['"]@\/lib\/dictionnaire-materiaux['"]/)
      expect(source, fichier).not.toMatch(/donnees\//)
    }
  })
})
