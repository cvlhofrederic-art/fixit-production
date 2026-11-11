import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { statutEcran } from '@/components/administrateur-judiciaire/modules/registry'
import { SinistresModule } from '@/components/administrateur-judiciaire/modules/technique/SinistresModule'
import { ToastContext, type OptionsToast, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { DEMO_NOTIFICATIONS } from '@/components/administrateur-judiciaire/data/notifications'
import { DEMO_SINISTRES } from '@/components/administrateur-judiciaire/data/sinistres'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'
import { PHASE_SINISTRE, STATUT_SINISTRE, TYPE_SINISTRE } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Écran Sinistres en démonstration : liste à colonnes Gestéam filtrable (statut, type, phase, copropriété), formulaire
 * « Déclarer un sinistre » et fiche « Détails » modifiable avec TOUS les champs de la fiche Gestéam, groupés comme
 * Gestéam. En démonstration, rien n'est écrit (toast « Simulation »).
 */

vi.mock('next/dynamic', () => ({
  default: () =>
    function EcranFactice() {
      return null
    },
}))

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await useDonneesStore.getState().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

afterEach(() => {
  cleanup()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

function rendre() {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  render(
    <ToastContext.Provider value={{ push, dismiss: vi.fn() }}>
      <SinistresModule />
    </ToastContext.Provider>,
  )
  return { push }
}

const lignesTableau = () => screen.queryAllByRole('row').slice(1)
const colonne = (index: number) => lignesTableau().map((ligne) => within(ligne).getAllByRole('cell')[index].textContent)
const dialogue = () => screen.getByRole('dialog')
const options = (select: HTMLElement) => Array.from((select as HTMLSelectElement).options).map((option) => option.textContent)
const valeursOptions = (select: HTMLElement) => Array.from((select as HTMLSelectElement).options).map((option) => option.value)
const ouvrirDeclaration = () => fireEvent.click(screen.getByRole('button', { name: /Déclarer un sinistre/ }))
const ouvrirDetails = (numero: string) => {
  const ligne = lignesTableau().find((candidate) => candidate.textContent?.includes(numero))
  fireEvent.click(within(ligne as HTMLElement).getByRole('button', { name: 'Détails' }))
}
const derniersToasts = (push: ReturnType<typeof rendre>['push']) => push.mock.calls.map((appel) => appel[0] as OptionsToast)
/** Champ obligatoire de type date : son libellé porte l'astérisque (aria-hidden) de Field. */
const SURVENANCE = /^Sinistre \(survenance\)/
const resumeErreurs = () => within(dialogue()).getByRole('group', { name: 'Erreurs de la fiche' })
const optionContenant = (select: HTMLElement, texte: string) =>
  Array.from((select as HTMLSelectElement).options).find((option) => option.textContent?.includes(texte))?.value

const BLOCS = [
  'En-tête',
  'Rattachement',
  'Assurance',
  'Qualification',
  'Indemnités',
  'Parties',
  'Suivi',
  'Notes',
  'Responsable et assistant',
]

describe('Sinistres — liste à colonnes Gestéam', () => {
  it('colonnes Date · N° · Type · Copropriété / mandat · Lésés / situation · Phase · Statut · Assureur', () => {
    rendre()
    const entetes = screen.getAllByRole('columnheader').map((entete) => entete.textContent)
    expect(entetes.slice(0, 8)).toEqual([
      'Date',
      'N°',
      'Type',
      'Copropriété / mandat',
      'Lésés / situation',
      'Phase',
      'Statut',
      'Assureur',
    ])
    expect(colonne(1)).toEqual(['CV.00014', 'TL.00009', 'LM.00031'])
    expect(colonne(0)).toEqual(['29/05/2026', '12/04/2026', '18/12/2025'])
    expect(colonne(6)).toEqual(['En cours', 'En cours', 'Terminé'])
    expect(colonne(7)).toEqual(['MMA', 'AXA', 'MMA'])
  })

  it('filtres statut, type et phase cumulables, compteur annoncé', () => {
    rendre()
    fireEvent.change(screen.getByLabelText('Filtrer par statut'), { target: { value: 'Terminé' } })
    expect(colonne(1)).toEqual(['LM.00031'])
    expect(screen.getByText('1 sinistre affiché')).toHaveAttribute('aria-live', 'polite')
    fireEvent.change(screen.getByLabelText('Filtrer par statut'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Filtrer par type'), { target: { value: 'Bris de glace' } })
    expect(colonne(1)).toEqual(['LM.00031'])
    fireEvent.change(screen.getByLabelText('Filtrer par type'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Filtrer par phase'), { target: { value: "Mission d'expertise" } })
    expect(colonne(1)).toEqual(['TL.00009'])
    fireEvent.change(screen.getByLabelText('Filtrer par statut'), { target: { value: 'Terminé' } })
    expect(lignesTableau()).toHaveLength(0)
    expect(screen.getByText('Aucun sinistre ne correspond aux filtres')).toBeInTheDocument()
    expect(screen.getByText('0 sinistre affiché')).toBeInTheDocument()
  })

  it('les listes des filtres reprennent les 19 types, 8 phases et 2 statuts de Gestéam', () => {
    rendre()
    expect(valeursOptions(screen.getByLabelText('Filtrer par type')).slice(1)).toEqual([...TYPE_SINISTRE])
    expect(valeursOptions(screen.getByLabelText('Filtrer par phase')).slice(1)).toEqual([...PHASE_SINISTRE])
    expect(valeursOptions(screen.getByLabelText('Filtrer par statut')).slice(1)).toEqual([...STATUT_SINISTRE])
  })

  it('le filtre copropriété choisit la copropriété dans le sélecteur du haut de page', () => {
    rendre()
    fireEvent.change(screen.getByLabelText('Filtrer par copropriété'), { target: { value: 'TL' } })
    expect(useSelectionDossier.getState().code).toBe('TL')
    expect(colonne(1)).toEqual(['TL.00009'])
    expect(screen.getByLabelText('Filtrer par copropriété')).toHaveValue('TL')
  })
})

describe('Sinistres — « Déclarer un sinistre » : tous les champs de la fiche Gestéam', () => {
  it('les neuf blocs de la fiche Gestéam, dans l’ordre', () => {
    rendre()
    ouvrirDeclaration()
    const regions = within(dialogue())
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-label'))
    expect(regions).toEqual(BLOCS)
  })

  it('listes exactes : 19 types, 8 phases, statut En cours / Terminé ; phase « Général » et statut « En cours » par défaut', () => {
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    expect(valeursOptions(boite.getByRole('combobox', { name: 'Type de sinistre' })).filter(Boolean)).toEqual([...TYPE_SINISTRE])
    // Phase : les 8 phases de Gestéam, précédées de « — Non précisée — » (phase null du domaine).
    expect(valeursOptions(boite.getByLabelText('Phase')).filter(Boolean)).toEqual([...PHASE_SINISTRE])
    expect(options(boite.getByLabelText('Phase'))[0]).toBe('— Non précisée —')
    expect(options(boite.getByLabelText('Statut'))).toEqual([...STATUT_SINISTRE])
    expect(boite.getByLabelText('Phase')).toHaveValue('Général')
    expect(boite.getByLabelText('Statut')).toHaveValue('En cours')
  })

  it('champs essentiels ouverts ; indemnités, parties, suivi, notes et équipe repliables', () => {
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    expect(boite.getByLabelText(SURVENANCE)).toBeInTheDocument()
    expect(boite.getByRole('combobox', { name: 'Copropriété' })).toBeInTheDocument()
    expect(boite.getByRole('combobox', { name: 'Type de sinistre' })).toBeInTheDocument()
    for (const libelle of [
      'N°',
      'Dossier (ouverture)',
      'Mandat',
      'Bail',
      'Compagnie',
      'N° compagnie',
      'Courtier',
      'N° courtier',
      'Contrat',
      'N° du contrat',
      'Parties communes lésées',
      'Parties communes responsables',
      'Origine, cause',
      'Lieu, situation',
      'Dommages',
      'Causes supprimées',
      'Réparations faites',
    ])
      expect(boite.getByLabelText(libelle)).toBeInTheDocument()
    expect(boite.queryByLabelText('Indemnité immédiate')).toBeNull()
    const bouton = boite.getByRole('button', { name: 'Compléter le bloc Indemnités' })
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
    // WCAG 2.5.3 : le nom accessible contient le texte visible du bouton.
    expect(bouton.getAttribute('aria-label')).toContain(bouton.textContent)
    expect(document.getElementById(bouton.getAttribute('aria-controls') as string)).not.toBeNull()
    for (const bloc of ['Indemnités', 'Parties', 'Suivi', 'Notes', 'Responsable et assistant'])
      fireEvent.click(boite.getByRole('button', { name: `Compléter le bloc ${bloc}` }))
    expect(bouton).toHaveAttribute('aria-expanded', 'true')
    expect(bouton).toHaveAccessibleName('Replier le bloc Indemnités')
    expect(bouton.getAttribute('aria-label')).toContain(bouton.textContent)
    for (const libelle of [
      'Indemnité immédiate',
      'Immédiate réglée',
      'Indemnité différée',
      'Différée réglée',
      'Carnet d’entretien',
      'Déclaration',
      'Expertise',
      'Heure d’expertise',
      'Règlement',
      'Forclusion',
      'Rapport',
      'Clos le',
      'Notes du dossier',
      'Responsable',
      'Assistant',
      'Web : fiche publiée sur l’extranet',
    ])
      expect(boite.getByLabelText(libelle)).toBeInTheDocument()
    expect(boite.getByText(/Courriers/)).toBeInTheDocument()
    expect(boite.getByText(/Demandes/)).toBeInTheDocument()
  })

  it('numéro proposé 🔵 (code de la copropriété + rang), copropriété préremplie, mandat de la copropriété', () => {
    useSelectionDossier.setState({ code: 'TL' })
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    expect(boite.getByLabelText('N°')).toHaveValue('TL.00010')
    // Marqueur 🔵 de la proposition, dans l'indication du champ N° (même bloc .field).
    expect(boite.getByLabelText('N°').closest('.field')?.querySelector('.field-hint')?.textContent).toMatch(/^🔵 Proposé/)
    expect(boite.getByRole('combobox', { name: 'Copropriété' })).toHaveValue('Copropriété Les Tilleuls')
    expect((boite.getByLabelText('Mandat') as HTMLSelectElement).selectedOptions[0].textContent).toMatch(/24\/04521/)
    expect(boite.getByLabelText('Mandat').closest('.field')?.querySelector('.field-hint')?.textContent).toMatch(/^🔵 Proposé/)
  })

  it('champs obligatoires exposés (aria-required) ; refus : erreur rattachée au champ (aria-invalid, message)', () => {
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    const type = boite.getByRole('combobox', { name: 'Type de sinistre' })
    const copro = boite.getByRole('combobox', { name: 'Copropriété' })
    const survenance = boite.getByLabelText(SURVENANCE)
    for (const champ of [type, copro, survenance]) expect(champ).toHaveAttribute('aria-required', 'true')
    expect(type).not.toHaveAttribute('aria-invalid')
    fireEvent.click(boite.getByRole('button', { name: 'Enregistrer' }))
    expect(type).toHaveAttribute('aria-invalid', 'true')
    expect(survenance).toHaveAttribute('aria-invalid', 'true')
    expect(copro).not.toHaveAttribute('aria-invalid')
    expect(type.closest('.field')?.querySelector('.field-err')?.textContent).toMatch(/type de sinistre/i)
    fireEvent.change(type, { target: { value: 'Vol' } })
    expect(type).not.toHaveAttribute('aria-invalid')
  })

  it('refus : le résumé des erreurs reçoit le focus (amené à l’écran), sans annonce assertive répétée', () => {
    rendre()
    ouvrirDetails('TL.00009')
    const boite = within(dialogue())
    fireEvent.change(boite.getByLabelText('Clos le'), { target: { value: '2026-04-01' } })
    fireEvent.click(boite.getByRole('button', { name: 'Enregistrer' }))
    const resume = resumeErreurs()
    expect(resume).toHaveFocus()
    expect(resume).not.toHaveAttribute('role', 'alert')
    expect(resume).toHaveAttribute('aria-live', 'polite')
    expect(resume.textContent).toMatch(/Clos le/)
    expect(boite.getByLabelText('Clos le')).toHaveAttribute('aria-invalid', 'true')
  })

  it('changer de contrat remplace la compagnie et la police reprises ; changer de copropriété les efface', () => {
    useSelectionDossier.setState({ code: 'TL' })
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    const contrat = () => boite.getByLabelText('Contrat')
    fireEvent.change(contrat(), { target: { value: optionContenant(contrat(), 'Multirisque') } })
    expect(boite.getByLabelText('Compagnie')).toHaveDisplayValue('Generali')
    expect(boite.getByLabelText('N° du contrat')).toHaveValue('MRI-44120')
    fireEvent.change(contrat(), { target: { value: optionContenant(contrat(), 'Protection juridique') } })
    expect(boite.getByLabelText('Compagnie')).toHaveDisplayValue('MMA')
    expect(boite.getByLabelText('N° du contrat')).toHaveValue('')
    fireEvent.change(boite.getByRole('combobox', { name: 'Copropriété' }), { target: { value: 'Le Clos des Vignes' } })
    expect(contrat()).toHaveValue('')
    expect(boite.getByLabelText('Compagnie')).toHaveDisplayValue('— Non renseigné —')
    expect(boite.getByLabelText('N° du contrat')).toHaveValue('')
  })

  it('compagnie saisie différente de celle du contrat choisi : conservée, point d’attention', () => {
    useSelectionDossier.setState({ code: 'TL' })
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    fireEvent.change(boite.getByRole('combobox', { name: 'Type de sinistre' }), { target: { value: 'Vol' } })
    fireEvent.change(boite.getByLabelText(SURVENANCE), { target: { value: '2026-05-30' } })
    fireEvent.change(boite.getByLabelText('Compagnie'), { target: { value: optionContenant(boite.getByLabelText('Compagnie'), 'AXA') } })
    fireEvent.change(boite.getByLabelText('Contrat'), { target: { value: optionContenant(boite.getByLabelText('Contrat'), 'Multirisque') } })
    expect(boite.getByLabelText('Compagnie')).toHaveDisplayValue('AXA')
    expect(boite.getByText(/Points d’attention/).closest('[aria-live]')?.textContent).toMatch(/AXA.*Generali/)
  })

  it('changer de copropriété repropose le numéro et le mandat ; un numéro saisi est conservé', () => {
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    expect(boite.getByLabelText('N°')).toHaveValue('LM.00032')
    fireEvent.change(boite.getByRole('combobox', { name: 'Copropriété' }), { target: { value: 'Le Clos des Vignes' } })
    expect(boite.getByLabelText('N°')).toHaveValue('CV.00015')
    expect((boite.getByLabelText('Mandat') as HTMLSelectElement).selectedOptions[0].textContent).toMatch(/25\/03517/)
    fireEvent.change(boite.getByLabelText('N°'), { target: { value: 'CV.00099' } })
    fireEvent.change(boite.getByRole('combobox', { name: 'Copropriété' }), { target: { value: 'Villa Montaigne' } })
    expect(boite.getByLabelText('N°')).toHaveValue('CV.00099')
  })

  it('choix dans les données de la démonstration : contrats de la copropriété, compagnies, courtiers et collaborateurs', () => {
    useSelectionDossier.setState({ code: 'TL' })
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    expect(options(boite.getByLabelText('Contrat')).join(' | ')).toMatch(/Dommages-ouvrage/)
    expect(options(boite.getByLabelText('Compagnie'))).toEqual(
      expect.arrayContaining(['Generali', 'AXA', 'SMABTP', 'MMA', 'Saisie libre…']),
    )
    expect(options(boite.getByLabelText('Courtier'))).toContain('Saisie libre…')
    fireEvent.click(boite.getByRole('button', { name: 'Compléter le bloc Responsable et assistant' }))
    expect(options(boite.getByLabelText('Responsable')).join(' | ')).toMatch(/Awa Diallo/)
  })

  it('choisir un contrat reprend la compagnie et le n° de police ; « Saisie libre… » ouvre un champ marqué', () => {
    useSelectionDossier.setState({ code: 'TL' })
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    const contrat = boite.getByLabelText('Contrat') as HTMLSelectElement
    const multirisque = Array.from(contrat.options).find((option) => option.textContent?.includes('Multirisque'))
    fireEvent.change(contrat, { target: { value: multirisque?.value } })
    expect(boite.getByLabelText('Compagnie')).toHaveDisplayValue('Generali')
    expect(boite.getByLabelText('N° du contrat')).toHaveValue('MRI-44120')
    fireEvent.change(boite.getByLabelText('Courtier'), { target: { value: '__libre__' } })
    fireEvent.change(boite.getByLabelText('Courtier (saisie libre)'), { target: { value: 'Courtier hors annuaire' } })
    expect(boite.getByLabelText('Courtier (saisie libre)')).toHaveValue('Courtier hors annuaire')
  })

  it('refuse une déclaration incomplète : résumé des erreurs, erreurs des champs annoncées (role="alert"), rien n’est simulé', () => {
    const { push } = rendre()
    ouvrirDeclaration()
    fireEvent.click(within(dialogue()).getByRole('button', { name: 'Enregistrer' }))
    const resume = resumeErreurs()
    expect(resume.textContent).toMatch(/type de sinistre/i)
    expect(resume.textContent).toMatch(/survenance/i)
    const annonces = within(dialogue())
      .getAllByRole('alert')
      .map((alerte) => alerte.textContent)
      .join(' ')
    expect(annonces).toMatch(/type de sinistre/i)
    expect(annonces).toMatch(/survenance/i)
    expect(push).not.toHaveBeenCalled()
  })

  it('statut « Terminé » sans « Clos le » : refusé', () => {
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    fireEvent.change(boite.getByRole('combobox', { name: 'Type de sinistre' }), { target: { value: 'Vol' } })
    fireEvent.change(boite.getByLabelText(SURVENANCE), { target: { value: '2026-05-30' } })
    fireEvent.change(boite.getByLabelText('Statut'), { target: { value: 'Terminé' } })
    fireEvent.click(boite.getByRole('button', { name: 'Enregistrer' }))
    expect(resumeErreurs().textContent).toMatch(/Clos le/)
    expect(boite.getByLabelText('Statut')).toHaveAttribute('aria-invalid', 'true')
  })

  it('montant illisible refusé ; montant en euros accepté', async () => {
    const { push } = rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    fireEvent.change(boite.getByRole('combobox', { name: 'Type de sinistre' }), { target: { value: 'Vol' } })
    fireEvent.change(boite.getByLabelText(SURVENANCE), { target: { value: '2026-05-30' } })
    fireEvent.click(boite.getByRole('button', { name: 'Compléter le bloc Indemnités' }))
    fireEvent.change(boite.getByLabelText('Indemnité immédiate'), { target: { value: '12,345' } })
    fireEvent.click(boite.getByRole('button', { name: 'Enregistrer' }))
    expect(resumeErreurs().textContent).toMatch(/indemnité immédiate/i)
    expect(boite.getByLabelText('Indemnité immédiate')).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(boite.getByLabelText('Indemnité immédiate'), { target: { value: '1 240,50' } })
    await act(async () => {
      fireEvent.click(boite.getByRole('button', { name: 'Enregistrer' }))
    })
    expect(derniersToasts(push).at(-1)?.title).toBe('Simulation')
  })

  it('forclusion : suggestion 🔵 à confirmer, jamais recopiée d’office ; « Reprendre la suggestion » la reporte', () => {
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    fireEvent.change(boite.getByLabelText(SURVENANCE), { target: { value: '2026-05-29' } })
    fireEvent.click(boite.getByRole('button', { name: 'Compléter le bloc Suivi' }))
    expect(boite.getByLabelText('Forclusion')).toHaveValue('')
    expect(boite.getByText(/🔵 Suggestion : 29\/05\/2028/)).toBeInTheDocument()
    expect(boite.getByText(/L\. 114-1/, { selector: 'p' })).toBeInTheDocument()
    fireEvent.click(boite.getByRole('button', { name: 'Reprendre la suggestion' }))
    expect(boite.getByLabelText('Forclusion')).toHaveValue('2028-05-29')
  })

  it('parties : ajout d’une partie (rôle, nature, fiche ou saisie libre) puis retrait', () => {
    useSelectionDossier.setState({ code: 'TL' })
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    fireEvent.click(boite.getByRole('button', { name: 'Compléter le bloc Parties' }))
    fireEvent.change(boite.getByLabelText('Rôle de la partie'), { target: { value: 'Lésé' } })
    fireEvent.change(boite.getByLabelText('Nature de la partie'), { target: { value: 'Immeuble' } })
    fireEvent.click(boite.getByRole('button', { name: 'Ajouter la partie' }))
    // Ligne de la liste des parties (l'annonce aria-live répète le même texte).
    expect(boite.getByText(/Lésé · Immeuble · Copropriété Les Tilleuls/, { selector: 'li > span' })).toBeInTheDocument()
    fireEvent.change(boite.getByLabelText('Nature de la partie'), { target: { value: 'Personne' } })
    fireEvent.change(boite.getByLabelText('Partie'), { target: { value: '__libre__' } })
    fireEvent.change(boite.getByLabelText('Partie (saisie libre)'), { target: { value: 'Voisin du dessous' } })
    fireEvent.change(boite.getByLabelText('Rôle de la partie'), { target: { value: 'Responsable' } })
    fireEvent.click(boite.getByRole('button', { name: 'Ajouter la partie' }))
    expect(
      boite.getByText(/Responsable · Personne · Voisin du dessous \(saisie libre\)/, { selector: 'li > span' }),
    ).toBeInTheDocument()
    fireEvent.click(boite.getByRole('button', { name: 'Retirer la partie Copropriété Les Tilleuls' }))
    expect(boite.queryByText(/Lésé · Immeuble/, { selector: 'li > span' })).toBeNull()
    expect(boite.getByText(/Partie retirée : Lésé · Immeuble/)).toBeInTheDocument()
  })

  it('parties : après un changement de copropriété (bloc ouvert), la partie proposée est celle de la nouvelle copropriété', () => {
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    fireEvent.click(boite.getByRole('button', { name: 'Compléter le bloc Parties' }))
    expect(boite.getByLabelText('Partie')).toHaveDisplayValue('Résidence Le Méridien')
    fireEvent.change(boite.getByRole('combobox', { name: 'Copropriété' }), { target: { value: 'Le Clos des Vignes' } })
    expect(boite.getByLabelText('Partie')).toHaveDisplayValue('Le Clos des Vignes')
    expect(boite.queryByLabelText('Partie (saisie libre)')).toBeNull()
    fireEvent.click(boite.getByRole('button', { name: 'Ajouter la partie' }))
    expect(boite.getByText('Lésé · Immeuble · Le Clos des Vignes', { selector: 'li > span' })).toBeInTheDocument()
    expect(boite.queryByText(/Résidence Le Méridien/, { selector: 'li > span' })).toBeNull()
  })

  it('parties : une partie de l’ancienne copropriété, restée sur la fiche, est signalée (point d’attention)', () => {
    rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    fireEvent.change(boite.getByRole('combobox', { name: 'Type de sinistre' }), { target: { value: 'Vol' } })
    fireEvent.change(boite.getByLabelText(SURVENANCE), { target: { value: '2026-05-30' } })
    fireEvent.click(boite.getByRole('button', { name: 'Compléter le bloc Parties' }))
    fireEvent.click(boite.getByRole('button', { name: 'Ajouter la partie' }))
    expect(boite.queryByText(/Points d’attention/)).toBeNull()
    fireEvent.change(boite.getByRole('combobox', { name: 'Copropriété' }), { target: { value: 'Le Clos des Vignes' } })
    expect(boite.getByText(/Points d’attention/).closest('[aria-live]')?.textContent).toMatch(
      /Résidence Le Méridien.*autre copropriété/,
    )
  })

  it('en démonstration, l’enregistrement est simulé : toast « Simulation », aucune ligne écrite', async () => {
    const { push } = rendre()
    ouvrirDeclaration()
    const boite = within(dialogue())
    fireEvent.change(boite.getByRole('combobox', { name: 'Type de sinistre' }), { target: { value: 'Incendie' } })
    fireEvent.change(boite.getByLabelText(SURVENANCE), { target: { value: '2026-06-01' } })
    await act(async () => {
      fireEvent.click(boite.getByRole('button', { name: 'Enregistrer' }))
    })
    const toast = derniersToasts(push).at(-1)
    expect(toast?.title).toBe('Simulation')
    expect(String(toast?.desc)).toMatch(/rien n.est enregistré en démonstration/i)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await ajDb.sinistres.count()).toBe(0)
    expect(lignesTableau()).toHaveLength(3)
  })
})

describe('Sinistres — « Détails » : fiche complète, modifiable', () => {
  it('ouvre la fiche pré-remplie, tous les blocs dépliés et modifiables', () => {
    rendre()
    ouvrirDetails('TL.00009')
    const boite = within(dialogue())
    expect(boite.getByRole('heading', { level: 2 }).textContent).toMatch(/TL\.00009/)
    expect(boite.getByLabelText('N°')).toHaveValue('TL.00009')
    expect(boite.getByRole('combobox', { name: 'Type de sinistre' })).toHaveValue('Dégât des eaux')
    expect(boite.getByLabelText('Phase')).toHaveValue("Mission d'expertise")
    expect(boite.getByRole('combobox', { name: 'Copropriété' })).toHaveValue('Copropriété Les Tilleuls')
    expect(boite.getByLabelText('Compagnie')).toHaveDisplayValue('AXA')
    expect(boite.getByLabelText('Origine, cause')).toHaveValue('Infiltration toiture')
    expect(boite.getByLabelText('Parties communes lésées')).toBeChecked()
    expect(boite.getByLabelText('Expertise')).toHaveValue('2026-06-18')
    expect(boite.getByLabelText('Heure d’expertise')).toHaveValue('10:00')
    expect(boite.queryByRole('button', { name: /^Compléter le bloc/ })).toBeNull()
    fireEvent.change(boite.getByLabelText('Origine, cause'), { target: { value: 'Infiltration en toiture-terrasse' } })
    expect(boite.getByLabelText('Origine, cause')).toHaveValue('Infiltration en toiture-terrasse')
  })

  it('une fiche close affiche le statut « Terminé » et ses indemnités réglées', () => {
    rendre()
    ouvrirDetails('LM.00031')
    const boite = within(dialogue())
    expect(boite.getByLabelText('Statut')).toHaveValue('Terminé')
    expect(boite.getByLabelText('Clos le')).toHaveValue('2026-03-02')
    expect(boite.getByLabelText('Indemnité immédiate')).toHaveValue('1240,00')
    expect(boite.getByLabelText('Immédiate réglée')).toBeChecked()
  })

  it('en démonstration, la modification est simulée : rien n’est écrit', async () => {
    const { push } = rendre()
    ouvrirDetails('CV.00014')
    await act(async () => {
      fireEvent.click(within(dialogue()).getByRole('button', { name: 'Enregistrer' }))
    })
    expect(derniersToasts(push).at(-1)?.title).toBe('Simulation')
    expect(await ajDb.sinistres.count()).toBe(0)
  })
})

describe('Sinistres — registre des écrans', () => {
  it('l’écran enregistre en mode données réelles : statut « reel »', () => {
    expect(statutEcran('sinistres', 'reel')).toBe('reel')
  })

  it('en démonstration, rien n’est écrit : statut « demo » (pastille « Démonstration », comme avant le branchement)', () => {
    expect(statutEcran('sinistres', 'demo')).toBe('demo')
    // Mode lu au chargement : démonstration dans ce fichier.
    expect(statutEcran('sinistres')).toBe('demo')
  })

  it('les autres écrans branchés gardent leur statut dans les deux modes (ils enregistrent aussi en démonstration)', () => {
    for (const mode of ['demo', 'reel'] as const) {
      expect(statutEcran('copros', mode)).toBe('reel')
      expect(statutEcran('prestataires', mode)).toBe('reel')
      expect(statutEcran('dashboard', mode)).toBe('partiel')
      expect(statutEcran('inconnu', mode)).toBe('demo')
    }
  })

  it('en démonstration, l’écran dit lui-même que l’enregistrement est simulé, comme la pastille du Shell', () => {
    rendre()
    expect(screen.getByText('Démonstration : enregistrement simulé')).toBeInTheDocument()
    expect(screen.getByText(/rien n’est écrit/)).toBeInTheDocument()
  })
})

describe('Sinistres — cohérence de la démonstration', () => {
  it('la notification « Sinistre déclaré » cite le n° du sinistre tel que la liste l’affiche (CV.00014)', () => {
    const notification = DEMO_NOTIFICATIONS.find((candidate) => candidate.id === 'n05')
    expect(notification?.desc).toContain('CV.00014')
    expect(notification?.desc).not.toMatch(/SIN-2026/)
    expect(DEMO_SINISTRES.find((sinistre) => sinistre.numero === 'CV.00014')?.coproprieteId).toBe('C2')
  })
})
