'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { useCoproprietesAffichees, type CoproprieteAffichee } from '@/lib/administrateur-judiciaire/db/hooks'
import {
  filtrerCopros,
  fondementCourt,
  personneDeLaCopro,
  porteeRoute,
  rappelFinMission,
} from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Sélecteur de copropriété du haut de page (demande de Hugo du 29/10/2026). Combobox ARIA : le champ garde le focus,
 * l'option active est désignée par aria-activedescendant et ramenée dans la zone visible de la liste ; ↑ ↓ Entrée
 * Échap au clavier, clic extérieur pour refermer ; tout le cadre est cliquable. Au repos : nom, code, fondement et
 * rappel de fin de mission de la copropriété choisie. Sur une page générale (tableau de bord, page d'accueil ; pages
 * du cabinet) : « Tous les mandats (N) · dossier : … », le choix étant conservé pour les autres pages et annoncé.
 */

/** Message de la base vide (celui du sélecteur des écrans de pilotage). */
const MESSAGE_BASE_VIDE =
  "Aucune copropriété dans la base : créer un mandat depuis Fixy (ordonnance déposée) ou l'écran Copropriétés."

export interface SelecteurCoproGlobalProps {
  /** Route affichée : sur une page de portée générale, le champ montre tous les mandats. */
  route: string
}

const borner = (index: number, nombre: number): number => Math.max(0, Math.min(index, nombre - 1))

/** Choisit la copropriété ; oublie le copropriétaire sélectionné s'il n'a pas de lot dans cette copropriété. */
function choisirCoproDuDossier(copro: CoproprieteAffichee): void {
  const { coproprietaireId, choisirCopro, choisirPersonne } = useSelectionDossier.getState()
  choisirCopro(copro.code)
  if (coproprietaireId && !personneDeLaCopro(coproprietaireId, copro.id, useDonneesStore.getState()))
    choisirPersonne(null)
}

/** Texte du champ au repos : la copropriété choisie, ou tous les mandats (et le dossier choisi) sur une page générale. */
export function texteAuReposSelecteur(
  generale: boolean,
  nbCopros: number,
  courante: Pick<CoproprieteAffichee, 'nom'> | null,
): string {
  if (!generale) return courante?.nom ?? ''
  return courante ? `Tous les mandats (${nbCopros}) · dossier : ${courante.nom}` : `Tous les mandats (${nbCopros})`
}

/** Code, fondement et rappel de fin de mission de la copropriété affichée. */
function DetailCopro({ copro }: { copro: CoproprieteAffichee }) {
  const fondement = fondementCourt(copro.fondement),
    rappel = rappelFinMission(copro.echeance)
  return (
    <span className="vfx-selecteur-copro__detail">
      <span className="mono">{copro.code}</span>
      {/* Pastille secondaire : masquée quand la place manque (aj-selecteur-copro.css), au profit du nom. */}
      {fondement && (
        <span className="vfx-selecteur-copro__fondement">
          <Pill noDot>{fondement}</Pill>
        </span>
      )}
      {rappel.texte && (
        <Pill kind={rappel.retard ? 'rust' : 'gold'} noDot>
          <span className="sr-only">Fin de mission : </span>
          {rappel.texte}
        </Pill>
      )}
    </span>
  )
}

/** Ligne secondaire d'une option : code, fondement abrégé et fin de mission. */
const detailOption = (copro: CoproprieteAffichee): string =>
  [copro.code, fondementCourt(copro.fondement), copro.echeance && `fin ${copro.echeance}`].filter(Boolean).join(' · ')

interface OptionCoproProps {
  copro: CoproprieteAffichee
  id: string
  active: boolean
  choisie: boolean
  onActiver: () => void
  onChoisir: () => void
}

/** Option de la liste : nom, puis code, fondement et fin de mission ; la copropriété choisie est signalée. */
function OptionCopro({ copro, id, active, choisie, onActiver, onChoisir }: OptionCoproProps) {
  return (
    <button
      type="button"
      role="option"
      tabIndex={-1}
      id={id}
      aria-selected={active}
      className={`cmdk-item ${active ? 'is-focused' : ''}`}
      // Le focus reste dans le champ (aria-activedescendant) : le clic ne doit pas le lui retirer.
      onMouseDown={(evenement) => evenement.preventDefault()}
      onMouseEnter={onActiver}
      onClick={onChoisir}
    >
      <span className="cmdk-item-body">
        <span className="cmdk-item-label">
          {copro.nom}
          {choisie && <span className="sr-only"> (choisie)</span>}
        </span>{' '}
        <span className="cmdk-item-section">{detailOption(copro)}</span>
      </span>
      {choisie && <Icon name="check" aria-hidden="true" />}
    </button>
  )
}

/** Combobox des copropriétés (au moins une copropriété). */
function ChampSelecteurCopro({ route, copros }: { route: string; copros: CoproprieteAffichee[] }) {
  const code = useSelectionDossier((etat) => etat.code),
    [ouvert, setOuvert] = useState(false),
    [recherche, setRecherche] = useState(''),
    [indexActif, setIndexActif] = useState(0),
    [annonce, setAnnonce] = useState(''),
    racineRef = useRef<HTMLDivElement>(null),
    idListe = useId()

  const generale = porteeRoute(route) === 'generale',
    courante = copros.find((copro) => copro.code === code) ?? null,
    texteAuRepos = texteAuReposSelecteur(generale, copros.length, courante),
    resultats = ouvert ? filtrerCopros(copros, recherche) : [],
    indexBorne = borner(indexActif, resultats.length),
    active = resultats[indexBorne],
    idOption = (index: number) => `${idListe}-option-${index}`

  useEffect(() => {
    if (!ouvert) return undefined
    const fermerSiClicExterieur = (evenement: MouseEvent) => {
      if (racineRef.current && !racineRef.current.contains(evenement.target as Node | null)) {
        setOuvert(false)
        setRecherche('')
      }
    }
    document.addEventListener('mousedown', fermerSiClicExterieur)
    return () => document.removeEventListener('mousedown', fermerSiClicExterieur)
  }, [ouvert])

  // L'option active reste visible quand ↑ ↓ la déplacent au-delà de la zone affichée de la liste.
  useEffect(() => {
    if (ouvert) document.getElementById(`${idListe}-option-${indexBorne}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [ouvert, indexBorne, idListe])

  const ouvrir = () => {
    setRecherche('')
    setIndexActif(Math.max(0, copros.findIndex((copro) => copro.code === code)))
    setOuvert(true)
  }

  const fermer = () => {
    setOuvert(false)
    setRecherche('')
  }

  const choisir = (copro: CoproprieteAffichee) => {
    choisirCoproDuDossier(copro)
    fermer()
    // Page générale : rien ne change à l'écran ; le choix est annoncé (et affiché dans le champ).
    if (generale) setAnnonce(`${copro.nom} : copropriété des autres pages.`)
  }

  /** ↑ / ↓ : ouvre la liste sur la copropriété affichée, puis déplace l'option active (bornée). */
  const deplacer = (pas: number) => {
    if (ouvert) setIndexActif(borner(indexBorne + pas, resultats.length))
    else ouvrir()
  }

  const surTouche = (evenement: ReactKeyboardEvent<HTMLInputElement>) => {
    switch (evenement.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        evenement.preventDefault()
        deplacer(evenement.key === 'ArrowDown' ? 1 : -1)
        break
      case 'Enter':
        if (active) {
          evenement.preventDefault()
          choisir(active)
        }
        break
      case 'Escape':
      case 'Tab':
        fermer()
        break
      default:
        break
    }
  }

  return (
    // Page générale : le texte au repos (tous les mandats et le dossier) peut se tronquer (aj-selecteur-copro.css).
    <div className={generale ? 'vfx-selecteur-copro vfx-selecteur-copro--generale' : 'vfx-selecteur-copro'} ref={racineRef}>
      {/* Le cadre entier est une étiquette du champ : un clic sur l'icône, le code ou les pastilles l'ouvre aussi. */}
      <label className="vfx-selecteur-copro__cadre">
        <Icon name="building" aria-hidden="true" />
        {/* Gabarit : le champ prend la largeur du texte au repos entier (aj-selecteur-copro.css), même pendant la
            recherche ; la barre du haut réduit ses autres éléments avant de le tronquer. */}
        <span className="vfx-selecteur-copro__saisie" data-texte={texteAuRepos}>
          <input
            type="text"
            role="combobox"
            className="vfx-selecteur-copro__champ"
            aria-label="Copropriété affichée"
            aria-autocomplete="list"
            aria-expanded={ouvert}
            aria-controls={idListe}
            aria-activedescendant={active ? idOption(indexBorne) : undefined}
            placeholder="Rechercher une copropriété (nom ou code)"
            autoComplete="off"
            spellCheck={false}
            // Nom entier au survol quand la place manque et que le champ le tronque (points de suspension).
            title={ouvert ? undefined : texteAuRepos || undefined}
            value={ouvert ? recherche : texteAuRepos}
            onChange={(evenement) => {
              setRecherche(evenement.target.value)
              setIndexActif(0)
              setOuvert(true)
            }}
            onClick={() => {
              if (!ouvert) ouvrir()
            }}
            onFocus={(evenement) => evenement.currentTarget.select()}
            onKeyDown={surTouche}
          />
        </span>
        {!generale && courante && <DetailCopro copro={courante} />}
      </label>
      {generale && (
        <span role="status" className="sr-only">
          {annonce}
        </span>
      )}
      <div className="vfx-selecteur-copro__panneau" hidden={!ouvert}>
        <div role="listbox" id={idListe} aria-label="Copropriétés" className="vfx-selecteur-copro__liste">
          {resultats.map((copro, index) => (
            <OptionCopro
              copro={copro}
              id={idOption(index)}
              active={index === indexBorne}
              choisie={copro.code === code}
              onActiver={() => setIndexActif(index)}
              onChoisir={() => choisir(copro)}
              key={copro.id}
            />
          ))}
        </div>
        {ouvert && resultats.length === 0 && (
          <div role="status" className="cmdk-empty">
            Aucune copropriété pour « {recherche.trim()} »
          </div>
        )}
      </div>
    </div>
  )
}

export function SelecteurCoproGlobal({ route }: SelecteurCoproGlobalProps) {
  const copros = useCoproprietesAffichees(),
    charge = useDonneesStore((etat) => etat.loaded)

  // Base vide : le message, une fois la base lue (en mode réel, la liste est vide pendant le chargement).
  if (copros.length === 0)
    return charge ? (
      <span role="status" className="vfx-selecteur-copro__vide">
        {MESSAGE_BASE_VIDE}
      </span>
    ) : null

  return <ChampSelecteurCopro route={route} copros={copros} />
}
