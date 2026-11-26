// tests/components/btp-sidebar-recherche-modules.test.tsx
//
// Barre latérale BTP pro (V5Sidebar, orgRole pro_societe) : le menu lui-même, puis sa barre de recherche de modules.
// Le menu est monté avec la vraie liste de modules (useModulesConfig → buildDefaultCategories) : un libellé
// renommé ou un module retiré fait échouer ces tests au lieu de casser la recherche en silence.
// Règle n° 1 (artisan vs BTP) : la barre latérale artisan ne reçoit pas ce champ.

import React from 'react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react'

const h = vi.hoisted(() => ({ sectionModulesChargee: false }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

// Témoin du préchargement au survol : la fabrique ne tourne qu'au premier import() du module.
vi.mock('@/components/dashboard/ModulesSection', () => {
  h.sectionModulesChargee = true
  return { default: () => null }
})

import V5Sidebar from '@/components/dashboard/V5Sidebar'
import V5SidebarArtisan from '@/components/dashboard/V5SidebarArtisan'
import { useModulesConfig } from '@/hooks/useModulesConfig'
import { buildDefaultCategories, type ModCategory } from '@/hooks/useModuleCategories'
import { canAccess, getDefaultPermissionsForRole } from '@/lib/permissions'

afterEach(() => { vi.unstubAllGlobals() })

const traduire = (cle: string) => cle
const tousActifs = () => true

interface OptionsMontage {
  isPt?: boolean
  isModuleEnabled?: (id: string) => boolean
  activePage?: string
  rendezVousEnAttente?: number
  messagesNonLus?: number
  /** Transforme les rubriques par défaut (module coupé, rubrique supprimée…). */
  rubriques?: (parDefaut: ModCategory[]) => ModCategory[]
  /** false pour un sous-compte d'équipe : ses permissions filtrent alors le menu. */
  isProGerant?: boolean
  /** Permissions effectives du compte (lib/permissions.ts) ; par défaut tout est ouvert. */
  proCanAccess?: (id: string) => boolean
  /** Ouvrier, chef de chantier, conducteur de travaux : menu réduit à la matrice (25/11/2026). */
  salarieDeTerrain?: boolean
}

async function monter(options: OptionsMontage = {}) {
  const {
    isPt = false, isModuleEnabled = tousActifs, activePage = 'home', rendezVousEnAttente = 0, messagesNonLus = 0,
    isProGerant = true, proCanAccess = tousActifs,
  } = options
  const { result } = renderHook(() => useModulesConfig('artisan-test', traduire, isPt))
  const modules = result.current.ALL_MODULES
  const parDefaut = buildDefaultCategories(modules)
  const navigateTo = vi.fn()
  let demonter = () => {}
  await act(async () => {
    const rendu = render(
      <V5Sidebar
        activePage={activePage}
        navigateTo={navigateTo}
        handleLogout={vi.fn()}
        isProGerant={isProGerant}
        proCanAccess={proCanAccess}
        isModuleEnabled={isModuleEnabled}
        isPt={isPt}
        pendingBookings={{ length: rendezVousEnAttente }}
        unreadMsgCount={messagesNonLus}
        dynamicCategories={options.rubriques ? options.rubriques(parDefaut) : parDefaut}
        definitionsModules={modules}
        salarieDeTerrain={options.salarieDeTerrain}
      />,
    )
    demonter = rendu.unmount
  })
  const champ = screen.getByRole('textbox', { name: isPt ? 'Pesquisar um módulo' : 'Rechercher un module' }) as HTMLInputElement
  return { navigateTo, champ, demonter }
}

const saisir = (champ: HTMLInputElement, texte: string) => fireEvent.change(champ, { target: { value: texte } })
const touche = (champ: HTMLInputElement, key: string) => fireEvent.keyDown(champ, { key })
const entree = (libelle: RegExp) => screen.getByRole('button', { name: libelle })
/** Libellés des modules affichés (les entrées du bloc « Compte » masqué pendant une recherche n'en font pas partie). */
const modulesAffiches = () =>
  screen.getAllByRole('button')
    .map(bouton => bouton.querySelector('.v5-sb-label')?.textContent)
    .filter((libelle): libelle is string => !!libelle)

describe('Barre latérale BTP — le menu, hors recherche', () => {
  it('le champ est présent et, sans saisie, le menu est complet', async () => {
    const { champ } = await monter()
    expect(champ.value).toBe('')
    expect(champ.getAttribute('placeholder')).toBe('Rechercher un module…')
    for (const libelle of ['Tableau de bord', 'Chantiers', 'Devis', 'Factures', 'Comptabilité', 'Mon profil', 'Modules', 'Aide']) {
      expect(entree(new RegExp(`${libelle}$`))).toBeVisible()
    }
    expect(screen.getByText('Déconnexion')).toBeVisible()
    expect(screen.queryByText('Aucun module trouvé')).toBeNull()
  })

  it('les trois entrées du bloc Compte ouvrent leur page', async () => {
    const { navigateTo } = await monter()
    for (const [libelle, page] of [['Mon profil', 'settings'], ['Modules', 'modules'], ['Aide', 'help']]) {
      fireEvent.click(entree(new RegExp(`${libelle}$`)))
      expect(navigateTo).toHaveBeenLastCalledWith(page)
    }
    expect(navigateTo).toHaveBeenCalledTimes(3)
  })

  it('l’entrée de la page ouverte est marquée, alias compris (prestations, bibliothèque, canal pro)', async () => {
    const attendus = [['devis', 'Devis'], ['prestations', 'Prestations'], ['bibliotheque', 'Prestations'], ['comm_pro', 'Messagerie'], ['settings', 'Mon profil']]
    for (const [activePage, libelle] of attendus) {
      const { demonter } = await monter({ activePage })
      const marquees = screen.getAllByRole('button').filter(bouton => bouton.getAttribute('aria-current') === 'page')
      expect(marquees.map(bouton => bouton.querySelector('.v5-sb-label')?.textContent)).toEqual([libelle])
      expect(marquees[0].className).toContain('active')
      demonter()
    }
  })

  it('pastilles : rendez-vous en attente sur l’agenda, messages non lus + rendez-vous sur la messagerie', async () => {
    await monter({ rendezVousEnAttente: 2, messagesNonLus: 3 })
    expect(entree(/Agenda \/ Planning/).querySelector('.v5-sb-badge')?.textContent).toBe('2')
    expect(entree(/Messagerie/).querySelector('.v5-sb-badge')?.textContent).toBe('5')
    expect(document.querySelectorAll('.v5-sb-badge')).toHaveLength(2)
  })

  it('aucune pastille quand il n’y a rien en attente', async () => {
    await monter()
    expect(document.querySelectorAll('.v5-sb-badge')).toHaveLength(0)
  })

  it('un module coupé dans Modules (on: false) ou désactivé disparaît du menu et de la recherche', async () => {
    const couperFactures = (rubriques: ModCategory[]) =>
      rubriques.map(rubrique => ({ ...rubrique, modules: rubrique.modules.map(m => (m.id === 'factures' ? { ...m, on: false } : m)) }))
    for (const options of [{ rubriques: couperFactures }, { isModuleEnabled: (id: string) => id !== 'factures' }]) {
      const { champ, demonter } = await monter(options)
      expect(screen.queryByRole('button', { name: /Factures$/ })).toBeNull()
      expect(entree(/Devis$/)).toBeVisible()
      saisir(champ, 'factures')
      expect(modulesAffiches()).toEqual([])
      expect(screen.getByText('Aucun module trouvé', { selector: 'p' })).toBeVisible()
      demonter()
    }
  })

  it('portugais : rubriques et bloc Compte traduits', async () => {
    await monter({ isPt: true })
    for (const rubrique of ['Gestão', 'Obras', 'Faturação', 'Finanças', 'Conta']) {
      expect(screen.getByText(rubrique, { selector: '.v5-sb-sec-t' })).toBeVisible()
    }
    expect(entree(/O meu perfil$/)).toBeVisible()
    expect(entree(/Módulos$/)).toBeVisible()
    expect(entree(/Ajuda$/)).toBeVisible()
    expect(screen.getByText('Sair')).toBeVisible()
  })

  it('le survol d’une entrée précharge sa section', async () => {
    await monter()
    expect(h.sectionModulesChargee).toBe(false)
    fireEvent.mouseEnter(entree(/Modules$/))
    await vi.waitFor(() => expect(h.sectionModulesChargee).toBe(true))
  })
})

describe('Barre latérale BTP — recherche de modules', () => {
  it('« fact » ne laisse que Factures ; le bloc Compte et la déconnexion sont masqués pendant la recherche', async () => {
    const { champ } = await monter()
    expect(champ.parentElement?.className).toBe('v5-sb-rech')
    saisir(champ, 'fact')
    expect(modulesAffiches()).toEqual(['Factures'])
    expect(screen.getByText('Déconnexion')).not.toBeVisible()
    expect(screen.getByRole('status').textContent).toBe('1 module trouvé. Entrée pour ouvrir Factures.')
    // La place de la croix n'est réservée dans le champ que pendant une saisie (classe lue par le CSS).
    expect(champ.parentElement?.className).toBe('v5-sb-rech saisie')
  })

  it('sans accents ni majuscules : « equipes » trouve Équipes', async () => {
    const { champ } = await monter()
    saisir(champ, 'equipes')
    expect(modulesAffiches()).toEqual(['Équipes', 'Pointage équipes'])
  })

  it('jamais au milieu d’un mot : « ia » → Compta Intelligente, pas Estimation matériaux', async () => {
    const { champ, navigateTo } = await monter()
    saisir(champ, 'ia')
    expect(modulesAffiches()).toEqual(['Compta Intelligente'])
    touche(champ, 'Enter')
    expect(navigateTo).toHaveBeenCalledWith('compta_btp')
  })

  it('Entrée ouvre la meilleure correspondance ; le menu complet revient et le focus va sur l’entrée ouverte', async () => {
    const { champ, navigateTo } = await monter()
    saisir(champ, 'devis')
    expect(modulesAffiches()).toEqual(['Devis', 'Devis Fournisseurs'])
    expect(entree(/Devis$/).className).toContain('choix')
    expect(screen.getByRole('status').textContent).toBe('2 modules trouvés. Entrée pour ouvrir Devis.')
    touche(champ, 'Enter')
    expect(navigateTo).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith('devis')
    expect(champ.value).toBe('')
    expect(entree(/Factures$/)).toBeVisible()
    expect(screen.getByText('Déconnexion')).toBeVisible()
    expect(entree(/Devis$/)).toHaveFocus()
    expect(entree(/Devis$/).className).not.toContain('choix')
  })

  it('flèches bas et haut : choisissent un autre résultat, bornées aux extrémités, sans déplacer le curseur du champ', async () => {
    const { champ, navigateTo } = await monter()
    saisir(champ, 'devis')
    // fireEvent rend false quand le composant a neutralisé la touche (preventDefault).
    expect(touche(champ, 'ArrowUp')).toBe(false) // déjà sur le premier : ne bouge pas
    expect(entree(/Devis$/).className).toContain('choix')
    expect(touche(champ, 'ArrowDown')).toBe(false)
    expect(entree(/Devis Fournisseurs$/).className).toContain('choix')
    expect(entree(/Devis$/).className).not.toContain('choix')
    touche(champ, 'ArrowDown') // déjà sur le dernier : ne bouge pas
    expect(entree(/Devis Fournisseurs$/).className).toContain('choix')
    expect(screen.getByRole('status').textContent).toBe('2 modules trouvés. Entrée pour ouvrir Devis Fournisseurs.')
    touche(champ, 'Enter')
    expect(navigateTo).toHaveBeenCalledWith('rfq_btp')
  })

  it('le résultat choisi aux flèches est ramené dans la zone visible du menu', async () => {
    const defilements: Element[] = []
    const origine = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { defilements.push(this) }
    try {
      const { champ } = await monter()
      saisir(champ, 'devis')
      touche(champ, 'ArrowDown')
      expect(defilements.at(-1)).toBe(entree(/Devis Fournisseurs$/))
    } finally {
      Element.prototype.scrollIntoView = origine
    }
  })

  it('une nouvelle saisie remet le choix sur la meilleure correspondance', async () => {
    const { champ } = await monter()
    saisir(champ, 'devis')
    touche(champ, 'ArrowDown')
    saisir(champ, 'devi')
    expect(entree(/Devis$/).className).toContain('choix')
  })

  it('Entrée pendant la composition d’un caractère (clavier IME) ne valide rien', async () => {
    const { champ, navigateTo } = await monter()
    saisir(champ, 'devis')
    fireEvent.keyDown(champ, { key: 'Enter', isComposing: true })
    expect(navigateTo).not.toHaveBeenCalled()
    expect(champ.value).toBe('devis')
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
    fireEvent.click(entree(/Planification Gantt$/))
    expect(navigateTo).toHaveBeenCalledWith('gantt')
    expect(champ.value).toBe('')
  })

  it('Échap efface la saisie sans quitter le champ ; le bouton × aussi', async () => {
    const { champ } = await monter()
    champ.focus()
    saisir(champ, 'fact')
    touche(champ, 'Escape')
    expect(champ.value).toBe('')
    expect(entree(/Devis$/)).toBeVisible()
    touche(champ, 'Escape') // champ déjà vide : rien ne bouge
    expect(champ).toHaveFocus()

    saisir(champ, 'fact')
    champ.blur()
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

  it('description et mots-clés en dernier recours : tva, paramètres, accueil, faq', async () => {
    const { champ, navigateTo } = await monter()
    for (const [saisie, libelle, page] of [['tva', 'Comptabilité', 'comptabilite'], ['paramètres', 'Mon profil', 'settings'], ['accueil', 'Tableau de bord', 'home'], ['faq', 'Aide', 'help']]) {
      saisir(champ, saisie)
      expect(modulesAffiches()).toEqual([libelle])
      touche(champ, 'Enter')
      expect(navigateTo).toHaveBeenLastCalledWith(page)
    }
  })

  it('bloc Compte : « aide » affiche Aide à la suite des résultats, sous sa rubrique', async () => {
    const { champ } = await monter()
    saisir(champ, 'aide')
    expect(modulesAffiches()).toEqual(['Aide'])
    expect(entree(/Aide$/).className).toContain('choix')
    expect(entree(/Aide$/).closest('.v5-sb-bottom')).toBeNull()
    // « Compte » est le nom de leur rubrique : « compte aide » ne garde que Aide.
    saisir(champ, 'compte aide')
    expect(modulesAffiches()).toEqual(['Aide'])
  })

  it('menu dynamique retiré pendant une saisie : le menu figé s’affiche en entier, bloc Compte compris', async () => {
    const proprietes = {
      activePage: 'home', navigateTo: vi.fn(), handleLogout: vi.fn(), isProGerant: true, proCanAccess: tousActifs,
      isModuleEnabled: tousActifs, isPt: false, pendingBookings: { length: 0 }, unreadMsgCount: 0,
    }
    const { result } = renderHook(() => useModulesConfig('artisan-test', traduire, false))
    let rendu!: ReturnType<typeof render>
    await act(async () => {
      rendu = render(<V5Sidebar {...proprietes} dynamicCategories={buildDefaultCategories(result.current.ALL_MODULES)} />)
    })
    saisir(screen.getByRole('textbox') as HTMLInputElement, 'fact')
    expect(screen.getByText('Déconnexion')).not.toBeVisible()
    await act(async () => { rendu.rerender(<V5Sidebar {...proprietes} />) })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('Déconnexion')).toBeVisible()
    expect(entree(/Devis$/)).toBeVisible()
  })

  it('rubrique Compte supprimée dans Modules : « profil » ne s’affiche et ne se compte qu’une fois', async () => {
    const sansCompte = (rubriques: ModCategory[]) => {
      const compte = rubriques.find(rubrique => rubrique.id === 'cat-compte')
      const reste = rubriques.filter(rubrique => rubrique.id !== 'cat-compte')
      return reste.map((rubrique, i) => (i === 0 ? { ...rubrique, modules: [...rubrique.modules, ...(compte?.modules ?? [])] } : rubrique))
    }
    const { champ } = await monter({ rubriques: sansCompte })
    saisir(champ, 'profil')
    expect(modulesAffiches()).toEqual(['Mon profil'])
    expect(screen.getByRole('status').textContent).toBe('1 module trouvé. Entrée pour ouvrir Mon profil.')
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

  it('Ctrl+K place le curseur dans le champ ; ni ⌘K (hors Mac), ni Ctrl+Alt+K, ni Ctrl+Maj+K, ni K seul', async () => {
    const { champ } = await monter()
    expect(champ).not.toHaveFocus()
    saisir(champ, 'gantt')
    expect(fireEvent.keyDown(window, { key: 'k', ctrlKey: true })).toBe(false) // touche neutralisée
    expect(champ).toHaveFocus()
    // La saisie en place est sélectionnée : taper la remplace.
    expect([champ.selectionStart, champ.selectionEnd]).toEqual([0, 5])
    champ.blur()
    for (const autre of [{ metaKey: true }, { ctrlKey: true, altKey: true }, { ctrlKey: true, shiftKey: true }, {}]) {
      expect(fireEvent.keyDown(window, { key: 'k', ...autre })).toBe(true) // laissée au navigateur
      expect(champ).not.toHaveFocus()
    }
  })

  it('sur Mac, seul ⌘K est pris : Ctrl+K reste aux champs de texte', async () => {
    Object.defineProperty(window.navigator, 'platform', { value: 'MacIntel', configurable: true })
    try {
      const { champ } = await monter()
      expect(fireEvent.keyDown(window, { key: 'k', ctrlKey: true })).toBe(true)
      expect(champ).not.toHaveFocus()
      expect(fireEvent.keyDown(window, { key: 'K', metaKey: true })).toBe(false)
      expect(champ).toHaveFocus()
    } finally {
      delete (window.navigator as unknown as { platform?: string }).platform
    }
  })

  it('champ masqué (menu réduit aux icônes) : Ctrl+K est laissé au navigateur', async () => {
    const { champ } = await monter()
    ;(champ.parentElement as HTMLElement).style.display = 'none'
    expect(fireEvent.keyDown(window, { key: 'k', ctrlKey: true })).toBe(true)
    expect(champ).not.toHaveFocus()
  })

  it('passage au menu réduit (≤ 768 px) pendant une saisie : la recherche est refermée', async () => {
    let surChangement: ((evenement: { matches: boolean }) => void) | undefined
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: (_type: string, ecouteur: typeof surChangement) => { surChangement = ecouteur },
      removeEventListener: vi.fn(),
    })))
    const { champ } = await monter()
    saisir(champ, 'fact')
    expect(modulesAffiches()).toEqual(['Factures'])
    act(() => { surChangement?.({ matches: false }) }) // retour au grand écran : rien à faire
    expect(champ.value).toBe('fact')
    act(() => { surChangement?.({ matches: true }) })
    expect(champ.value).toBe('')
    expect(entree(/Devis$/)).toBeVisible()
    expect(screen.getByText('Déconnexion')).toBeVisible()
  })

  it('portugais : libellés du champ, recherche sans cédille, annonce, « iva » et « módulos »', async () => {
    const { champ, navigateTo } = await monter({ isPt: true })
    expect(champ.getAttribute('placeholder')).toBe('Pesquisar um módulo…')
    saisir(champ, 'orcamentos')
    expect(modulesAffiches()).toEqual(['Orçamentos', 'Orçamentos de fornecedores'])
    expect(screen.getByRole('status').textContent).toBe('2 módulos encontrados. Enter para abrir Orçamentos.')
    touche(champ, 'Enter')
    expect(navigateTo).toHaveBeenCalledWith('devis')
    saisir(champ, 'iva')
    expect(modulesAffiches()).toEqual(['Contabilidade'])
    expect(screen.getByRole('status').textContent).toBe('1 módulo encontrado. Enter para abrir Contabilidade.')
    saisir(champ, 'módulos')
    expect(modulesAffiches()).toEqual(['Módulos'])
    saisir(champ, 'zzzz')
    expect(screen.getByText('Nenhum módulo encontrado', { selector: 'p' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Ver todos os módulos' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Limpar a pesquisa' })).toBeVisible()
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
    expect(entree(/Devis$/)).toBeVisible()
    expect(entree(/Mon profil$/)).toBeVisible()
    expect(screen.getByText('Déconnexion')).toBeVisible()
  })
})

// ── Rôle d'équipe : le menu ne montre que ce que le salarié a le droit d'ouvrir (24/11/2026) ────────────────
//
// Le filtre `proCanAccess` existait, mais seulement dans la branche figée de V5Sidebar, que le tableau de bord
// n'atteint jamais : il fournit toujours des rubriques dynamiques. Un ouvrier voyait donc tout le catalogue, Devis
// et Factures comprises. La recherche s'appuyant sur la même liste, elle ne peut rien montrer de plus que le menu.
describe('Barre latérale BTP — ce qu’un salarié voit du menu', () => {
  // Droits par défaut réels d'un ouvrier (Operário), salarié de terrain de VITFIX CONSTRUÇÕES.
  const droitsTerrain = getDefaultPermissionsForRole('OUVRIER')
  const salarieDeTerrain = (id: string) => canAccess(droitsTerrain, id)
  // Chef de chantier (Encarregado) : les mêmes écrans, plus l'outillage de ses chantiers (vérification du vendredi,
  // demande du 26/11/2026).
  const droitsChef = getDefaultPermissionsForRole('CHEF_CHANTIER')
  const chefDeChantier = (id: string) => canAccess(droitsChef, id)
  // Une secrétaire : sous-compte, mais poste de bureau (tous les pouvoirs sauf la gestion des comptes).
  const droitsSecretaire = getDefaultPermissionsForRole('SECRETAIRE')
  const secretaire = (id: string) => canAccess(droitsSecretaire, id)

  // Décision de Frédéric du 25/11/2026 : « Les salariés doivent uniquement recevoir les alertes météo, le chantier
  // qui les concerne, et surtout le pointage ». Le 26/11/2026 : « Les employés doivent aussi avoir le droit au module
  // rapports ! ». Le menu entier, bloc « Compte » compris, ne montre rien d'autre que ces quatre écrans, « Mon profil »
  // (son mot de passe) et « Aide ».
  it('un salarié de terrain ne voit que le pointage, ses chantiers, la météo, les rapports, son profil et l’aide', async () => {
    await monter({ isProGerant: false, proCanAccess: salarieDeTerrain, salarieDeTerrain: true })
    expect(new Set(modulesAffiches())).toEqual(new Set(['Pointage équipes', 'Chantiers', 'Météo chantiers', 'Rapports de chantier', 'Mon profil', 'Aide']))
  })

  it('en portugais aussi, sans le dictionnaire de matériaux', async () => {
    await monter({ isPt: true, isProGerant: false, proCanAccess: salarieDeTerrain, salarieDeTerrain: true })
    expect(new Set(modulesAffiches())).toEqual(new Set(['Registo de horas', 'Obras', 'Meteorologia', 'Relatórios de obra', 'O meu perfil', 'Ajuda']))
  })

  it('un encarregado voit en plus « Ferramentas e viaturas », juste sous le registo de horas', async () => {
    await monter({ isPt: true, isProGerant: false, proCanAccess: chefDeChantier, salarieDeTerrain: true })
    const affiches = modulesAffiches()
    expect(new Set(affiches)).toEqual(new Set(['Registo de horas', 'Ferramentas e viaturas', 'Obras', 'Meteorologia', 'Relatórios de obra', 'O meu perfil', 'Ajuda']))
    expect(affiches.indexOf('Ferramentas e viaturas')).toBe(affiches.indexOf('Registo de horas') + 1)
  })

  // « Modules » permettait à un salarié d'éteindre son propre « Pointage équipes » et de le perdre de son menu.
  it('« Modules » n’est ni au menu ni dans la recherche d’un salarié de terrain', async () => {
    const { champ } = await monter({ isProGerant: false, proCanAccess: salarieDeTerrain, salarieDeTerrain: true })
    expect(screen.queryByRole('button', { name: /Modules$/ })).toBeNull()
    saisir(champ, 'modules')
    expect(screen.queryByRole('button', { name: /Modules$/ })).toBeNull()
  })

  it('la recherche ne sort pas un module interdit, ni le lien vers « Modules »', async () => {
    const { champ } = await monter({ isProGerant: false, proCanAccess: salarieDeTerrain, salarieDeTerrain: true })
    saisir(champ, 'devis')
    expect(screen.queryByRole('button', { name: /Devis$/ })).toBeNull()
    expect(screen.getAllByText('Aucun module trouvé').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Voir tous les modules' })).toBeNull()
  })

  it('le gérant garde le lien « Voir tous les modules » quand la recherche ne trouve rien', async () => {
    const { champ } = await monter()
    saisir(champ, 'zzzz')
    expect(screen.getByRole('button', { name: 'Voir tous les modules' })).toBeTruthy()
  })

  // Portail client est une entrée du catalogue sans module de permission : personne ne peut l'accorder. Elle reste
  // au menu d'un poste de bureau (la secrétaire) ; le salarié de terrain, lui, n'a que ce que la matrice lui ouvre.
  it('une entrée sans module de permission reste au menu de la secrétaire, pas à celui du salarié de terrain', async () => {
    const bureau = await monter({ isProGerant: false, proCanAccess: secretaire })
    expect(modulesAffiches()).toContain('Portail client')
    expect(modulesAffiches()).toContain('Modules')
    bureau.demonter()
    await monter({ isProGerant: false, proCanAccess: salarieDeTerrain, salarieDeTerrain: true })
    expect(modulesAffiches()).not.toContain('Portail client')
  })

  // Le gérant peut rouvrir un module à un employé (Gestion des comptes → Modifier) : il apparaît alors au menu.
  // Le dictionnaire de matériaux n'existe que dans les pays qui en ont un, c'est-à-dire le Portugal
  // (lib/dictionnaire-materiaux/disponibilite.ts) : en français il n'est pas au menu, et c'est voulu.
  it('un module rouvert par le gérant apparaît : le dictionnaire, en portugais seulement', async () => {
    const avecDictionnaire = (id: string) => salarieDeTerrain(id) || id === 'dictionnaire_materiaux'
    const francais = await monter({ isProGerant: false, proCanAccess: avecDictionnaire, salarieDeTerrain: true })
    expect(modulesAffiches()).not.toContain('Dictionnaire matériaux')
    francais.demonter()
    await monter({ isPt: true, isProGerant: false, proCanAccess: avecDictionnaire, salarieDeTerrain: true })
    expect(modulesAffiches()).toContain('Dicionário de materiais')
  })

  it('le gérant garde le menu complet, quelles que soient les permissions lues', async () => {
    await monter({ isProGerant: true, proCanAccess: () => false })
    const affiches = modulesAffiches()
    for (const libelle of ['Chantiers', 'Devis', 'Factures', 'Comptabilité', 'Modules']) {
      expect(affiches).toContain(libelle)
    }
  })

  // Le réglage des modules est rangé sous la clé du compte connecté (fixit_modules_config_<son id>) : un module éteint
  // par un poste de bureau dans « Modules » reste éteint pour lui, qui peut le rallumer au même endroit.
  it('poste de bureau : un module éteint dans « Modules » reste masqué, même autorisé par le rôle', async () => {
    await monter({ isProGerant: false, proCanAccess: secretaire, isModuleEnabled: (id: string) => id !== 'meteo' })
    const affiches = modulesAffiches()
    expect(affiches).toContain('Chantiers')
    expect(affiches).not.toContain('Météo chantiers')
  })

  // Le salarié de terrain n'a plus « Modules » : un pointage ou une météo qu'il aurait éteint avant ne se rallumerait
  // plus jamais. Il voit donc exactement ce que la matrice lui accorde, quel que soit ce réglage.
  it('salarié de terrain : un module accordé reste au menu, même éteint autrefois dans « Modules »', async () => {
    await monter({
      isProGerant: false,
      proCanAccess: salarieDeTerrain,
      salarieDeTerrain: true,
      isModuleEnabled: (id: string) => id !== 'meteo' && id !== 'pointage',
      rubriques: (parDefaut) => parDefaut.map(cat => ({ ...cat, modules: cat.modules.map(m => ({ ...m, on: m.id !== 'chantiers' })) })),
    })
    expect(new Set(modulesAffiches())).toEqual(new Set(['Pointage équipes', 'Chantiers', 'Météo chantiers', 'Rapports de chantier', 'Mon profil', 'Aide']))
  })
})
