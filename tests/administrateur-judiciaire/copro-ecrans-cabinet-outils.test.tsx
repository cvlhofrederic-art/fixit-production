import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_DOSSIERS_SUIVI } from '@/components/administrateur-judiciaire/data/suivi-dossiers'
import { CircuitValidationModule } from '@/components/administrateur-judiciaire/modules/cabinet/CircuitValidationModule'
import { SuiviDossiersModule } from '@/components/administrateur-judiciaire/modules/cabinet/SuiviDossiersModule'
import { CommunicationDigitaleModule } from '@/components/administrateur-judiciaire/modules/outils-ia/CommunicationDigitaleModule'
import { RedactionPvModule } from '@/components/administrateur-judiciaire/modules/outils-ia/RedactionPvModule'
import { SignatureElectroniqueModule } from '@/components/administrateur-judiciaire/modules/outils-ia/SignatureElectroniqueModule'
import { Fiche360PersonneModule } from '@/components/administrateur-judiciaire/modules/pilotage/Fiche360PersonneModule'
import { RapportMensuelModule } from '@/components/administrateur-judiciaire/modules/technique/RapportMensuelModule'
import { ToastContext, type OptionsDocument, type OptionsFormulaire, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Lot « gestion » du sélecteur de copropriété du haut de page (suite) : Fiche 360 personne, Suivi des dossiers,
 * Circuit de validation, Rapport mensuel (route « ppt »), Rédaction de PV, Signature électronique et Communication
 * digitale s'affichent selon la copropriété choisie et la suivent sans remontage. Sans copropriété choisie (écran
 * rendu seul), chaque écran garde son comportement d'avant.
 */

const etat = () => useDonneesStore.getState()

/** Base vidée, mode démo, jeu de démonstration inséré, store rechargé, sélection remise à zéro. */
async function reinitialiser(): Promise<void> {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await etat().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
}

/** Copropriété ajoutée à la base, sans aucune donnée de démonstration rattachée : code attribué par la base. */
async function creerCoproVide(): Promise<string> {
  let code = ''
  await act(async () => {
    const copro = await etat().createCopropriete({
      nom: 'Résidence Les Acacias',
      adresse: '2 allée des Acacias',
      nbLots: 12,
      rg: '26/04444',
      fondement: 'sj',
    })
    code = copro.code
  })
  return code
}

/** Choisit la copropriété dans le sélecteur du haut de page (sans remonter l'écran). */
const choisir = (code: string | null) => act(() => useSelectionDossier.getState().choisirCopro(code))

/** Rend l'écran sous un fournisseur de toasts espion. */
function rendre(element: ReactElement) {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  render(<ToastContext.Provider value={{ push, dismiss: vi.fn() }}>{element}</ToastContext.Provider>)
  return { push }
}

/** Nombre affiché par l'indicateur de ce libellé. */
const indicateur = (libelle: string) =>
  Array.from(document.querySelectorAll('.kpi'))
    .find((carte) => carte.querySelector('.lbl')?.textContent === libelle)
    ?.querySelector('.num')?.textContent

/** Textes en gras des lignes du tableau du panneau de ce titre (en-tête exclu). */
const lignesDuPanneau = (titre: string) =>
  within(screen.getByText(titre).closest('.panel') as HTMLElement)
    .queryAllByRole('row')
    .slice(1)
    .map((ligne) => ligne.querySelector('b')?.textContent)

const titrePage = () => screen.getByRole('heading', { level: 1 }).textContent

beforeEach(async () => {
  await reinitialiser()
})

afterEach(() => {
  vi.unstubAllGlobals()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

describe('Fiche 360 personne — selon la copropriété choisie', () => {
  const optionsPersonnes = () =>
    Array.from((screen.getByLabelText('Personne') as HTMLSelectElement).options).map((option) => option.textContent)

  it('sans copropriété choisie : toutes les personnes, fiche du premier copropriétaire de la base, comme avant', async () => {
    rendre(<Fiche360PersonneModule />)
    await waitFor(() => expect(titrePage()).toBe(etat().coproprietaires[0].nom))
    expect(optionsPersonnes()).toHaveLength(etat().coproprietaires.length)
  })

  it('copropriété choisie : ses copropriétaires seulement ; la fiche suit la copropriété et la personne choisies', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    rendre(<Fiche360PersonneModule />)
    await waitFor(() => expect(titrePage()).toBe('Antoine Rousseau'))
    expect(optionsPersonnes()).toEqual(['Antoine Rousseau · Copropriété Les Tilleuls', 'SCI Belvédère · Copropriété Les Tilleuls'])
    fireEvent.change(screen.getByLabelText('Personne'), {
      target: { value: etat().coproprietaires.find((personne) => personne.nom === 'SCI Belvédère')?.id },
    })
    expect(titrePage()).toBe('SCI Belvédère')
    // La personne choisie n'a pas de lot dans la nouvelle copropriété : premier copropriétaire de celle-ci.
    choisir('VM')
    expect(titrePage()).toBe('Hélène Dubois')
    expect(optionsPersonnes()).toEqual(['Hélène Dubois · Villa Montaigne'])
  })

  it('copropriété sans copropriétaire : « Aucun copropriétaire pour … »', async () => {
    const code = await creerCoproVide()
    useSelectionDossier.setState({ code })
    rendre(<Fiche360PersonneModule />)
    await waitFor(() => expect(screen.queryByText('Aucun copropriétaire pour Résidence Les Acacias.')).not.toBeNull())
  })
})

describe('Suivi des dossiers — selon la copropriété choisie', () => {
  const dossiers = () => lignesDuPanneau('Suivi du temps par dossier')

  it('sans copropriété choisie : les quatre dossiers, comme avant', () => {
    rendre(<SuiviDossiersModule />)
    expect(dossiers()).toHaveLength(4)
    expect(indicateur('Gestionnaires actifs')).toBe(String(new Set(DEMO_DOSSIERS_SUIVI.map((dossier) => dossier.gest)).size))
  })

  it('copropriété choisie : son dossier, ses alertes et ses indicateurs ; le chronomètre survit au changement', () => {
    useSelectionDossier.setState({ code: 'LM' })
    rendre(<SuiviDossiersModule />)
    expect(dossiers()).toEqual(['Résidence Le Méridien'])
    expect(indicateur('Gestionnaires actifs')).toBe('1')
    expect(indicateur('Temps dossiers (mois)')).toBe(indicateur('Temps moyen / dossier'))
    for (const alerte of Array.from(document.querySelectorAll('.alert'))) expect(alerte.textContent).toContain('Résidence Le Méridien')
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer' }))
    choisir('CV')
    expect(dossiers()).toEqual(['Le Clos des Vignes'])
    expect(screen.queryByRole('button', { name: 'Arrêter' })).toBeNull()
    choisir('LM')
    expect(screen.queryByRole('button', { name: 'Arrêter' })).not.toBeNull()
  })

  it('copropriété sans dossier suivi : état vide nommé, indicateurs à zéro', async () => {
    const code = await creerCoproVide()
    useSelectionDossier.setState({ code })
    rendre(<SuiviDossiersModule />)
    expect(screen.queryByText('Aucun dossier suivi pour Résidence Les Acacias')).not.toBeNull()
    expect(indicateur('Dossiers en retard')).toBe('0')
    expect(indicateur('Temps moyen / dossier')).not.toContain('NaN')
  })
})

describe('Circuit de validation — selon la copropriété choisie', () => {
  const actes = () => lignesDuPanneau('File de validation')

  it('sans copropriété choisie : les six actes, comme avant', () => {
    rendre(<CircuitValidationModule />)
    expect(actes()).toHaveLength(6)
    expect(indicateur('Actes au circuit')).toBe('6')
  })

  it('copropriété choisie : ses actes et ses indicateurs, mis à jour à chaque changement', () => {
    useSelectionDossier.setState({ code: 'TL' })
    rendre(<CircuitValidationModule />)
    expect(actes()).toEqual([
      'Requête en prorogation — Les Tilleuls',
      'Mise en demeure — SCI Belvédère',
      'Rapport intermédiaire art. 29-1 — Les Tilleuls',
    ])
    expect(indicateur('À vérifier')).toBe('2')
    expect(indicateur('À valider & signer')).toBe('1')
    expect(indicateur('Validés')).toBe('0')
    expect(indicateur('Actes au circuit')).toBe('3')
    choisir('VM')
    expect(actes()).toEqual(["Notification d'ordonnance — Villa Montaigne"])
    expect(indicateur('Validés')).toBe('1')
  })

  it('copropriété sans acte : « Aucun acte au circuit pour … »', async () => {
    const code = await creerCoproVide()
    useSelectionDossier.setState({ code })
    rendre(<CircuitValidationModule />)
    expect(screen.queryByText('Aucun acte au circuit pour Résidence Les Acacias')).not.toBeNull()
    expect(indicateur('Actes au circuit')).toBe('0')
  })
})

describe('Rapport mensuel (route « ppt ») — selon la copropriété choisie', () => {
  const titreApercu = () => screen.getByText(/^Rapport mensuel — /).textContent

  /** Document produit par « Générer le rapport ». */
  function generer(push: ReturnType<typeof rendre>['push']): OptionsDocument {
    fireEvent.click(screen.getByRole('button', { name: /Générer le rapport/ }))
    return push.mock.calls.at(-1)?.[0] as OptionsDocument
  }

  it('sans copropriété choisie : sélecteur local et rapport cumulé, comme avant', () => {
    const { push } = rendre(<RapportMensuelModule />)
    expect(titreApercu()).toBe('Rapport mensuel — Résidence Le Méridien')
    fireEvent.change(screen.getByLabelText('Copropriété'), { target: { value: 'Villa Montaigne' } })
    expect(titreApercu()).toBe('Rapport mensuel — Villa Montaigne')
    expect(useSelectionDossier.getState().code).toBeNull()
    const document = generer(push)
    expect(document.meta).toBe('Période : mai 2026 · 4 copropriétés')
    expect(document.lines).toContainEqual({ k: 'Budget voté', v: '490 000 €' })
  })

  it('copropriété choisie : aperçu et rapport de cette seule copropriété ; le sélecteur choisit partout', () => {
    useSelectionDossier.setState({ code: 'TL' })
    const { push } = rendre(<RapportMensuelModule />)
    expect(titreApercu()).toBe('Rapport mensuel — Copropriété Les Tilleuls')
    const document = generer(push)
    expect(document.meta).toBe('Période : mai 2026 · Copropriété Les Tilleuls')
    expect(document.lines).toContainEqual({ k: 'Budget voté', v: formatEuros(96000) })
    expect(document.lines).toContainEqual({ k: 'Dépenses', v: formatEuros(88200) })
    expect(document.lines).toContainEqual({ k: 'Impayés', v: formatEuros(34800) })
    expect(document.lines).toContainEqual({ li: 'Les Tilleuls : étanchéité toiture en cours' })
    expect(JSON.stringify(document.lines)).not.toContain('Le Méridien')
    fireEvent.change(screen.getByLabelText('Copropriété'), { target: { value: 'Le Clos des Vignes' } })
    expect(useSelectionDossier.getState().code).toBe('CV')
    expect(titreApercu()).toBe('Rapport mensuel — Le Clos des Vignes')
    expect(generer(push).lines).toContainEqual({ li: 'Aucun fait marquant ce mois-ci' })
  })
})

describe('Rédaction de PV — selon la copropriété choisie', () => {
  const trame = () => document.querySelector('pre')?.textContent ?? ''

  it('sans copropriété choisie : sélecteur local, comme avant', () => {
    rendre(<RedactionPvModule />)
    expect(trame()).toContain('Résidence Le Méridien')
    fireEvent.change(screen.getByLabelText('Copropriété'), { target: { value: 'Le Clos des Vignes' } })
    expect(trame()).toContain('Le Clos des Vignes')
    expect(useSelectionDossier.getState().code).toBeNull()
  })

  it('copropriété choisie : la trame suit la sélection ; le sélecteur choisit partout', () => {
    useSelectionDossier.setState({ code: 'VM' })
    rendre(<RedactionPvModule />)
    expect(screen.getByLabelText('Copropriété')).toHaveValue('Villa Montaigne')
    expect(trame()).toContain('Villa Montaigne')
    choisir('TL')
    expect(trame()).toContain('Copropriété Les Tilleuls')
    fireEvent.change(screen.getByLabelText('Copropriété'), { target: { value: 'Le Clos des Vignes' } })
    expect(useSelectionDossier.getState().code).toBe('CV')
    expect(trame()).toContain('Le Clos des Vignes')
  })
})

// Copropriété de la base absente des noms de démonstration : son nom est ajouté aux options du select, qui l'affiche
// au lieu de retomber sur la première option (« Résidence Le Méridien »).
describe('Rapport mensuel et Rédaction de PV — copropriété créée dans la base', () => {
  it.each([
    ['Rapport mensuel', <RapportMensuelModule key="rapport" />],
    ['Rédaction de PV', <RedactionPvModule key="pv" />],
  ])('%s : le select « Copropriété » affiche la copropriété choisie', async (_ecran, ecran) => {
    const code = await creerCoproVide()
    useSelectionDossier.setState({ code })
    rendre(ecran)
    const select = screen.getByLabelText<HTMLSelectElement>('Copropriété')
    expect(select.value).toBe('Résidence Les Acacias')
    expect(select.options[select.selectedIndex]?.text).toBe('Résidence Les Acacias')
  })
})

describe('Signature électronique — selon la copropriété choisie', () => {
  const documents = () =>
    Array.from(document.querySelectorAll('.card-grid > div')).map((carte) => carte.firstElementChild?.firstElementChild?.textContent)

  it('sans copropriété choisie : les quatre documents, comme avant', () => {
    const { push } = rendre(<SignatureElectroniqueModule />)
    expect(documents()).toHaveLength(4)
    expect(indicateur('Documents')).toBe('4')
    fireEvent.click(screen.getByRole('button', { name: /Envoyer à signer/ }))
    const formulaire = push.mock.calls[0][0] as OptionsFormulaire
    expect(formulaire.fields?.map((champ) => champ.label)).toEqual(['Document', 'Signataire', 'Mode'])
  })

  it('copropriété choisie : ses documents, ses indicateurs, formulaire prérempli ; état vide nommé', () => {
    useSelectionDossier.setState({ code: 'TL' })
    const { push } = rendre(<SignatureElectroniqueModule />)
    expect(documents()).toEqual(['Devis travaux toiture', 'Mandat de prélèvement'])
    expect(indicateur('Documents')).toBe('2')
    expect(indicateur('Signés')).toBe('1')
    expect(indicateur('En attente')).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: /Envoyer à signer/ }))
    const formulaire = push.mock.calls[0][0] as OptionsFormulaire
    expect(formulaire.fields?.[0]).toMatchObject({ label: 'Copropriété', value: 'Copropriété Les Tilleuls' })
    choisir('CV')
    expect(documents()).toEqual([])
    expect(screen.queryByText('Aucun document en signature pour Le Clos des Vignes')).not.toBeNull()
    expect(indicateur('Documents')).toBe('0')
  })
})

describe('Communication digitale — selon la copropriété choisie', () => {
  const messages = () => lignesDuPanneau('Messages')

  it('sans copropriété choisie : les quatre messages et les indicateurs de la maquette, comme avant', () => {
    rendre(<CommunicationDigitaleModule />)
    expect(messages()).toHaveLength(4)
    expect(indicateur('Total envoyés')).toBe('6')
  })

  it('copropriété choisie : ses messages, indicateurs calculés, formulaire prérempli ; état vide nommé', () => {
    useSelectionDossier.setState({ code: 'TL' })
    const { push } = rendre(<CommunicationDigitaleModule />)
    expect(messages()).toEqual(['Demande de devis', 'Relance impayé'])
    expect(indicateur('Total envoyés')).toBe('2')
    expect(indicateur('En attente')).toBe('1')
    expect(indicateur('Distribués')).toBe('1')
    expect(indicateur('Lus')).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: /Nouveau message/ }))
    const formulaire = push.mock.calls[0][0] as OptionsFormulaire
    expect(formulaire.fields?.[0]).toMatchObject({ label: 'Copropriété', value: 'Copropriété Les Tilleuls' })
    choisir('VM')
    expect(messages()).toEqual([])
    expect(screen.queryByText('Aucun message pour Villa Montaigne')).not.toBeNull()
    expect(indicateur('Total envoyés')).toBe('0')
  })
})
