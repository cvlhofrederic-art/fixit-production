'use client'

import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DEMO_NOTIFICATIONS } from '@/components/administrateur-judiciaire/data/notifications'
import { DEMO_PRESTATAIRES } from '@/components/administrateur-judiciaire/data/prestataires'
import { useFixy } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/useFixy'
import { TableauDeBordModule } from '@/components/administrateur-judiciaire/modules/mandat/TableauDeBordModule'
import { REGISTRE_ECRANS, statutEcran } from '@/components/administrateur-judiciaire/modules/registry'
import { DemoBanner } from '@/components/administrateur-judiciaire/shell/DemoBanner'
import { FixyLauncher } from '@/components/administrateur-judiciaire/shell/FixyLauncher'
import {
  LIBELLES_GROUPES_PALETTE,
  LIBELLES_ROUTES,
  ROUTE_SOUS_TITRE,
  SECTIONS_NAVIGATION,
  type EntreeNavigation,
  type SectionNavigation,
} from '@/components/administrateur-judiciaire/shell/nav-config'
import { naviguerVers, routeCourante } from '@/components/administrateur-judiciaire/shell/navigation'
import { RoleCabinetContext } from '@/components/administrateur-judiciaire/shell/RoleCabinetContext'
import { surActivationClavier } from '@/components/administrateur-judiciaire/ui/clavier'
import { FormModal, type ChampFormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useIndexRecherche } from '@/lib/administrateur-judiciaire/db/use-index-recherche'
import {
  rechercherDansIndex,
  type EntreeIndexRecherche,
  type SelectionEntreeIndex,
} from '@/lib/administrateur-judiciaire/domain/recherche'
import { ROLES_CABINET, type RoleCabinet } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'
import { AUJOURDHUI, MODE_ACTIF } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Coque de l'application : bandeau de mode, lanceur Fixy, barre latérale (récents, favoris, sections repliables,
 * épingles), barre du haut (fil d'Ariane, statut de l'écran, rôle, date, notifications, nouvelle intervention),
 * zone de contenu routée par l'ancre d'URL et palette de commandes (⌘K / Ctrl+K).
 */

// ── Préférences conservées dans ce navigateur ─────────────────────────────────────────────────────────────────────

const CLE_ROLE = 'vitfix.aj.role'
const CLE_SECTIONS_REPLIEES = 'vitfix.aj.collapsed'
const CLE_FAVORIS = 'vitfix.aj.favorites'
const CLE_RECENTS = 'vitfix.aj.recents'

/** Nombre maximal de favoris : au-delà, l'ajout est ignoré. */
const NB_FAVORIS_MAX = 8
/** Nombre de routes récentes conservées (« logout » exclu). */
const NB_RECENTS_MAX = 5

/** Notifications de démonstration déjà lues à l'ouverture (état en mémoire uniquement). */
const NOTIFICATIONS_LUES_INITIALES = ['n06', 'n07', 'n08', 'n09', 'n10', 'n11', 'n12']

/** Rôle conservé, sans contrôle de la valeur (comme la maquette) ; « Direction » par défaut. */
function lireRoleStocke(): RoleCabinet {
  try {
    return (localStorage.getItem(CLE_ROLE) || 'Direction') as RoleCabinet
  } catch {
    // localStorage inaccessible (navigation privée, stockage bloqué) : rôle par défaut.
    return 'Direction'
  }
}

/** Valeur JSON conservée ; texteParDefaut est analysé si la clé est absente, repli si la lecture échoue. */
function lireJsonStocke<T>(cle: string, texteParDefaut: string, repli: T): T {
  try {
    return JSON.parse(localStorage.getItem(cle) || texteParDefaut) as T
  } catch {
    // localStorage inaccessible ou valeur illisible : valeur de repli.
    return repli
  }
}

function enregistrerStocke(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur)
  } catch {
    // localStorage inaccessible ou plein : la préférence ne sera pas conservée au rechargement.
  }
}

const estPresent = <T,>(valeur: T | null | undefined): valeur is T => Boolean(valeur)

/**
 * Registre des écrans sans prototype (correctif, absent de la maquette) : seules ses clés propres désignent un écran,
 * une clé héritée d'Object.prototype (#constructor, #valueOf, #__proto__…) y est absente et traitée comme une ancre
 * inconnue au lieu d'être rendue comme un écran.
 */
const ECRANS_PAR_ANCRE: Record<string, ComponentType | undefined> = Object.assign(Object.create(null), REGISTRE_ECRANS)

// ── Barre latérale ────────────────────────────────────────────────────────────────────────────────────────────────

/** Groupe de la barre latérale : section de la configuration, ou groupe « virtuel » Récents / Favoris (sans épingles). */
export interface GroupeNavigation extends SectionNavigation {
  virtual?: boolean
}

/** Première entrée de navigation portant cette route (sous-titres compris), ou null. */
function trouverEntreeNavigation(route: string): EntreeNavigation | null {
  for (const section of SECTIONS_NAVIGATION) for (const entree of section.items) if (entree[0] === route) return entree
  return null
}

/** Groupes affichés : « Récents » puis « Favoris » (s'ils ont des entrées connues), puis les sections. */
export function construireGroupesNavigation(recents: readonly string[], favoris: readonly string[]): GroupeNavigation[] {
  const groupesVirtuels: GroupeNavigation[] = []
  if (recents.length > 0) {
    const entrees = recents.map((route) => trouverEntreeNavigation(route)).filter(estPresent)
    if (entrees.length)
      groupesVirtuels.push({
        title: 'Récents',
        items: entrees,
        virtual: true,
      })
  }
  if (favoris.length > 0) {
    const entrees = favoris.map((route) => trouverEntreeNavigation(route)).filter(estPresent)
    if (entrees.length)
      groupesVirtuels.push({
        title: 'Favoris',
        items: entrees,
        virtual: true,
      })
  }
  return [...groupesVirtuels, ...SECTIONS_NAVIGATION]
}

// ── Palette de commandes ──────────────────────────────────────────────────────────────────────────────────────────

/** Module proposé par la palette (toute entrée de navigation hors sous-titres, « Déconnexion » comprise). */
export interface ModulePalette {
  id: string
  label: string
  icon?: string
  section: string
}

/**
 * Élément de la palette : module ou entrée de l'index de recherche. _group : groupe d'affichage (« modules »,
 * type d'entrée d'index, « recents », « favorites », « all ») ; _s : score quand une requête est saisie.
 */
export interface ElementPalette extends ModulePalette {
  _group: string
  _s?: number
  route?: string
  selection?: SelectionEntreeIndex
}

interface ElementPaletteIndexe extends ElementPalette {
  /** Position dans la liste complète (focus clavier). */
  _i: number
}

interface GroupePalette {
  id: string
  items: ElementPaletteIndexe[]
}

export const MODULES_PALETTE: ModulePalette[] = SECTIONS_NAVIGATION.flatMap((section) =>
  section.items
    .filter((entree) => entree[0] !== ROUTE_SOUS_TITRE)
    .map((entree) => ({
      id: entree[0],
      label: entree[1],
      icon: entree[2],
      section: section.title,
    })),
)

/**
 * Score d'un module pour une requête déjà en minuscules : libellé identique 1000, préfixe 800, contenu 500, section 300,
 * sous-séquence du libellé 100, sinon 0. Sans suppression des accents (contrairement à l'index de recherche).
 */
export function scorerModule(libelle: string, section: string, requete: string): number {
  if (!requete) return 0
  const libelleMinuscules = libelle.toLowerCase(),
    sectionMinuscules = section.toLowerCase()
  if (libelleMinuscules === requete) return 1e3
  if (libelleMinuscules.startsWith(requete)) return 800
  if (libelleMinuscules.includes(requete)) return 500
  if (sectionMinuscules.includes(requete)) return 300
  let i = 0,
    trouves = 0
  for (; i < libelleMinuscules.length && trouves < requete.length; ) {
    if (libelleMinuscules[i] === requete[trouves]) trouves++
    i++
  }
  return trouves === requete.length ? 100 : 0
}

/**
 * Éléments de la palette. Avec une requête (déjà réduite et en minuscules) : modules notés et 14 entrées de l'index au
 * plus, triés par score décroissant (tri stable), 18 au plus. Sans requête : récents, favoris hors récents, puis modules
 * jusqu'à 12 éléments ; au-delà de 12 récents et favoris, slice reçoit une borne négative et renvoie presque tous les
 * modules (comportement de la maquette).
 */
export function construireElementsPalette(
  requete: string,
  index: EntreeIndexRecherche[],
  recents: readonly string[],
  favoris: readonly string[],
): ElementPalette[] {
  if (requete) {
    const modules = MODULES_PALETTE.map((module) => ({
      ...module,
      _s: scorerModule(module.label, module.section, requete),
      _group: 'modules',
    })).filter((module) => module._s > 0)
    const entreesIndex = rechercherDansIndex(index, requete, 14).map((entree) => ({
      ...entree,
      section: entree.sub,
      _group: entree.type,
    }))
    return [...modules, ...entreesIndex].sort((a, b) => b._s - a._s).slice(0, 18)
  }
  const dejaProposes = new Set<string>()
  const elementsRecents = recents
    .map((id) => MODULES_PALETTE.find((module) => module.id === id))
    .filter(estPresent)
    .map((module) => ({
      ...module,
      _group: 'recents',
    }))
  elementsRecents.forEach((element) => dejaProposes.add(element.id))
  const elementsFavoris = favoris
    .map((id) => MODULES_PALETTE.find((module) => module.id === id))
    .filter(estPresent)
    .filter((module) => !dejaProposes.has(module.id))
    .map((module) => ({
      ...module,
      _group: 'favorites',
    }))
  elementsFavoris.forEach((element) => dejaProposes.add(element.id))
  const autresModules = MODULES_PALETTE.filter((module) => !dejaProposes.has(module.id))
    .slice(0, 12 - elementsRecents.length - elementsFavoris.length)
    .map((module) => ({
      ...module,
      _group: 'all',
    }))
  return [...elementsRecents, ...elementsFavoris, ...autresModules]
}

interface PaletteCommandesProps {
  elements: ElementPalette[]
  requete: string
  /** Requête réduite et en minuscules : le titre du groupe « modules » est masqué quand elle n'est pas vide. */
  requeteNormalisee: string
  /** Index focalisé (non borné vers le bas : borné ici au dernier élément). */
  indexFocalise: number
  onChangerRequete: (requete: string) => void
  onFocaliser: (index: number) => void
  onChoisir: (element: ElementPalette) => void
  onFermer: () => void
}

/** Palette de commandes : champ de recherche, éléments groupés (groupes consécutifs de même _group), pied d'aide. */
function PaletteCommandes({
  elements,
  requete,
  requeteNormalisee,
  indexFocalise,
  onChangerRequete,
  onFocaliser,
  onChoisir,
  onFermer,
}: PaletteCommandesProps) {
  const indexActif = Math.min(indexFocalise, elements.length - 1)
  const groupes: GroupePalette[] = []
  elements.forEach((element, position) => {
    const idGroupe = element._group || 'results'
    const dernierGroupe = groupes[groupes.length - 1]
    if (dernierGroupe && dernierGroupe.id === idGroupe)
      dernierGroupe.items.push({
        ...element,
        _i: position,
      })
    else
      groupes.push({
        id: idGroupe,
        items: [
          {
            ...element,
            _i: position,
          },
        ],
      })
  })
  const validerSurEntree = (evenement: ReactKeyboardEvent<HTMLInputElement>) => {
    if (evenement.key === 'Enter' && elements[indexActif]) {
      evenement.preventDefault()
      onChoisir(elements[indexActif])
    }
  }

  return (
    <div className="cmdk-backdrop" onClick={onFermer} role="dialog" aria-modal="true" aria-label="Palette de commandes">
      <div className="cmdk-panel" onClick={(evenement) => evenement.stopPropagation()}>
        <div className="cmdk-input-row">
          <Icon
            name="search"
            style={{
              width: 16,
              height: 16,
              color: 'var(--navy-400)',
            }}
            aria-hidden="true"
          />
          <input
            autoFocus
            value={requete}
            onChange={(evenement) => onChangerRequete(evenement.target.value)}
            onKeyDown={validerSurEntree}
            placeholder="Rechercher une copropriété, une personne, un lot, un prestataire, une échéance, un acte, un module…"
            aria-label="Rechercher"
            className="cmdk-input"
          />
          <kbd className="cmdk-kbd">ESC</kbd>
        </div>
        <div className="cmdk-list" role="listbox">
          {elements.length === 0 && (
            <div className="cmdk-empty">
              <Icon name="search" aria-hidden="true" />
              <div>Aucun résultat pour «{requete}»</div>
            </div>
          )}
          {groupes.map((groupe, indexGroupe) => (
            <div className="cmdk-group" key={indexGroupe}>
              {(!requeteNormalisee || groupe.id !== 'modules') && (
                <div className="cmdk-group-title">{LIBELLES_GROUPES_PALETTE[groupe.id] || groupe.id}</div>
              )}
              {groupe.items.map((element) => (
                <button
                  role="option"
                  aria-selected={element._i === indexActif}
                  onClick={() => onChoisir(element)}
                  onMouseEnter={() => onFocaliser(element._i)}
                  className={`cmdk-item ${element._i === indexActif ? 'is-focused' : ''}`}
                  key={element._i}
                >
                  <Icon
                    name={element.icon}
                    style={{
                      width: 16,
                      height: 16,
                      color: 'var(--navy-500)',
                    }}
                    aria-hidden="true"
                  />
                  <div className="cmdk-item-body">
                    <div className="cmdk-item-label">{element.label}</div>
                    <div className="cmdk-item-section">{element.section}</div>
                  </div>
                  {element._group === 'favorites' && (
                    <Icon
                      name="star"
                      style={{
                        width: 13,
                        height: 13,
                        color: 'var(--gold-500)',
                      }}
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    name="arrow"
                    style={{
                      width: 13,
                      height: 13,
                      color: 'var(--navy-200)',
                    }}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span>
            <kbd className="cmdk-kbd-sm">↑↓</kbd>
            Naviguer
          </span>
          <span>
            <kbd className="cmdk-kbd-sm">↵</kbd>
            Sélectionner
          </span>
          <span>
            <kbd className="cmdk-kbd-sm">⌘K</kbd>
            Ouvrir
          </span>
          <span>
            <kbd className="cmdk-kbd-sm">ESC</kbd>
            Fermer
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Nouvelle intervention ─────────────────────────────────────────────────────────────────────────────────────────

const CHAMPS_NOUVEL_ORDRE_DE_SERVICE: ChampFormModal[] = [
  {
    label: 'Copropriété',
    type: 'select',
    options: DEMO_NOMS_COPROPRIETES,
    full: true,
  },
  {
    label: 'Objet',
    required: true,
    full: true,
  },
  {
    label: 'Prestataire',
    type: 'select',
    options: DEMO_PRESTATAIRES.map((prestataire) => prestataire.nom),
  },
  {
    label: 'Urgence',
    type: 'select',
    options: ['Normale', 'Prioritaire', 'Urgence'],
  },
  {
    label: 'Description',
    type: 'textarea',
    full: true,
  },
]

// ── Shell ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function Shell() {
  const { push } = useToast()
  const [route, setRoute] = useState('cockpit')
  const [role, setRole] = useState<RoleCabinet>(lireRoleStocke)
  const [sectionsRepliees, setSectionsRepliees] = useState<Record<string, boolean>>(() =>
    lireJsonStocke<Record<string, boolean>>(CLE_SECTIONS_REPLIEES, '{}', {}),
  )
  const [paletteOuverte, setPaletteOuverte] = useState(false)
  const [requete, setRequete] = useState('')
  const [indexFocalise, setIndexFocalise] = useState(0)
  const [notificationsOuvertes, setNotificationsOuvertes] = useState(false)
  const [notificationsLues, setNotificationsLues] = useState<Set<string>>(() => new Set(NOTIFICATIONS_LUES_INITIALES))
  const [menuMobileOuvert, setMenuMobileOuvert] = useState(false)
  const [interventionOuverte, setInterventionOuverte] = useState(false)
  const [favoris, setFavoris] = useState<string[]>(() => lireJsonStocke<string[]>(CLE_FAVORIS, '[]', []))
  const [recents, setRecents] = useState<string[]>(() => lireJsonStocke<string[]>(CLE_RECENTS, '[]', []))
  const notificationsRef = useRef<HTMLDivElement>(null)
  const boutonNotificationsRef = useRef<HTMLButtonElement>(null)
  /** Ouverture de la palette, lue par l'écouteur clavier global (installé une seule fois). */
  const paletteOuverteRef = useRef(false)
  const nbNonLues = DEMO_NOTIFICATIONS.filter((notification) => !notificationsLues.has(notification.id)).length
  // Une route absente du registre retombe sur le tableau de bord.
  const Ecran = ECRANS_PAR_ANCRE[route] || TableauDeBordModule

  useEffect(() => {
    paletteOuverteRef.current = paletteOuverte
  }, [paletteOuverte])

  useEffect(() => {
    // L'ancre n'est retenue que si elle désigne un écran du registre.
    const suivreAncre = () => {
      const routeAncre = routeCourante()
      if (routeAncre && ECRANS_PAR_ANCRE[routeAncre]) setRoute(routeAncre)
    }
    suivreAncre()
    window.addEventListener('hashchange', suivreAncre)
    return () => window.removeEventListener('hashchange', suivreAncre)
  }, [])

  useEffect(() => {
    const basculerPalette = (evenement: KeyboardEvent) => {
      if ((evenement.metaKey || evenement.ctrlKey) && evenement.key.toLowerCase() === 'k') {
        evenement.preventDefault()
        setPaletteOuverte((ouverte) => !ouverte)
      }
      if (evenement.key === 'Escape') setPaletteOuverte(false)
    }
    // ↓ n'est pas borné ici : l'index est borné au rendu de la palette (comportement de la maquette).
    const deplacerFocus = (evenement: KeyboardEvent) => {
      if (!paletteOuverteRef.current) return
      if (evenement.key === 'ArrowDown') {
        evenement.preventDefault()
        setIndexFocalise((index) => index + 1)
      } else if (evenement.key === 'ArrowUp') {
        evenement.preventDefault()
        setIndexFocalise((index) => Math.max(0, index - 1))
      }
    }
    window.addEventListener('keydown', deplacerFocus)
    window.addEventListener('keydown', basculerPalette)
    return () => {
      window.removeEventListener('keydown', basculerPalette)
      window.removeEventListener('keydown', deplacerFocus)
    }
  }, [])

  useEffect(() => {
    enregistrerStocke(CLE_SECTIONS_REPLIEES, JSON.stringify(sectionsRepliees))
  }, [sectionsRepliees])

  useEffect(() => {
    enregistrerStocke(CLE_FAVORIS, JSON.stringify(favoris))
  }, [favoris])

  useEffect(() => {
    enregistrerStocke(CLE_RECENTS, JSON.stringify(recents))
  }, [recents])

  useEffect(() => {
    // Le menu mobile se referme à chaque changement d'écran (effet de la maquette, conservé tel quel).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuMobileOuvert(false)
  }, [route])

  useEffect(() => {
    if (!menuMobileOuvert) return
    document.body.style.overflow = 'hidden'
    const fermerSurEchap = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') setMenuMobileOuvert(false)
    }
    window.addEventListener('keydown', fermerSurEchap)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', fermerSurEchap)
    }
  }, [menuMobileOuvert])

  useEffect(() => {
    if (!notificationsOuvertes) return
    const fermerSiClicExterieur = (evenement: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(evenement.target as Node | null))
        setNotificationsOuvertes(false)
    }
    // Échap referme le panneau et rend le focus à la cloche.
    const fermerSurEchap = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') {
        setNotificationsOuvertes(false)
        boutonNotificationsRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', fermerSiClicExterieur)
    document.addEventListener('keydown', fermerSurEchap)
    return () => {
      document.removeEventListener('mousedown', fermerSiClicExterieur)
      document.removeEventListener('keydown', fermerSurEchap)
    }
  }, [notificationsOuvertes])

  useEffect(() => {
    // Le focus revient au premier élément quand la requête change ou que la palette s'ouvre / se ferme
    // (effet de la maquette, conservé tel quel).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndexFocalise(0)
  }, [requete, paletteOuverte])

  const indexRecherche = useIndexRecherche()
  const fixy = useFixy()
  const nbCopros = fixy.p.copros.length
  const selection = useSelectionDossier()

  const changerRole = (nouveauRole: RoleCabinet) => {
    setRole(nouveauRole)
    enregistrerStocke(CLE_ROLE, nouveauRole)
  }

  const marquerLue = (id: string) =>
    setNotificationsLues((lues) => {
      const suivantes = new Set(lues)
      suivantes.add(id)
      return suivantes
    })

  const toutMarquerLu = () => setNotificationsLues(new Set(DEMO_NOTIFICATIONS.map((notification) => notification.id)))

  const basculerSection = (titre: string) =>
    setSectionsRepliees((repliees) => ({
      ...repliees,
      [titre]: !repliees[titre],
    }))

  const basculerFavori = (id: string) =>
    setFavoris((actuels) =>
      actuels.includes(id)
        ? actuels.filter((favori) => favori !== id)
        : actuels.length >= NB_FAVORIS_MAX
          ? actuels
          : [...actuels, id],
    )

  const ajouterRecent = (id: string) => {
    if (id !== 'logout') setRecents((actuels) => [id, ...actuels.filter((recent) => recent !== id)].slice(0, NB_RECENTS_MAX))
  }

  /** Ouvre un écran ; « logout » n'affiche qu'un toast (aucune session dans cette version). */
  const naviguer = (cible: string) => {
    if (cible === 'logout') {
      push({
        kind: 'info',
        title: 'Déconnexion',
        desc: 'Fin de session (démonstration)',
      })
      return
    }
    ajouterRecent(cible)
    naviguerVers(cible)
    setRoute(cible)
    window.scrollTo(0, 0)
    setPaletteOuverte(false)
  }

  /** Un résultat de l'index sélectionne d'abord son dossier (copropriété, copropriétaire), puis ouvre son écran. */
  const choisirElementPalette = (element: ElementPalette) => {
    if (element.selection) {
      if (element.selection.code) selection.choisirCopro(element.selection.code)
      if (element.selection.coproprietaireId) selection.choisirPersonne(element.selection.coproprietaireId)
    }
    naviguer(element.route || element.id)
  }

  /** Compteur affiché : copropriétés de la base pour « copros » et « mandats », rappels de Fixy pour « cockpit ». */
  const compteurEntree = (routeEntree: string, compteurStatique: number | null | undefined) =>
    routeEntree === 'copros' || routeEntree === 'mandats'
      ? nbCopros || compteurStatique
      : (routeEntree === 'cockpit' && fixy.veille.length) || compteurStatique

  const requeteNormalisee = requete.trim().toLowerCase()
  const elementsPalette = construireElementsPalette(requeteNormalisee, indexRecherche, recents, favoris)
  const groupesNavigation = construireGroupesNavigation(recents, favoris)
  const statut = statutEcran(route)

  return (
    <>
      <DemoBanner />
      <FixyLauncher route={route} fixy={fixy} />
      <div className="app">
        <aside className={`sidebar ${menuMobileOuvert ? 'is-open' : ''}`} aria-label="Navigation principale">
          <div className="brand">
            <div className="mark">V</div>
            <div>
              <div className="name">VitFix Pro</div>
              <div className="role">Syndic judiciaire</div>
            </div>
          </div>
          <button
            className="side-search"
            onClick={() => setPaletteOuverte(true)}
            aria-label="Ouvrir la palette de commandes"
            style={{
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <Icon
              name="search"
              style={{
                width: 14,
                height: 14,
              }}
              aria-hidden="true"
            />
            <span>Rechercher…</span>
            <kbd>⌘K</kbd>
          </button>
          {groupesNavigation.map((groupe, indexGroupe) => {
            const replie = !!sectionsRepliees[groupe.title]
            return (
              <div
                className={`nav-group ${replie ? 'collapsed' : ''} ${groupe.virtual ? 'nav-group--virtual' : ''}`}
                key={`${groupe.virtual ? 'v' : 'r'}-${indexGroupe}`}
              >
                <h6
                  onClick={() => basculerSection(groupe.title)}
                  onKeyDown={surActivationClavier(() => basculerSection(groupe.title))}
                  role="button"
                  tabIndex={0}
                  aria-expanded={!replie}
                >
                  <span>{groupe.title}</span>
                  <span className="caret">▼</span>
                </h6>
                {groupe.items.map((entree, indexEntree) => {
                  if (entree[0] === ROUTE_SOUS_TITRE)
                    return (
                      <div className="nav-subheader" role="presentation" key={indexEntree}>
                        <span>{entree[1]}</span>
                      </div>
                    )
                  const estFavori = favoris.includes(entree[0])
                  const actif = route === entree[0]
                  const compteur = compteurEntree(entree[0], entree[3])
                  return (
                    <div className={`nav-item-row ${actif ? 'active' : ''}`} key={indexEntree}>
                      <button className={`nav-item ${actif ? 'active' : ''}`} onClick={() => naviguer(entree[0])}>
                        <Icon name={entree[2]} aria-hidden="true" />
                        <span>{entree[1]}</span>
                        {compteur != null && <span className="count">{compteur}</span>}
                        {entree[4] && <span className="dot-st" aria-label="État actif" />}
                      </button>
                      {!groupe.virtual && entree[0] !== 'logout' && (
                        <button
                          className={`nav-pin ${estFavori ? 'is-active' : ''}`}
                          onClick={(evenement) => {
                            evenement.stopPropagation()
                            basculerFavori(entree[0])
                          }}
                          aria-label={estFavori ? `Retirer ${entree[1]} des favoris` : `Ajouter ${entree[1]} aux favoris`}
                          aria-pressed={estFavori}
                        >
                          <Icon name="star" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
          <div className="side-foot">
            <button
              className="user-chip"
              onClick={() => naviguer('parametres')}
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                border: 'none',
                background: 'transparent',
              }}
            >
              <div className="av">CD</div>
              <div className="who">
                <b>Cabinet Delaunay</b>
                <span>TJ NANTERRE</span>
              </div>
              <Icon
                name="chevronDown"
                style={{
                  width: 14,
                  height: 14,
                  marginLeft: 'auto',
                  color: 'var(--navy-200)',
                }}
                aria-hidden="true"
              />
            </button>
          </div>
        </aside>
        <div
          className={`sidebar-backdrop ${menuMobileOuvert ? 'is-open' : ''}`}
          onClick={() => setMenuMobileOuvert(false)}
          aria-hidden="true"
        />
        <main id="main" tabIndex={-1} aria-label="Contenu principal">
          <div className="topbar" role="banner">
            <button
              className="hamburger"
              aria-label="Ouvrir le menu"
              aria-expanded={menuMobileOuvert}
              onClick={() => setMenuMobileOuvert(true)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="crumb">
              <span>VitFix</span>
              <Icon name="chevron" aria-hidden="true" />
              <b>{LIBELLES_ROUTES[route] || route}</b>
              <span
                className={`pill ${statut === 'reel' ? 'sage' : statut === 'partiel' ? 'amber' : 'navy'} no-dot`}
                style={{
                  marginLeft: 10,
                  fontSize: 10,
                }}
                title={
                  statut === 'reel'
                    ? 'Écran branché sur la base locale, données enregistrées'
                    : statut === 'partiel'
                      ? 'Lit la base et le moteur de délais, garde des données de démonstration'
                      : "Écran de démonstration : rien n'est enregistré (gel M6)"
                }
              >
                {statut === 'reel' ? 'Données réelles' : statut === 'partiel' ? 'Partiel' : 'Démonstration'}
              </span>
            </div>
            <div className="crumb-mobile">
              <b>{LIBELLES_ROUTES[route] || route}</b>
            </div>
            <div className="spacer" />
            <label
              className="vfx-role"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                color: 'var(--navy-500)',
              }}
              title="Espace de travail par rôle"
            >
              <Icon
                name="users"
                style={{
                  width: 14,
                  height: 14,
                }}
                aria-hidden="true"
              />
              <select
                aria-label="Rôle dans le cabinet"
                value={role}
                onChange={(evenement) => changerRole(evenement.target.value as RoleCabinet)}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: '5px 8px',
                  fontSize: 11.5,
                  background: '#fff',
                  color: 'var(--ink)',
                }}
              >
                {ROLES_CABINET.map((roleCabinet) => (
                  <option value={roleCabinet} key={roleCabinet}>
                    {roleCabinet}
                  </option>
                ))}
              </select>
            </label>
            <div className="crumb">
              <time dateTime={AUJOURDHUI.toISOString()}>
                {new Intl.DateTimeFormat('fr-FR', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                }).format(AUJOURDHUI)}
              </time>
            </div>
            <button
              className="icon-btn"
              aria-label="Ouvrir la palette de commandes (⌘K)"
              onClick={() => setPaletteOuverte(true)}
            >
              <Icon name="search" aria-hidden="true" />
            </button>
            <div className="notifs-wrap" ref={notificationsRef}>
              <button
                ref={boutonNotificationsRef}
                type="button"
                className="icon-btn notifs-btn"
                aria-label={`Voir les notifications (${nbNonLues} non lues)`}
                aria-haspopup="dialog"
                aria-expanded={notificationsOuvertes ? 'true' : 'false'}
                onClick={() => setNotificationsOuvertes((ouvertes) => !ouvertes)}
              >
                <Icon name="bell" aria-hidden="true" />
                {nbNonLues > 0 && <span className="pulse" aria-hidden="true" />}
              </button>
              {notificationsOuvertes && (
                <div className="notifs-panel" role="dialog" aria-label="Centre de notifications">
                  <header className="notifs-head">
                    <div>
                      <h3 className="notifs-title">Notifications</h3>
                      <p className="notifs-sub">
                        {nbNonLues === 0 ? 'Tout est à jour' : `${nbNonLues} non ${nbNonLues === 1 ? 'lue' : 'lues'}`}
                      </p>
                    </div>
                    {nbNonLues > 0 && (
                      <button type="button" className="notifs-mark-all" onClick={toutMarquerLu}>
                        Tout marquer comme lu
                      </button>
                    )}
                  </header>
                  <ul className="notifs-list" role="list">
                    {DEMO_NOTIFICATIONS.map((notification) => {
                      const nonLue = !notificationsLues.has(notification.id)
                      return (
                        <li className={`notifs-item ${nonLue ? 'unread' : ''}`} key={notification.id}>
                          <button
                            type="button"
                            className="notifs-item-btn"
                            onClick={() => {
                              marquerLue(notification.id)
                              setNotificationsOuvertes(false)
                            }}
                          >
                            <span className={`notifs-item-icon kind-${notification.kind}`} aria-hidden="true">
                              <Icon name={notification.icon} />
                            </span>
                            <span className="notifs-item-content">
                              <span className="notifs-item-title">{notification.title}</span>
                              <span className="notifs-item-desc">{notification.desc}</span>
                              <span className="notifs-item-time">{notification.time}</span>
                            </span>
                            {nonLue && <span className="notifs-item-dot" aria-label="Non lue" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <footer className="notifs-foot">
                    <a
                      role="button"
                      tabIndex={0}
                      style={{
                        cursor: 'pointer',
                      }}
                      onClick={() => setNotificationsOuvertes(false)}
                      onKeyDown={surActivationClavier(() => setNotificationsOuvertes(false))}
                    >
                      Voir toutes les notifications →
                    </a>
                  </footer>
                </div>
              )}
            </div>
            <button className="btn gold topbar-actions-desktop" onClick={() => setInterventionOuverte(true)}>
              <Icon name="plus" aria-hidden="true" />
              Nouvelle intervention
            </button>
          </div>
          <div className="content" role="region" aria-label="Page">
            <RoleCabinetContext.Provider value={role}>
              {MODE_ACTIF === 'reel' && statut !== 'reel' && (
                <div className="alert warn" role="alert">
                  <Icon name="alert" />
                  <div>
                    <b>{statut === 'demo' ? 'Écran de démonstration' : 'Écran partiellement branché'}</b>
                    <p>
                      {statut === 'demo'
                        ? "Ce qu'il affiche est une démonstration, pas vos données : il n'est pas encore branché sur la base."
                        : "Une partie de ce qu'il affiche vient encore de la démonstration, pas de vos données."}
                    </p>
                  </div>
                </div>
              )}
              <Ecran />
            </RoleCabinetContext.Provider>
          </div>
        </main>
        <FormModal
          open={interventionOuverte}
          onClose={() => setInterventionOuverte(false)}
          title="Nouvel ordre de service"
          icon="clipboard"
          fields={CHAMPS_NOUVEL_ORDRE_DE_SERVICE}
          submitLabel="Créer"
          onDone={() =>
            push({
              kind: 'success',
              title: 'Simulation',
              desc: "Aucune donnée n'a été enregistrée.",
            })
          }
        />
        {paletteOuverte && (
          <PaletteCommandes
            elements={elementsPalette}
            requete={requete}
            requeteNormalisee={requeteNormalisee}
            indexFocalise={indexFocalise}
            onChangerRequete={setRequete}
            onFocaliser={setIndexFocalise}
            onChoisir={choisirElementPalette}
            onFermer={() => setPaletteOuverte(false)}
          />
        )}
      </div>
    </>
  )
}
