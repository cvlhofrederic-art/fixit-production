import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DEMO_TACHES } from '@/components/administrateur-judiciaire/data/taches'
import { CockpitModule } from '@/components/administrateur-judiciaire/modules/mandat/Cockpit'
import {
  estEnRetard,
  pastilleUrgence,
  tachesDuRole,
} from '@/components/administrateur-judiciaire/modules/mandat/composants/EtatGeneralMandats'
import { TableauDeBordModule } from '@/components/administrateur-judiciaire/modules/mandat/TableauDeBordModule'
import { RoleCabinetContext } from '@/components/administrateur-judiciaire/shell/RoleCabinetContext'
import { ToastContext } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { MODELES_ACTES_EXPRESS } from '@/lib/administrateur-judiciaire/domain/actes/actes-express'
import { joursAvantDateFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { ROLES_CABINET, type RoleCabinet } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Décision de Hugo du 29/10/2026 : « Aujourd'hui » quitte le menu et le Tableau de bord, devenu la page d'accueil,
 * reprend son contenu pour ne rien perdre. En tête (sous le bandeau d'accueil) : l'alerte d'échéance dépassée, le radar
 * des mandats (un clic choisit la copropriété puis ouvre les mandats) et les échéances légales de tous les mandats ;
 * la génération express d'actes suit, car les actes pré-rédigés de la palette, le bouton « Actes » de la fiche 360 et
 * les actions « ouvrir l'acte » de Fixy menaient à « Aujourd'hui ». Le reste du Tableau de bord est conservé.
 * Les composants viennent d'un module partagé avec l'écran « Aujourd'hui » (Cockpit), sans copie du code.
 */

beforeAll(async () => {
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await useDonneesStore.getState().loadAll()
})

beforeEach(() => {
  useSelectionDossier.setState({ code: 'LM', coproprietaireId: null })
  window.history.replaceState(null, '', window.location.pathname)
})

afterEach(() => {
  cleanup()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
  window.history.replaceState(null, '', window.location.pathname)
})

async function rendreTableauDeBord(role: RoleCabinet = 'Direction'): Promise<void> {
  await act(async () => {
    render(
      <ToastContext.Provider value={{ push: vi.fn(), dismiss: vi.fn() }}>
        <RoleCabinetContext.Provider value={role}>
          <TableauDeBordModule />
        </RoleCabinetContext.Provider>
      </ToastContext.Provider>,
    )
  })
}

/** Carte du radar d'une copropriété (bouton portant son nom et sa fin de mission). */
const cartesRadar = (): HTMLButtonElement[] =>
  screen.getAllByRole<HTMLButtonElement>('button').filter((bouton) => bouton.textContent?.includes('Fin de mission'))
const carteRadar = (nom: string): HTMLButtonElement => {
  const carte = cartesRadar().find((bouton) => bouton.textContent?.includes(nom))
  expect(carte).toBeDefined()
  return carte as HTMLButtonElement
}

/** Panneau dont le titre vaut ce texte. */
const panneau = (titre: string): HTMLElement => {
  const entete = screen.getAllByRole('heading', { level: 3 }).find((element) => element.textContent === titre)
  expect(entete).toBeDefined()
  return (entete as HTMLElement).closest('.panel') as HTMLElement
}

const surtitre = (texte: string): HTMLElement => screen.getByText(texte, { selector: '.section-eyebrow span' })

const titreAlerte = (nombre: number): string => {
  const pluriel = nombre > 1 ? 's' : ''
  return `${nombre} échéance${pluriel} légale${pluriel} dépassée${pluriel}`
}

const nombreTachesEnRetard = (role: RoleCabinet): number =>
  DEMO_TACHES.filter((tache) => role === 'Direction' || tache.role === role).filter((tache) => {
    const jours = joursAvantDateFr(tache.due)
    return jours != null && jours < 0
  }).length

/** Ordre dans le document : vrai si `avant` précède `apres`. */
const precede = (avant: Node, apres: Node): boolean =>
  Boolean(avant.compareDocumentPosition(apres) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('Tableau de bord — radar des mandats repris d’« Aujourd’hui »', () => {
  it('une carte par copropriété sous mandat, avec sa fin de mission', async () => {
    await rendreTableauDeBord()
    expect(surtitre('Radar des mandats — prochaine échéance de mission')).toBeInTheDocument()
    expect(cartesRadar()).toHaveLength(DEMO_COPROPRIETES.length)
    for (const copro of DEMO_COPROPRIETES) expect(carteRadar(copro.nom).textContent).toContain(copro.echeance)
  })

  it('un clic sur une carte choisit sa copropriété puis ouvre les mandats', async () => {
    await rendreTableauDeBord()
    fireEvent.click(carteRadar('Copropriété Les Tilleuls'))
    expect(useSelectionDossier.getState().code).toBe('TL')
    expect(window.location.hash).toBe('#mandats')
    fireEvent.click(carteRadar('Villa Montaigne'))
    expect(useSelectionDossier.getState().code).toBe('VM')
  })

  // Même liste que le sélecteur du haut de page : en mode réel, la base locale (jamais un code de démonstration
  // absent de la base, qui laisserait le sélecteur vide).
  it('les cartes sont celles des copropriétés affichées : une copropriété créée a la sienne, et la choisit', async () => {
    const avant = useDonneesStore.getState()
    let code = ''
    await act(async () => {
      const copro = await avant.createCopropriete({
        nom: 'Résidence Soleil',
        adresse: '1 rue du Soleil',
        nbLots: 10,
        rg: '26/01111',
        fondement: 'sj',
      })
      code = copro.code
    })
    try {
      await rendreTableauDeBord()
      expect(cartesRadar()).toHaveLength(DEMO_COPROPRIETES.length + 1)
      fireEvent.click(carteRadar('Résidence Soleil'))
      expect(useSelectionDossier.getState().code).toBe(code)
    } finally {
      useDonneesStore.setState({ coproprietes: avant.coproprietes, mandats: avant.mandats })
    }
  })
})

describe('Tableau de bord — échéances légales de tous les mandats', () => {
  it('le panneau du moteur de délais légaux liste les échéances du portefeuille', async () => {
    await rendreTableauDeBord()
    const echeances = panneau('Échéances légales · tous les mandats')
    expect(echeances.textContent).toContain('Moteur de délais légaux')
    expect(echeances.textContent).not.toContain('Chargement des mandats…')
    const compteur = Number(echeances.querySelector('.panel-head .right')?.textContent)
    expect(compteur).toBeGreaterThan(0)
    expect(DEMO_COPROPRIETES.some((copro) => echeances.textContent?.includes(copro.nom))).toBe(true)
  })
})

describe('Tableau de bord — alerte d’échéance dépassée', () => {
  it.each(ROLES_CABINET.map((role) => [role]))('rôle « %s » : même alerte qu’« Aujourd’hui »', async (role) => {
    await rendreTableauDeBord(role)
    const nombre = nombreTachesEnRetard(role)
    if (nombre > 0) expect(screen.getByText(titreAlerte(nombre))).toBeInTheDocument()
    else expect(screen.queryByText(/légales? dépassées?$/)).toBeNull()
  })

  it('la démonstration a des échéances dépassées pour la direction', () => {
    expect(nombreTachesEnRetard('Direction')).toBeGreaterThan(0)
  })
})

describe('Tableau de bord — disposition', () => {
  it('alerte, radar et échéances légales en tête, sous le bandeau d’accueil, avant les actions rapides', async () => {
    await rendreTableauDeBord()
    const accueil = screen.getByRole('heading', { level: 1 })
    const alerte = screen.getByText(titreAlerte(nombreTachesEnRetard('Direction')))
    const radar = surtitre('Radar des mandats — prochaine échéance de mission')
    const echeances = panneau('Échéances légales · tous les mandats')
    const actionsRapides = surtitre('Actions rapides')
    expect(accueil.textContent).toContain('Cabinet Delaunay')
    expect(precede(accueil, alerte)).toBe(true)
    expect(precede(alerte, radar)).toBe(true)
    expect(precede(radar, echeances)).toBe(true)
    expect(precede(echeances, actionsRapides)).toBe(true)
  })

  it('le reste du Tableau de bord est conservé', async () => {
    await rendreTableauDeBord()
    expect(surtitre('Actions rapides')).toBeInTheDocument()
    expect(panneau('Suivi budgétaire cumulé — Exercice 2026')).toBeInTheDocument()
    expect(panneau('Échéances prioritaires')).toBeInTheDocument()
    expect(panneau('État des mandats')).toBeInTheDocument()
    expect(screen.getByText('Copropriétés sous mandat')).toBeInTheDocument()
  })

  it('la première ligne de liste reste une échéance prioritaire (raccourcis clavier inchangés)', async () => {
    await rendreTableauDeBord()
    const premiere = document.querySelector('.list-row') as HTMLElement
    expect(within(panneau('Échéances prioritaires')).getAllByRole('button')[0]).toBe(premiere)
  })
})

describe('Tableau de bord — génération express d’actes', () => {
  it('un bouton par modèle ; un clic ouvre l’acte pré-rempli', async () => {
    await rendreTableauDeBord()
    const actes = panneau("Génération express d'actes")
    const modeles = Object.values(MODELES_ACTES_EXPRESS)
    const boutons = within(actes).getAllByRole('button')
    expect(boutons.map((bouton) => bouton.textContent)).toEqual(modeles.map((modele) => modele.label))
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => {
      fireEvent.click(boutons[0])
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('Composants partagés avec « Aujourd’hui »', () => {
  it('pastille d’urgence : échelle inchangée', () => {
    expect(pastilleUrgence(null)).toEqual({ lbl: '—', k: '' })
    expect(pastilleUrgence(-3)).toEqual({ lbl: 'Retard 3 j', k: 'rust' })
    expect(pastilleUrgence(0)).toEqual({ lbl: "Aujourd'hui", k: 'rust' })
    expect(pastilleUrgence(1)).toEqual({ lbl: 'J-1', k: 'amber' })
    expect(pastilleUrgence(3)).toEqual({ lbl: 'J-3', k: 'amber' })
    expect(pastilleUrgence(4)).toEqual({ lbl: 'J-4', k: 'gold' })
    expect(pastilleUrgence(10)).toEqual({ lbl: 'J-10', k: 'gold' })
    expect(pastilleUrgence(11)).toEqual({ lbl: 'J-11', k: 'sage' })
  })

  it('tâches du rôle : toutes pour la direction, les siennes sinon, triées par urgence (sans date en dernier)', () => {
    const direction = tachesDuRole('Direction')
    expect(direction).toHaveLength(DEMO_TACHES.length)
    const jours = direction.map((tache) => tache.d ?? 999)
    expect(jours).toEqual([...jours].sort((a, b) => a - b))
    for (const tache of direction) expect(tache.d).toBe(joursAvantDateFr(tache.due))
    const juridique = tachesDuRole('Juridique')
    expect(juridique.length).toBeGreaterThan(0)
    expect(juridique.every((tache) => tache.role === 'Juridique')).toBe(true)
  })

  it('en retard : échéance passée seulement', () => {
    const tache = DEMO_TACHES[0]
    expect(estEnRetard({ ...tache, d: -1 })).toBe(true)
    expect(estEnRetard({ ...tache, d: 0 })).toBe(false)
    expect(estEnRetard({ ...tache, d: null })).toBe(false)
  })

  it('« Aujourd’hui » (écran conservé hors menu) garde son radar, ses échéances et son alerte', async () => {
    await act(async () => {
      render(
        <ToastContext.Provider value={{ push: vi.fn(), dismiss: vi.fn() }}>
          <CockpitModule />
        </ToastContext.Provider>,
      )
    })
    expect(cartesRadar()).toHaveLength(DEMO_COPROPRIETES.length)
    expect(panneau('Échéances légales · tous les mandats')).toBeInTheDocument()
    expect(panneau("Génération express d'actes")).toBeInTheDocument()
    expect(screen.getByText(titreAlerte(nombreTachesEnRetard('Direction')))).toBeInTheDocument()
  })
})
