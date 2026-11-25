'use client'

/**
 * V5Sidebar — Sidebar for pro_societe dashboard (light theme).
 *
 * When `dynamicCategories` is provided (non-empty), renders sections/items
 * from that data source (shared with ModulesSection via useModuleCategories).
 * Otherwise falls back to the legacy hardcoded layout.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { nomDeRubrique, type ModCategory } from '@/hooks/useModuleCategories'
import LienPanneauAdmin from '@/components/common/LienPanneauAdmin'
import { rechercherModules, type ModuleCherchable } from '@/lib/btp/recherche-modules'
import { ALL_PRO_MODULES } from '@/lib/permissions'

interface V5SidebarProps {
  activePage: string
  navigateTo: (page: string) => void
  handleLogout: () => void
  isProGerant: boolean
  proCanAccess: (module: string) => boolean
  isModuleEnabled: (module: string) => boolean
  isPt: boolean
  pendingBookings: { length: number }
  unreadMsgCount: number
  dynamicCategories?: ModCategory[]
  /** Liste des modules (useModulesConfig) : la recherche y lit la description de chacun, en dernier recours. */
  definitionsModules?: ReadonlyArray<{ id: string; description: string }>
  /**
   * Salarié de terrain (ouvrier, chef de chantier, conducteur de travaux) : son menu ne montre que ce que la matrice
   * des droits lui ouvre (pointage, chantiers, météo par défaut), plus « Mon profil » et « Aide ». Ni les entrées
   * hors matrice (Portail client…), ni « Modules », où il pouvait éteindre son propre pointage.
   */
  salarieDeTerrain?: boolean
}

/** Entrées du bloc « Compte » fermées au salarié de terrain. */
const COMPTE_FERME_AU_TERRAIN: ReadonlySet<string> = new Set(['modules'])

// Bloc « Compte » (toujours en bas du menu) : mêmes entrées que le rendu fixe plus bas, pour la recherche.
const MODULES_COMPTE: ReadonlyArray<{ id: string; icon: string; fr: string; pt: string; descriptionFr: string; descriptionPt: string }> = [
  { id: 'settings', icon: '⚙️', fr: 'Mon profil', pt: 'O meu perfil', descriptionFr: 'Paramètres du compte', descriptionPt: 'Definições da conta' },
  { id: 'modules', icon: '🧩', fr: 'Modules', pt: 'Módulos', descriptionFr: 'Activer, désactiver et réorganiser le menu', descriptionPt: 'Ativar, desativar e reorganizar o menu' },
  { id: 'help', icon: '❓', fr: 'Aide', pt: 'Ajuda', descriptionFr: 'Questions fréquentes (FAQ) et support', descriptionPt: 'Perguntas frequentes (FAQ) e suporte' },
]

// Mots que l'on tape pour un module dont ni le nom ni la description ne les contiennent (lus avec la description).
const MOTS_CLES: Record<string, { fr: string; pt: string }> = {
  home: { fr: 'accueil', pt: 'início' },
  dictionnaire_materiaux: { fr: 'silicone mastic spatule produits fournitures quoi utiliser', pt: 'silicone mástique espátula produtos que usar lista de compras' },
  // Anciens noms portugais des modules renommés le 17/11/2026 : ceux qui les ont appris les retrouvent encore.
  motifs: { fr: '', pt: 'prestações' },
  pointage: { fr: '', pt: 'marcação de horas ponto' },
  situations: { fr: '', pt: 'situações de obra' },
  garanties: { fr: '', pt: 'retenções de garantia' },
  marches: { fr: '', pt: 'bolsa de mercados' },
  parrainage: { fr: '', pt: 'apadrinhamento indicar um amigo' },
}

// Modules réellement gouvernés par la matrice des droits : une entrée de menu sans module de permission
// (Portail client, par exemple) n'est fermée à personne, faute de pouvoir être accordée à quiconque.
const MODULES_GARDES = new Set<string>(ALL_PRO_MODULES)

// ─── Routing alias: motifs → prestations (URL key) ───
const ROUTE_ALIAS: Record<string, string> = { motifs: 'prestations' }

// Prefetch map — hover over sidebar item → preload the JS chunk
const PREFETCH_MAP: Record<string, () => void> = {
  home: () => import('@/components/dashboard/HomeSection'),
  calendar: () => import('@/components/dashboard/CalendarSection'),
  chantiers: () => import('@/components/dashboard/btp/ChantiersBTPSection'),
  equipes: () => import('@/components/dashboard/EquipesBTPV2'),
  gantt: () => import('@/components/dashboard/btp/GanttSection'),
  pointage: () => import('@/components/dashboard/btp/PointageEquipesSection'),
  devis: () => import('@/components/dashboard/DevisSection'),
  factures: () => import('@/components/dashboard/FacturesSection'),
  clients: () => import('@/components/dashboard/ClientsSection'),
  messages: () => import('@/components/dashboard/MessagerieArtisan'),
  comptabilite: () => import('@/components/dashboard/ComptabiliteSection'),
  materiaux: () => import('@/components/dashboard/MateriauxSection'),
  estimation_materiaux: () => import('@/components/dashboard/EstimationMateriauxSection'),
  dictionnaire_materiaux: () => import('@/components/dashboard/DictionnaireMateriauxSection'),
  rapports: () => import('@/components/dashboard/RapportsSection'),
  stats: () => import('@/components/dashboard/StatsRevenusSection'),
  settings: () => import('@/components/dashboard/SettingsSection'),
  modules: () => import('@/components/dashboard/ModulesSection'),
  compta_btp: () => import('@/components/dashboard/ComptaBTPSection'),
  rentabilite: () => import('@/components/dashboard/RentabiliteChantierSection'),
  gestion_comptes: () => import('@/components/dashboard/CompteUtilisateursSection'),
  pipeline: () => import('@/components/dashboard/PipelineSection'),
  wallet: () => import('@/components/dashboard/WalletConformiteSection'),
  marketplace_btp: () => import('@/components/dashboard/MarketplaceProBTPSection'),
}
const prefetched = new Set<string>()

function V5SidebarItem({ icon, label, active, badge, onClick, page, choisi }: {
  icon: string; label: string; active?: boolean; badge?: number; onClick: () => void; page?: string
  /** Résultat de recherche que la touche Entrée ouvre. */
  choisi?: boolean
}) {
  const handleHover = () => {
    if (page && !prefetched.has(page) && PREFETCH_MAP[page]) {
      prefetched.add(page)
      PREFETCH_MAP[page]()
    }
  }
  return (
    <button type="button" onClick={onClick} onMouseEnter={handleHover} className={`v5-sb-i${active ? ' active' : ''}${choisi ? ' choix' : ''}`} aria-current={active ? 'page' : undefined} data-module={page} data-choix={choisi ? 'oui' : undefined}>
      <span className="v5-sb-icon" aria-hidden="true">{icon}</span>
      <span className="v5-sb-label">{label}</span>
      {badge != null && badge > 0 && <span className="v5-sb-badge" aria-label={`${badge}`}>{badge}</span>}
      {choisi && <span className="v5-sb-entree" aria-hidden="true">↵</span>}
    </button>
  )
}

export default function V5Sidebar({
  activePage, navigateTo, handleLogout,
  isProGerant, proCanAccess, isModuleEnabled,
  isPt, pendingBookings, unreadMsgCount, dynamicCategories, definitionsModules,
  salarieDeTerrain = false,
}: V5SidebarProps) {
  const useDynamic = !!(dynamicCategories && dynamicCategories.length > 0)
  const modulesCompte = useMemo(
    () => (salarieDeTerrain ? MODULES_COMPTE.filter(mod => !COMPTE_FERME_AU_TERRAIN.has(mod.id)) : MODULES_COMPTE),
    [salarieDeTerrain],
  )

  // ─── Recherche de modules (menu dynamique seulement) ───
  const [requete, setRequete] = useState('')
  // Résultat choisi aux flèches ; null = la meilleure correspondance de la recherche.
  const [choixClavier, setChoixClavier] = useState<string | null>(null)
  const champRecherche = useRef<HTMLInputElement>(null)
  const zoneNavigation = useRef<HTMLDivElement>(null)
  // Module ouvert au clavier : son entrée de menu reçoit le focus une fois le menu complet revenu.
  const focusApresOuverture = useRef<string | null>(null)

  // Rubriques réellement affichées : la même liste sert au rendu du menu et à la recherche,
  // qui ne peut donc rien montrer que le menu ne montre pas.
  const rubriques = useMemo(() => {
    if (!dynamicCategories || dynamicCategories.length === 0) return []
    return dynamicCategories
      // La rubrique « Compte » est rendue par le bloc fixe du bas.
      .filter(cat => cat.id !== 'cat-compte')
      .map(cat => ({
        id: cat.id,
        nom: nomDeRubrique(cat, isPt),
        // Le rôle d'équipe filtre aussi le menu dynamique (24/11/2026). Le filtre `proCanAccess` existait, mais
        // seulement dans la branche figée plus bas, que le tableau de bord n'atteint jamais : il fournit toujours
        // des rubriques dynamiques, si bien qu'un ouvrier voyait tout le catalogue, Devis et Factures comprises.
        // La recherche de modules s'appuie sur cette même liste : elle ne montre donc rien de plus que le menu.
        // Un salarié de terrain voit exactement ce que la matrice lui accorde (25/11/2026, « uniquement » la météo,
        // son chantier et le pointage) : une entrée hors matrice lui reste fermée, et un module accordé reste au menu
        // même s'il l'a éteint lui-même dans « Modules » avant que cet écran lui soit retiré — il n'aurait plus aucun
        // moyen de le rallumer, et le gérant non plus (le réglage est rangé sous la clé du salarié).
        modules: cat.modules.filter(m => (salarieDeTerrain
          ? proCanAccess(m.id)
          : m.on && isModuleEnabled(m.id) && (isProGerant || !MODULES_GARDES.has(m.id) || proCanAccess(m.id)))),
      }))
      .filter(rubrique => rubrique.modules.length > 0)
  }, [dynamicCategories, isPt, isModuleEnabled, isProGerant, proCanAccess, salarieDeTerrain])

  const recherche = useMemo(() => {
    // Sans menu dynamique il n'y a pas de champ : une saisie restée en mémoire ne doit rien filtrer.
    if (!useDynamic) return rechercherModules('', [])
    const nomCompte = isPt ? 'Conta' : 'Compte'
    const descriptions = new Map((definitionsModules ?? []).map(def => [def.id, def.description]))
    const vus = new Set<string>()
    const cherchables: ModuleCherchable[] = []
    const ajouter = (entree: ModuleCherchable) => {
      // Un module présent deux fois dans le menu (rubrique « Compte » supprimée dans Modules) ne compte qu'une fois.
      if (vus.has(entree.id)) return
      vus.add(entree.id)
      cherchables.push(entree)
    }
    for (const rubrique of rubriques) {
      for (const mod of rubrique.modules) {
        const motsCles = isPt ? MOTS_CLES[mod.id]?.pt : MOTS_CLES[mod.id]?.fr
        ajouter({ id: mod.id, libelle: mod.name, rubrique: rubrique.nom, description: `${descriptions.get(mod.id) ?? ''} ${motsCles ?? ''}` })
      }
    }
    for (const mod of modulesCompte) {
      ajouter({ id: mod.id, libelle: isPt ? mod.pt : mod.fr, rubrique: nomCompte, description: isPt ? mod.descriptionPt : mod.descriptionFr })
    }
    return rechercherModules(requete, cherchables)
  }, [useDynamic, requete, rubriques, definitionsModules, isPt, modulesCompte])

  const retenus = useMemo(() => new Set(recherche.ids), [recherche])
  // Entrées du bloc « Compte » trouvées par la recherche, sauf celles qu'une rubrique du menu affiche déjà.
  const compteTrouves = useMemo(() => {
    if (!recherche.active) return []
    const dejaAuMenu = new Set(rubriques.flatMap(rubrique => rubrique.modules.map(m => m.id)))
    return modulesCompte.filter(mod => retenus.has(mod.id) && !dejaAuMenu.has(mod.id))
  }, [recherche.active, rubriques, retenus, modulesCompte])
  const idChoisi = choixClavier && retenus.has(choixClavier) ? choixClavier : recherche.meilleur
  const libelleChoisi = useMemo(() => {
    if (!idChoisi) return ''
    for (const rubrique of rubriques) {
      const mod = rubrique.modules.find(m => m.id === idChoisi)
      if (mod) return mod.name
    }
    const compte = modulesCompte.find(m => m.id === idChoisi)
    if (!compte) return ''
    return isPt ? compte.pt : compte.fr
  }, [idChoisi, rubriques, isPt, modulesCompte])

  const effacerRecherche = () => {
    setRequete('')
    setChoixClavier(null)
  }

  /** Ouvre un module depuis le menu ; une recherche en cours est refermée. */
  const ouvrir = (id: string) => {
    effacerRecherche()
    navigateTo(ROUTE_ALIAS[id] ?? id)
  }

  const deplacerChoix = (pas: 1 | -1) => {
    if (recherche.ids.length === 0) return
    const position = idChoisi ? recherche.ids.indexOf(idChoisi) : -1
    const suivante = Math.min(recherche.ids.length - 1, Math.max(0, position + pas))
    setChoixClavier(recherche.ids[suivante])
  }

  const surToucheRecherche = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown') { e.preventDefault(); deplacerChoix(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); deplacerChoix(-1) }
    else if (e.key === 'Enter') {
      if (!idChoisi) return
      e.preventDefault()
      focusApresOuverture.current = idChoisi
      ouvrir(idChoisi)
    } else if (e.key === 'Escape' && requete) {
      e.preventDefault()
      effacerRecherche()
    }
  }

  // Après une ouverture au clavier, le focus va sur l'entrée de menu du module ouvert (comme après un clic)
  // au lieu de retomber sur <body>.
  useEffect(() => {
    const id = focusApresOuverture.current
    if (!id || recherche.active) return
    focusApresOuverture.current = null
    const entrees = zoneNavigation.current?.querySelectorAll<HTMLElement>('[data-module]')
    for (const entree of entrees ?? []) {
      if (entree.dataset.module === id) { entree.focus(); return }
    }
  })

  // Menu réduit aux icônes (≤ 768 px, voir dashboard-v5.css) : le champ est masqué. Une recherche en cours est
  // refermée, sinon le menu resterait filtré sans moyen de l'effacer (tablette que l'on fait pivoter).
  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') return
    const petitEcran = globalThis.matchMedia('(max-width: 768px)')
    const surChangement = (e: MediaQueryListEvent) => {
      if (!e.matches) return
      setRequete('')
      setChoixClavier(null)
    }
    petitEcran.addEventListener('change', surChangement)
    return () => petitEcran.removeEventListener('change', surChangement)
  }, [])

  // Raccourci Ctrl+K (⌘K sur Mac) : place le curseur dans la recherche. Sans effet quand le champ est masqué
  // (menu réduit aux icônes sur petit écran) : le raccourci du navigateur reste alors disponible.
  useEffect(() => {
    if (!useDynamic) return
    // Sur Mac, Ctrl+K appartient aux champs de texte (effacer la fin de la ligne) : seul ⌘K est pris.
    const estMac = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '')
    const surRaccourci = (e: globalThis.KeyboardEvent) => {
      const modificateur = estMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
      if (!modificateur || e.altKey || e.shiftKey || typeof e.key !== 'string' || e.key.toLowerCase() !== 'k') return
      const champ = champRecherche.current
      const bloc = champ?.parentElement
      if (!champ || !bloc || globalThis.getComputedStyle(bloc).display === 'none') return
      e.preventDefault()
      champ.focus()
      champ.select()
    }
    globalThis.addEventListener('keydown', surRaccourci)
    return () => globalThis.removeEventListener('keydown', surRaccourci)
  }, [useDynamic])

  // Le résultat choisi reste visible quand on descend dans une longue liste aux flèches.
  useEffect(() => {
    if (!recherche.active || !idChoisi) return
    const element = zoneNavigation.current?.querySelector<HTMLElement>('[data-choix="oui"]')
    if (element && typeof element.scrollIntoView === 'function') element.scrollIntoView({ block: 'nearest' })
  }, [recherche.active, idChoisi])

  let annonceRecherche = ''
  if (recherche.active) {
    const total = recherche.ids.length
    if (total === 0) annonceRecherche = isPt ? 'Nenhum módulo encontrado' : 'Aucun module trouvé'
    else if (isPt) annonceRecherche = `${total} ${total > 1 ? 'módulos encontrados' : 'módulo encontrado'}. Enter para abrir ${libelleChoisi}.`
    else annonceRecherche = `${total} ${total > 1 ? 'modules trouvés' : 'module trouvé'}. Entrée pour ouvrir ${libelleChoisi}.`
  }

  // Items within a dynamic category that carry dynamic badges/active-aliases
  const badgeFor = (id: string): number | undefined => {
    if (id === 'calendar') return pendingBookings.length || undefined
    if (id === 'messages') return (unreadMsgCount + pendingBookings.length) || undefined
    return undefined
  }
  const activeFor = (id: string): boolean => {
    const route = ROUTE_ALIAS[id] ?? id
    if (id === 'motifs') return activePage === 'prestations' || activePage === 'motifs' || activePage === 'bibliotheque'
    if (id === 'messages') return activePage === 'messages' || activePage === 'comm_pro'
    return activePage === route
  }

  return (
    <aside className="v5-sb" role="navigation" aria-label={isPt ? 'Menu principal' : 'Menu principal'}>
      <div className="v5-sb-logo">
        <div className="v5-sb-logo-name" style={{ cursor: 'pointer' }} onClick={() => navigateTo('home')}>
          VITFIX <span className="v5-sb-logo-badge">PRO</span>
        </div>
      </div>
      {/* ═══ RECHERCHE DE MODULES — menu dynamique seulement ═══ */}
      {useDynamic && (
        <div className={`v5-sb-rech${requete === '' ? '' : ' saisie'}`} role="search">
          <svg className="v5-sb-rech-ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={champRecherche}
            type="text"
            className="v5-sb-rech-in"
            value={requete}
            onChange={e => { setRequete(e.target.value); setChoixClavier(null) }}
            onKeyDown={surToucheRecherche}
            placeholder={isPt ? 'Pesquisar um módulo…' : 'Rechercher un module…'}
            aria-label={isPt ? 'Pesquisar um módulo' : 'Rechercher un module'}
            title={isPt ? 'Pesquisar um módulo (Ctrl+K, ⌘K no Mac)' : 'Rechercher un module (Ctrl+K, ⌘K sur Mac)'}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
          {requete !== '' && (
            <button
              type="button"
              className="v5-sb-rech-x"
              onClick={() => { effacerRecherche(); champRecherche.current?.focus() }}
              aria-label={isPt ? 'Limpar a pesquisa' : 'Effacer la recherche'}
            >
              ×
            </button>
          )}
          {/* Zone d'état native (rôle status) : annonce le nombre de résultats aux lecteurs d'écran. */}
          <output className="sr-only" aria-live="polite">{annonceRecherche}</output>
        </div>
      )}
      <div className="v5-sb-nav" ref={zoneNavigation}>

        {/* ═══ DYNAMIC — driven by ModulesSection ═══ */}
        {rubriques.map(rubrique => {
          const visibles = recherche.active ? rubrique.modules.filter(m => retenus.has(m.id)) : rubrique.modules
          if (visibles.length === 0) return null
          return (
            <div key={rubrique.id} className="v5-sb-sec">
              <div className="v5-sb-sec-t">{rubrique.nom}</div>
              {visibles.map(mod => (
                <V5SidebarItem
                  key={mod.id}
                  icon={mod.icon}
                  label={mod.name}
                  active={activeFor(mod.id)}
                  badge={badgeFor(mod.id)}
                  onClick={() => ouvrir(mod.id)}
                  page={mod.id}
                  choisi={recherche.active && mod.id === idChoisi}
                />
              ))}
            </div>
          )
        })}

        {/* ═══ RECHERCHE — entrées du bloc « Compte » trouvées, à la suite des résultats ═══ */}
        {compteTrouves.length > 0 && (
          <div className="v5-sb-sec">
            <div className="v5-sb-sec-t">{isPt ? 'Conta' : 'Compte'}</div>
            {compteTrouves.map(mod => (
              <V5SidebarItem
                key={mod.id}
                icon={mod.icon}
                label={isPt ? mod.pt : mod.fr}
                active={activePage === mod.id}
                onClick={() => ouvrir(mod.id)}
                page={mod.id}
                choisi={mod.id === idChoisi}
              />
            ))}
          </div>
        )}

        {/* ═══ RECHERCHE — rien trouvé ═══ */}
        {recherche.active && recherche.ids.length === 0 && (
          <div className="v5-sb-rech-vide">
            <p>{isPt ? 'Nenhum módulo encontrado' : 'Aucun module trouvé'}</p>
            {!salarieDeTerrain && (
              <button type="button" className="v5-sb-rech-lien" onClick={() => ouvrir('modules')}>
                {isPt ? 'Ver todos os módulos' : 'Voir tous les modules'}
              </button>
            )}
          </div>
        )}

        {/* ═══ LEGACY HARDCODED — shown when no dynamic categories provided ═══ */}
        {!useDynamic && <>

        {/* ═══ PILOTAGE ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Gestão' : 'Pilotage'}</div>
          <V5SidebarItem icon="📊" label={isPt ? 'Painel' : 'Tableau de bord'} active={activePage === 'home'} onClick={() => navigateTo('home')} page="home" />
          {(isProGerant || proCanAccess('gestion_comptes')) && (
            <V5SidebarItem icon="👥" label={isPt ? 'Contas de utilizadores' : 'Comptes utilisateurs'} active={activePage === 'gestion_comptes'} onClick={() => navigateTo('gestion_comptes')} page="gestion_comptes" />
          )}
          {isModuleEnabled('stats') && (
            <V5SidebarItem icon="📈" label={isPt ? 'Estatísticas' : 'Statistiques'} active={activePage === 'stats'} onClick={() => navigateTo('stats')} page="stats" />
          )}
          {isModuleEnabled('revenus') && (
            <V5SidebarItem icon="💰" label={isPt ? 'Receitas' : 'Revenus'} active={activePage === 'revenus'} onClick={() => navigateTo('revenus')} />
          )}
          <V5SidebarItem icon="🗂️" label={isPt ? 'Serviços' : 'Prestations'} active={activePage === 'prestations' || activePage === 'motifs' || activePage === 'bibliotheque'} onClick={() => navigateTo('prestations')} />
        </div>

        {/* ═══ CHANTIERS ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Obras' : 'Chantiers'}</div>
          {proCanAccess('chantiers') && (
            <V5SidebarItem icon="🏗️" label={isPt ? 'Obras' : 'Chantiers'} active={activePage === 'chantiers'} onClick={() => navigateTo('chantiers')} page="chantiers" />
          )}
          {proCanAccess('gantt') && (
            <V5SidebarItem icon="📊" label={isPt ? 'Planeamento Gantt' : 'Planification Gantt'} active={activePage === 'gantt'} onClick={() => navigateTo('gantt')} page="gantt" />
          )}
          {proCanAccess('equipes') && (
            <V5SidebarItem icon="👷" label={isPt ? 'Equipas' : 'Équipes'} active={activePage === 'equipes'} onClick={() => navigateTo('equipes')} page="equipes" />
          )}
          {proCanAccess('pointage') && (
            <V5SidebarItem icon="⏱️" label={isPt ? 'Registo de horas' : 'Pointage équipes'} active={activePage === 'pointage'} onClick={() => navigateTo('pointage')} page="pointage" />
          )}
          {proCanAccess('calendar') && (
            <V5SidebarItem icon="📅" label={isPt ? 'Agenda' : 'Agenda / Planning'} active={activePage === 'calendar'} badge={pendingBookings.length || undefined} onClick={() => navigateTo('calendar')} page="calendar" />
          )}
          <V5SidebarItem icon="🌤️" label={isPt ? 'Meteorologia' : 'Météo chantiers'} active={activePage === 'meteo'} onClick={() => navigateTo('meteo')} />
          {isModuleEnabled('photos_chantier') && (
            <V5SidebarItem icon="📸" label={isPt ? 'Fotos de obra' : 'Photos Chantier'} active={activePage === 'photos_chantier'} onClick={() => navigateTo('photos_chantier')} />
          )}
          {isModuleEnabled('rapports') && (
            <V5SidebarItem icon="📋" label={isPt ? 'Relatórios de obra' : 'Rapports de chantier'} active={activePage === 'rapports'} onClick={() => navigateTo('rapports')} page="rapports" />
          )}
        </div>

        {/* ═══ COMMERCIAL ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Comercial' : 'Commercial'}</div>
          <V5SidebarItem icon="📊" label="Pipeline" active={activePage === 'pipeline'} onClick={() => navigateTo('pipeline')} page="pipeline" />
          {isModuleEnabled('devis') && (
            <V5SidebarItem icon="📄" label={isPt ? 'Orçamentos' : 'Devis'} active={activePage === 'devis'} onClick={() => navigateTo('devis')} page="devis" />
          )}
          {proCanAccess('dpgf') && (
            <V5SidebarItem icon="📁" label={isPt ? 'Concursos / Mapas de quantidades' : "Appels d'offres / DPGF"} active={activePage === 'dpgf'} onClick={() => navigateTo('dpgf')} />
          )}
          {isModuleEnabled('marches') && (
            <V5SidebarItem icon="📢" label={isPt ? 'Bolsa de oportunidades' : 'Bourse aux Marchés'} active={activePage === 'marches'} onClick={() => navigateTo('marches')} />
          )}
        </div>

        {/* ═══ FACTURATION ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Faturação' : 'Facturation'}</div>
          {isModuleEnabled('factures') && (
            <V5SidebarItem icon="💳" label={isPt ? 'Faturas' : 'Factures'} active={activePage === 'factures'} onClick={() => navigateTo('factures')} page="factures" />
          )}
          {proCanAccess('situations') && (
            <V5SidebarItem icon="📈" label={isPt ? 'Autos de medição' : 'Situations de travaux'} active={activePage === 'situations'} onClick={() => navigateTo('situations')} />
          )}
          {proCanAccess('garanties') && (
            <V5SidebarItem icon="🔒" label={isPt ? 'Retenções para garantia' : 'Retenues de garantie'} active={activePage === 'garanties'} onClick={() => navigateTo('garanties')} />
          )}
        </div>

        {/* ═══ SOUS-TRAITANCE & ACHATS ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Subempreitada & Compras' : 'Sous-traitance & Achats'}</div>
          {proCanAccess('sous_traitance') && (
            <V5SidebarItem icon="🤝" label={isPt ? 'Subempreitadas' : 'Sous-traitance DC4'} active={activePage === 'sous_traitance'} onClick={() => navigateTo('sous_traitance')} />
          )}
          {proCanAccess('sous_traitance_offres') && (
            <V5SidebarItem icon="🔍" label={isPt ? 'Recrutar subempreiteiros' : 'Recruter sous-traitants'} active={activePage === 'sous_traitance_offres'} onClick={() => navigateTo('sous_traitance_offres')} />
          )}
          {proCanAccess('rfq_btp') && (
            <V5SidebarItem icon="📋" label={isPt ? 'Orçamentos de fornecedores' : 'Devis Fournisseurs'} active={activePage === 'rfq_btp'} onClick={() => navigateTo('rfq_btp')} />
          )}
          {isModuleEnabled('marketplace_btp') && (
            <V5SidebarItem icon="🏪" label={isPt ? 'Marketplace da construção' : 'Marketplace BTP'} active={activePage === 'marketplace_btp'} onClick={() => navigateTo('marketplace_btp')} page="marketplace_btp" />
          )}
        </div>

        {/* ═══ FINANCES ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Finanças' : 'Finances'}</div>
          {proCanAccess('compta_btp') && (
            <V5SidebarItem icon="🧠" label={isPt ? 'Contabilidade IA' : 'Compta Intelligente'} active={activePage === 'compta_btp'} onClick={() => navigateTo('compta_btp')} page="compta_btp" />
          )}
          {proCanAccess('rentabilite') && (
            <V5SidebarItem icon="💰" label={isPt ? 'Rentabilidade' : 'Rentabilité Chantier'} active={activePage === 'rentabilite'} onClick={() => navigateTo('rentabilite')} page="rentabilite" />
          )}
          {isModuleEnabled('comptabilite') && (
            <V5SidebarItem icon="🧮" label={isPt ? 'Contabilidade' : 'Comptabilité'} active={activePage === 'comptabilite'} onClick={() => navigateTo('comptabilite')} page="comptabilite" />
          )}
        </div>

        {/* ═══ COMMUNICATION ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Comunicação' : 'Communication'}</div>
          {isModuleEnabled('messages') && (
            <V5SidebarItem icon="💬" label={isPt ? 'Mensagens' : 'Messagerie'} active={activePage === 'messages' || activePage === 'comm_pro'} badge={(unreadMsgCount + pendingBookings.length) || undefined} onClick={() => navigateTo('messages')} page="messages" />
          )}
          {isModuleEnabled('clients') && (
            <V5SidebarItem icon="👥" label={isPt ? 'Clientes' : 'Base clients'} active={activePage === 'clients'} onClick={() => navigateTo('clients')} page="clients" />
          )}
          <V5SidebarItem icon="🌐" label={isPt ? 'Portal cliente' : 'Portail client'} active={activePage === 'portail_client'} onClick={() => navigateTo('portail_client')} />
        </div>

        {/* ═══ ADMINISTRATION ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Administração' : 'Administration'}</div>
          {isModuleEnabled('wallet') && (
            <V5SidebarItem icon="📁" label={isPt ? 'Conformidade' : 'Conformité'} active={activePage === 'wallet'} onClick={() => navigateTo('wallet')} page="wallet" />
          )}
          {isModuleEnabled('contrats') && (
            <V5SidebarItem icon="📑" label={isPt ? 'Contratos' : 'Contrats'} active={activePage === 'contrats'} onClick={() => navigateTo('contrats')} />
          )}
          <V5SidebarItem icon="⏱️" label={isPt ? 'Horários de obra' : 'Horaires chantier'} active={activePage === 'horaires'} onClick={() => navigateTo('horaires')} />
        </div>

        {/* ═══ VITRINE ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Montra' : 'Vitrine'}</div>
          {isModuleEnabled('portfolio') && (
            <V5SidebarItem icon="🖼️" label={isPt ? 'Referências de obra' : 'Références chantiers'} active={activePage === 'portfolio'} onClick={() => navigateTo('portfolio')} />
          )}
          {isModuleEnabled('parrainage') && (
            <V5SidebarItem icon="🎁" label={isPt ? 'Programa de recomendação' : 'Parrainage'} active={activePage === 'parrainage'} onClick={() => navigateTo('parrainage')} />
          )}
        </div>

        </>}

        {/* ═══ COMPTE (bottom — always hardcoded) ═══ */}
        {/* Masqué (et non démonté : le lien admin garde sa session) pendant une recherche, dont les résultats
            « Compte » s'affichent plus haut, à la suite des autres. */}
        <div className="v5-sb-bottom" hidden={recherche.active}>
          <div className="v5-sb-sec">
            <div className="v5-sb-sec-t">{isPt ? 'Conta' : 'Compte'}</div>
            {modulesCompte.map(mod => (
              <V5SidebarItem
                key={mod.id}
                icon={mod.icon}
                label={isPt ? mod.pt : mod.fr}
                active={activePage === mod.id}
                onClick={() => navigateTo(mod.id)}
                page={mod.id}
              />
            ))}
            {/* Super_admin (ou « vue en tant que ») seulement — même lien côté artisan (V5SidebarArtisan), voulu pour la démo. */}
            <LienPanneauAdmin className="v5-sb-i" style={{ textDecoration: 'none' }}>
              <span className="v5-sb-icon">🛡️</span>
              <span className="v5-sb-label">{isPt ? 'Painel de administração' : 'Panneau admin'}</span>
            </LienPanneauAdmin>
            <div className="v5-sb-i logout" onClick={handleLogout}>
              <span className="v5-sb-icon">🚪</span>
              <span className="v5-sb-label">{isPt ? 'Sair' : 'Déconnexion'}</span>
            </div>
          </div>
        </div>

      </div>
    </aside>
  )
}
