import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { FICHES_PRESTATAIRES_DEMO } from '@/components/administrateur-judiciaire/data/prestataires'
import { PrestatairesModule } from '@/components/administrateur-judiciaire/modules/patrimoine/Prestataires'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { repoPrestataires } from '@/lib/administrateur-judiciaire/db/repositories'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/**
 * Prestataires : fiche détaillée sur le modèle de la fiche Entreprise de Gestéam (identité, contacts, télécoms,
 * assurances et vigilance, compétences, règlement, relances, demandes, notes et extranet), demande de Hugo du
 * 29/10/2026. Données de démonstration fictives ; date de démonstration : 04/06/2026.
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
        <PrestatairesModule />
      </ToastProvider>,
    )
  })
  await waitFor(() => expect(screen.queryByText('Chargement…')).toBeNull())
}

/** Ouvre la fiche du prestataire nommé par le bouton « Fiche » de sa carte. */
function ouvrirFiche(nom: string): HTMLElement {
  const carte = screen.getAllByText(nom)[0].closest('.panel') as HTMLElement
  fireEvent.click(within(carte).getByRole('button', { name: 'Fiche' }))
  return screen.getByRole('dialog', { name: nom })
}

const valeurSous = (fiche: HTMLElement, libelle: string) => within(fiche).getByText(libelle).nextElementSibling?.textContent

/** Ligne d'un tableau de la fiche, repérée par le texte de sa première cellule. */
const ligne = (bloc: HTMLElement, debut: string) => within(bloc).getByText(debut).closest('tr') as HTMLElement

describe('Prestataires — fiche détaillée', () => {
  beforeEach(reinitialiser)

  it('affiche les blocs de la fiche Entreprise de Gestéam', async () => {
    await monter()
    const fiche = ouvrirFiche('Atlantic Plomberie SARL')
    for (const bloc of [
      'Identité et adresse',
      'Contacts',
      'Téléphones et courriels',
      'Assurances et vigilance',
      'Compétences et mandats',
      'Facturation et règlement',
      'Relances des demandes',
      'Demandes, devis et contrats',
      'Notes et extranet',
    ])
      expect(within(fiche).getByRole('region', { name: bloc })).toBeInTheDocument()
    expect(within(fiche).getByText(/^Entreprise n° 00412 · Fournisseur · Plomberie \/ chauffage$/)).toBeInTheDocument()
    expect(valeurSous(fiche, 'Forme juridique')).toBe('SARL')
    expect(valeurSous(fiche, 'Adresse')).toBe('12 rue de la République, 92000 Nanterre, France')
    expect(valeurSous(fiche, 'Exclu de')).toBe('Villa Montaigne')
  })

  it('calcule l’état des attestations à la date de démonstration', async () => {
    await monter()
    const assurances = within(ouvrirFiche('Atlantic Plomberie SARL')).getByRole('region', { name: 'Assurances et vigilance' })
    expect(within(ligne(assurances, 'RC décennale')).getByText('À jour')).toBeInTheDocument()
    expect(within(ligne(assurances, 'RC professionnelle')).getByText('Échoit bientôt')).toBeInTheDocument()
    // Vigilance remise le 15/11/2025 : à renouveler avant le 15/05/2026, dépassé au 04/06/2026.
    const vigilance = ligne(assurances, 'Vigilance URSSAF')
    expect(within(vigilance).getByText('avant le 15/05/2026')).toBeInTheDocument()
    expect(within(vigilance).getByText('À renouveler')).toBeInTheDocument()
    expect(within(ligne(assurances, 'Extrait Kbis')).getByText('Fourni')).toBeInTheDocument()
  })

  it('masque l’IBAN : seuls les quatre premiers et les quatre derniers caractères paraissent', async () => {
    await monter()
    const fiche = ouvrirFiche('Atlantic Plomberie SARL')
    expect(valeurSous(fiche, 'IBAN')).toBe('FR76 •••• •••• •••• 0427 · BIC AGRIFRPP')
    expect(within(fiche).queryByText(/3000 6000/)).toBeNull()
  })

  it('« Modifier la fiche » enregistre le courriel, le délai de paiement et les notes dans la base', async () => {
    await monter()
    fireEvent.click(within(ouvrirFiche('Atlantic Plomberie SARL')).getByRole('button', { name: /Modifier la fiche/ }))
    const formulaire = screen.getByRole('dialog', { name: 'Modifier Atlantic Plomberie SARL' })
    expect(within(formulaire).getByLabelText('Courriel')).toHaveValue('contact@atlantic-plomberie.fr')
    fireEvent.change(within(formulaire).getByLabelText('Courriel'), { target: { value: 'compta@atlantic-plomberie.fr' } })
    fireEvent.change(within(formulaire).getByLabelText('Délai de paiement (jours)'), { target: { value: '45' } })
    fireEvent.change(within(formulaire).getByLabelText('Notes'), { target: { value: 'Relancer par courriel.' } })
    await act(async () => {
      fireEvent.click(within(formulaire).getByRole('button', { name: 'Enregistrer' }))
    })
    await waitFor(async () => {
      const enregistre = await repoPrestataires.get('F1')
      expect(enregistre?.fiche?.reglement.delaiJours).toBe(45)
    })
    const enregistre = await repoPrestataires.get('F1')
    expect(enregistre?.fiche?.notes).toBe('Relancer par courriel.')
    expect(enregistre?.fiche?.telecoms.filter((telecom) => telecom.type === 'Courriel' && telecom.prefere)).toEqual([
      { type: 'Courriel', nature: 'Général', prefere: true, valeur: 'compta@atlantic-plomberie.fr' },
    ])
    // Les autres données de la fiche sont gardées.
    expect(enregistre?.fiche?.contacts).toEqual(FICHES_PRESTATAIRES_DEMO.F1.contacts)

    const fiche = ouvrirFiche('Atlantic Plomberie SARL')
    expect(valeurSous(fiche, 'Délai')).toBe('45 jours date de facture')
    expect(within(fiche).getByText('compta@atlantic-plomberie.fr')).toBeInTheDocument()
  })

  it('un prestataire sans fiche détaillée garde une fiche lisible', async () => {
    await act(async () => {
      await etat().createPrestataire({
        nom: 'Entreprise sans fiche',
        metier: 'Électricité',
        ville: 'Paris',
        siret: '',
        decennale: false,
        note: 0,
        interventions: 0,
        statut: 'Actif',
        pill: 'sage',
      })
    })
    await monter()
    const fiche = ouvrirFiche('Entreprise sans fiche')
    expect(within(fiche).getByText('Aucun contact enregistré.')).toBeInTheDocument()
    expect(within(fiche).queryByRole('region', { name: 'Assurances et vigilance' })).toBeNull()
    expect(valeurSous(fiche, 'Adresse')).toBe('Paris')
  })
})
