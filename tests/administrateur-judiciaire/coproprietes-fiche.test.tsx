import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { FICHES_COPROPRIETES_DEMO } from '@/components/administrateur-judiciaire/data/coproprietes'
import { CoproprietesModule } from '@/components/administrateur-judiciaire/modules/patrimoine/CoproprietesModule'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/**
 * Copropriétés : fiche détaillée sur le modèle de la fiche Mandat de Gestéam (mandat et ordonnance, syndicat, lots,
 * équipe, entreprises de l'immeuble, clés, exercices, conseil syndical, finances, notes), demande de Hugo du
 * 29/10/2026. Données de démonstration fictives.
 */

const etat = () => useDonneesStore.getState()

async function reinitialiser(): Promise<void> {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await etat().loadAll()
}

async function monter() {
  await act(async () => {
    render(
      <ToastProvider>
        <CoproprietesModule />
      </ToastProvider>,
    )
  })
  await waitFor(() => expect(screen.queryByText('Chargement…')).toBeNull())
}

function ouvrirFiche(nom: string): HTMLElement {
  const carte = screen.getByText(nom, { selector: '.entity-card__title' }).closest('.panel') as HTMLElement
  fireEvent.click(within(carte).getByRole('button', { name: 'Détails' }))
  return screen.getByRole('dialog', { name: nom })
}

const valeurSous = (fiche: HTMLElement, libelle: string) => within(fiche).getByText(libelle).nextElementSibling?.textContent
const bloc = (fiche: HTMLElement, nom: string) => within(fiche).getByRole('region', { name: nom })
const ligne = (region: HTMLElement, debut: string) => within(region).getByText(debut).closest('tr') as HTMLElement

describe('Copropriétés — fiche détaillée', () => {
  beforeEach(reinitialiser)

  it('affiche les blocs de la fiche Mandat de Gestéam', async () => {
    await monter()
    const fiche = ouvrirFiche('Résidence Le Méridien')
    for (const nom of [
      'Mandat et ordonnance',
      'Syndicat et immatriculation',
      'Lots',
      'Équipe du mandat',
      "Entreprises de l'immeuble",
      'Clés de répartition',
      'Exercices',
      'Conseil syndical et assemblées',
      'Finances et honoraires',
      'Notes et avertissement',
    ])
      expect(bloc(fiche, nom)).toBeInTheDocument()
    expect(
      within(fiche).getByText('Mandat M012 · Syndic judiciaire (art. 46) · Mandant : syndicat des copropriétaires'),
    ).toBeInTheDocument()
    expect(valeurSous(fiche, 'Tribunal')).toBe('TJ Nanterre')
    expect(valeurSous(fiche, "N° d'immatriculation")).toBe('AC1 234 567')
    expect(valeurSous(fiche, 'Habitation')).toBe('32')
  })

  it('liste les entreprises de l’immeuble avec leur contrat', async () => {
    await monter()
    const entreprises = bloc(ouvrirFiche('Résidence Le Méridien'), "Entreprises de l'immeuble")
    expect(within(ligne(entreprises, 'OTIS Maintenance')).getByText('Contrat cadre')).toBeInTheDocument()
    expect(within(ligne(entreprises, 'Atlantic Plomberie SARL')).getByText('Sur demande')).toBeInTheDocument()
    // Une entreprise qui n'intervient pas dans cet immeuble n'y figure pas.
    expect(within(entreprises).queryByText('Couverture Île-de-France')).toBeNull()
  })

  it('montre la clé principale, les exercices et la fin du mandat du conseil syndical', async () => {
    await monter()
    const fiche = ouvrirFiche('Résidence Le Méridien')
    expect(within(bloc(fiche, 'Clés de répartition')).getByText('Charges communes générales (principale)')).toBeInTheDocument()
    expect(within(ligne(bloc(fiche, 'Exercices'), '2025')).getByText('Voté')).toBeInTheDocument()
    expect(valeurSous(fiche, 'Pour / fin')).toBe('12 mois · 18/04/2027')
    expect(valeurSous(fiche, 'AG en visioconférence')).toBe('Acceptée')
  })

  it('l’avertissement s’affiche en tête de la fiche', async () => {
    await monter()
    const fiche = ouvrirFiche('Résidence Le Méridien')
    const avertissement = FICHES_COPROPRIETES_DEMO.LM.avertissement as string
    expect(within(fiche).getAllByText(avertissement)).toHaveLength(2)
  })

  it('« Modifier la fiche » enregistre l’immatriculation et les notes dans la base, sans perdre le reste', async () => {
    await monter()
    fireEvent.click(within(ouvrirFiche('Résidence Le Méridien')).getByRole('button', { name: /Modifier la fiche/ }))
    const formulaire = screen.getByRole('dialog', { name: 'Modifier Résidence Le Méridien' })
    expect(within(formulaire).getByLabelText("N° d'immatriculation")).toHaveValue('AC1 234 567')
    fireEvent.change(within(formulaire).getByLabelText("N° d'immatriculation"), { target: { value: 'AC9 999 999' } })
    fireEvent.change(within(formulaire).getByLabelText('Notes'), { target: { value: 'Visite trimestrielle.' } })
    await act(async () => {
      fireEvent.click(within(formulaire).getByRole('button', { name: /Enregistrer/ }))
    })
    await waitFor(async () => {
      const enregistree = (await ajDb.coproprietes.toArray()).find((copro) => copro.code === 'LM')
      expect(enregistree?.fiche?.immatriculation).toBe('AC9 999 999')
    })
    const enregistree = (await ajDb.coproprietes.toArray()).find((copro) => copro.code === 'LM')
    expect(enregistree?.fiche?.notes).toBe('Visite trimestrielle.')
    expect(enregistree?.fiche?.cles).toEqual(FICHES_COPROPRIETES_DEMO.LM.cles)
    // Le store est mis à jour après l'écriture du mandat.
    await waitFor(() =>
      expect(etat().coproprietes.find((copro) => copro.code === 'LM')?.fiche?.immatriculation).toBe('AC9 999 999'),
    )

    const fiche = ouvrirFiche('Résidence Le Méridien')
    expect(valeurSous(fiche, "N° d'immatriculation")).toBe('AC9 999 999')
  })

  it('une copropriété sans fiche détaillée garde une fiche lisible', async () => {
    await act(async () => {
      await etat().createCopropriete({ nom: 'Résidence Nouvelle', adresse: '1 rue Neuve', nbLots: 10, rg: '26/09999', fondement: 'ap291' })
    })
    await monter()
    const fiche = ouvrirFiche('Résidence Nouvelle')
    expect(within(fiche).getByText('Aucune clé enregistrée.')).toBeInTheDocument()
    expect(within(fiche).getByText('Aucun exercice enregistré.')).toBeInTheDocument()
    expect(valeurSous(fiche, 'Lots principaux')).toBe('10')
  })
})
