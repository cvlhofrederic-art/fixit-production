// tests/components/btp-sidebar-recherche-modules.test.tsx
//
// Barre de recherche de modules de la barre latérale BTP pro (V5Sidebar, orgRole pro_societe).
// Le menu est monté avec la vraie liste de modules (useModulesConfig → buildDefaultCategories) : un libellé
// renommé ou un module retiré fait échouer ces tests au lieu de casser la recherche en silence.
// Règle n° 1 (artisan vs BTP) : la barre latérale artisan ne reçoit pas ce champ.

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react'

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
import { useModulesConfig } from '@/hooks/useModulesConfig'
import { buildDefaultCategories } from '@/hooks/useModuleCategories'

const traduire = (cle: string) => cle
const tousActifs = () => true

interface OptionsMontage {
  isPt?: boolean
  isModuleEnabled?: (id: string) => boolean
  activePage?: string
}

async function monter({ isPt = false, isModuleEnabled = tousActifs, activePage = 'home' }: OptionsMontage = {}) {
  const { result } = renderHook(() => useModulesConfig('artisan-test', traduire, isPt))
  const modules = result.current.ALL_MODULES
  const navigateTo = vi.fn()
  await act(async () => {
    render(
      <V5Sidebar
        activePage={activePage}
        navigateTo={navigateTo}
        handleLogout={vi.fn()}
        isProGerant
        proCanAccess={tousActifs}
        isModuleEnabled={isModuleEnabled}
        isPt={isPt}
        pendingBookings={{ length: 0 }}
        unreadMsgCount={0}
        dynamicCategories={buildDefaultCategories(modules)}
        definitionsModules={modules}
      />,
    )
  })
  const champ = screen.getByRole('textbox', { name: isPt ? 'Pesquisar um módulo' : 'Rechercher un module' }) as HTMLInputElement
  return { navigateTo, champ }
}

const saisir = (champ: HTMLInputElement, texte: string) => fireEvent.change(champ, { target: { value: texte } })
const touche = (champ: HTMLInputElement, key: string) => fireEvent.keyDown(champ, { key })
/** Libellés des modules affichés dans la zone de navigation (hors bloc « Compte » masqué). */
const modulesAffiches = () =>
  screen.getAllByRole('button')
    .map(bouton => bouton.querySelector('.v5-sb-label')?.textContent)
    .filter((libelle): libelle is string => !!libelle)

describe('Barre latérale BTP — champ de recherche', () => {
  it('le champ est présent et, sans saisie, le menu est complet', async () => {
    const { champ } = await monter()
    expect(champ.value).toBe('')
    expect(champ.getAttribute('placeholder')).toBe('Rechercher un module…')
    for (const libelle of ['Tableau de bord', 'Chantiers', 'Devis', 'Factures', 'Comptabilité', 'Mon profil', 'Modules', 'Aide']) {
      expect(screen.getByRole('button', { name: new RegExp(`${libelle}$`) })).toBeVisible()
    }
    expect(screen.getByText('Déconnexion')).toBeVisible()
    expect(screen.queryByText('Aucun module trouvé')).toBeNull()
  })

  it('« fact » ne laisse que Factures ; le bloc Compte et la déconnexion sont masqués pendant la recherche', async () => {
    const { champ } = await monter()
    saisir(champ, 'fact')
    expect(modulesAffiches()).toEqual(['Factures'])
    expect(screen.getByText('Déconnexion')).not.toBeVisible()
    expect(screen.getByRole('status').textContent).toBe('1 module trouvé. Entrée pour ouvrir Factures.')
  })

  it('sans accents ni majuscules : « equipes » trouve Équipes', async () => {
    const { champ } = await monter()
    saisir(champ, 'equipes')
    expect(modulesAffiches()).toEqual(['Équipes', 'Pointage équipes'])
  })

  it('Entrée ouvre la meilleure correspondance, puis le menu complet revient', async () => {
    const { champ, navigateTo } = await monter()
    saisir(champ, 'devis')
    expect(modulesAffiches()).toEqual(['Devis', 'Devis Fournisseurs'])
    expect(screen.getByRole('button', { name: /Devis$/ }).className).toContain('choix')
    expect(screen.getByRole('status').textContent).toBe('2 modules trouvés. Entrée pour ouvrir Devis.')
    touche(champ, 'Enter')
    expect(navigateTo).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith('devis')
    expect(champ.value).toBe('')
    expect(screen.getByRole('button', { name: /Factures$/ })).toBeVisible()
    expect(screen.getByText('Déconnexion')).toBeVisible()
  })

  it('flèches bas et haut : choisissent un autre résultat, bornées aux extrémités', async () => {
    const { champ, navigateTo } = await monter()
    saisir(champ, 'devis')
    touche(champ, 'ArrowUp') // déjà sur le premier : ne bouge pas
    expect(screen.getByRole('button', { name: /Devis$/ }).className).toContain('choix')
    touche(champ, 'ArrowDown')
    expect(screen.getByRole('button', { name: /Devis Fournisseurs$/ }).className).toContain('choix')
    expect(screen.getByRole('button', { name: /Devis$/ }).className).not.toContain('choix')
    touche(champ, 'ArrowDown') // déjà sur le dernier : ne bouge pas
    expect(screen.getByRole('button', { name: /Devis Fournisseurs$/ }).className).toContain('choix')
    touche(champ, 'Enter')
    expect(navigateTo).toHaveBeenCalledWith('rfq_btp')
  })

  it('une nouvelle saisie remet le choix sur la meilleure correspondance', async () => {
    const { champ } = await monter()
    saisir(champ, 'devis')
    touche(champ, 'ArrowDown')
    saisir(champ, 'devi')
    expect(screen.getByRole('button', { name: /Devis$/ }).className).toContain('choix')
  })

  it('« prestations » ouvre la page prestations (alias du module motifs)', async () => {
    const { champ, navigateTo } = await monter()
    saisir(champ, 'prestations')
    touche(champ, 'Enter')
    expect(navigateTo).toHaveBeenCalledWith('prestations')
  })

  it('clic sur un résultat : ouvre le module et referme la recherche', async () => {
    const { champ, navigateTo } = await monter()
    saisir(champ, 'gantt')
    fireEvent.click(screen.getByRole('button', { name: /Planification Gantt$/ }))
    expect(navigateTo).toHaveBeenCalledWith('gantt')
    expect(champ.value).toBe('')
  })

  it('Échap efface la saisie ; le bouton × aussi, et rend le curseur au champ', async () => {
    const { champ } = await monter()
    saisir(champ, 'fact')
    touche(champ, 'Escape')
    expect(champ.value).toBe('')
    expect(screen.getByRole('button', { name: /Devis$/ })).toBeVisible()

    saisir(champ, 'fact')
    fireEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }))
    expect(champ.value).toBe('')
    expect(champ).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Effacer la recherche' })).toBeNull()
  })

  it('rubrique : « finances » affiche les modules de la rubrique Finances', async () => {
    const { champ } = await monter()
    saisir(champ, 'finances')
    expect(modulesAffiches()).toEqual(['Compta Intelligente', 'Rentabilité Chantier', 'Comptabilité'])
  })

  it('description en dernier recours : « tva » → Comptabilité ; « paramètres » → Mon profil', async () => {
    const { champ, navigateTo } = await monter()
    saisir(champ, 'tva')
    expect(modulesAffiches()).toEqual(['Comptabilité'])
    saisir(champ, 'paramètres')
    expect(modulesAffiches()).toEqual(['Mon profil'])
    touche(champ, 'Enter')
    expect(navigateTo).toHaveBeenCalledWith('settings')
  })

  it('bloc Compte : « aide » affiche Aide à la suite des résultats et Entrée l’ouvre', async () => {
    const { champ, navigateTo } = await monter()
    saisir(champ, 'aide')
    expect(modulesAffiches()).toEqual(['Aide'])
    touche(champ, 'Enter')
    expect(navigateTo).toHaveBeenCalledWith('help')
  })

  it('rien trouvé : message, Entrée sans effet, lien vers la liste des modules', async () => {
    const { champ, navigateTo } = await monter()
    saisir(champ, 'zzzz')
    expect(modulesAffiches()).toEqual([])
    const vide = screen.getByText('Aucun module trouvé', { selector: 'p' })
    expect(vide).toBeVisible()
    expect(screen.getByRole('status').textContent).toBe('Aucun module trouvé')
    touche(champ, 'Enter')
    expect(navigateTo).not.toHaveBeenCalled()
    fireEvent.click(within(vide.parentElement as HTMLElement).getByRole('button', { name: 'Voir tous les modules' }))
    expect(navigateTo).toHaveBeenCalledWith('modules')
    expect(champ.value).toBe('')
  })

  it('un module désactivé (absent du menu) n’est pas trouvé par la recherche', async () => {
    const { champ } = await monter({ isModuleEnabled: id => id !== 'factures' })
    expect(screen.queryByRole('button', { name: /Factures$/ })).toBeNull()
    saisir(champ, 'factures')
    expect(modulesAffiches()).toEqual([])
    expect(screen.getByText('Aucun module trouvé', { selector: 'p' })).toBeVisible()
  })

  it('Ctrl+K et ⌘K placent le curseur dans le champ', async () => {
    const { champ } = await monter()
    expect(champ).not.toHaveFocus()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(champ).toHaveFocus()
    champ.blur()
    fireEvent.keyDown(window, { key: 'K', metaKey: true })
    expect(champ).toHaveFocus()
    champ.blur()
    fireEvent.keyDown(window, { key: 'k' })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true, shiftKey: true })
    expect(champ).not.toHaveFocus()
  })

  it('portugais : libellés du champ et recherche sans cédille', async () => {
    const { champ, navigateTo } = await monter({ isPt: true })
    expect(champ.getAttribute('placeholder')).toBe('Pesquisar um módulo…')
    saisir(champ, 'orcamentos')
    expect(modulesAffiches()).toEqual(['Orçamentos', 'Orçamentos Fornecedores'])
    touche(champ, 'Enter')
    expect(navigateTo).toHaveBeenCalledWith('devis')
    saisir(champ, 'zzzz')
    expect(screen.getByText('Nenhum módulo encontrado', { selector: 'p' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Ver todos os módulos' })).toBeVisible()
  })
})

describe('Barre latérale — périmètre de la recherche (règle n° 1 artisan vs BTP)', () => {
  it('la barre latérale artisan n’a pas de champ de recherche', async () => {
    await act(async () => {
      render(
        <V5SidebarArtisan
          activePage="home" navigateTo={vi.fn()} handleLogout={vi.fn()} isModuleEnabled={tousActifs}
          isPt={false} pendingBookings={{ length: 0 }} unreadMsgCount={0}
        />,
      )
    })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('search')).toBeNull()
  })

  it('menu BTP figé (sans catégories dynamiques) : pas de champ, menu inchangé', async () => {
    await act(async () => {
      render(
        <V5Sidebar
          activePage="home" navigateTo={vi.fn()} handleLogout={vi.fn()} isProGerant proCanAccess={tousActifs}
          isModuleEnabled={tousActifs} isPt={false} pendingBookings={{ length: 0 }} unreadMsgCount={0}
        />,
      )
    })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: /Devis$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /Mon profil$/ })).toBeVisible()
    expect(screen.getByText('Déconnexion')).toBeVisible()
  })
})
