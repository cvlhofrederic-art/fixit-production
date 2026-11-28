import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CoproprietesModule } from '@/components/administrateur-judiciaire/modules/patrimoine/CoproprietesModule'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/**
 * Copropriétés : fiche d'une assemblée sur le modèle de la fiche assemblée de Gestéam, ouverte depuis le bloc
 * « Assemblées » de la fiche copropriété. Résultats, convocation, pouvoirs et contestation calculés par les modules de
 * droit existants. Demande de Hugo du 29/10/2026 ; données de démonstration fictives.
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

function ouvrirAg(libelle: string): HTMLElement {
  const carte = screen.getByText('Résidence Le Méridien', { selector: '.entity-card__title' }).closest('.panel') as HTMLElement
  fireEvent.click(within(carte).getByRole('button', { name: 'Détails' }))
  const copro = screen.getByRole('dialog', { name: 'Résidence Le Méridien' })
  fireEvent.click(within(copro).getByRole('button', { name: libelle }))
  return screen.getByRole('dialog', { name: /^Assemblée générale du / })
}

const valeurSous = (fiche: HTMLElement, libelle: string) => within(fiche).getByText(libelle).nextElementSibling?.textContent
const bloc = (fiche: HTMLElement, nom: string) => within(fiche).getByRole('region', { name: nom })
const ligne = (region: HTMLElement, debut: string) => within(region).getByText(debut).closest('tr') as HTMLElement

describe('Copropriétés — fiche assemblée', () => {
  beforeEach(reinitialiser)

  it('s’ouvre depuis le bloc « Assemblées » de la fiche copropriété', async () => {
    await monter()
    const fiche = ouvrirAg('AG du 18/04/2026')
    expect(within(fiche).getByText('Résidence Le Méridien · Annuelle · N° M012.2026.1')).toBeInTheDocument()
    for (const nom of [
      'Date et tenue',
      'Convocation',
      'Ordre du jour et résultats',
      'Présence',
      'Bureau et pouvoirs',
      "Décisions de l'exercice",
      'Procès-verbal',
      'Notes et équipe',
    ])
      expect(bloc(fiche, nom)).toBeInTheDocument()
    expect(valeurSous(fiche, 'Date')).toBe('Samedi 18/04/2026')
  })

  it('calcule le résultat de chaque résolution selon sa majorité', async () => {
    await monter()
    const resultats = bloc(ouvrirAg('AG du 18/04/2026'), 'Ordre du jour et résultats')
    expect(within(ligne(resultats, 'Élection du président de séance')).getByText('Adoptée')).toBeInTheDocument()
    expect(within(ligne(resultats, 'Élection du président de séance')).getByText('5 928')).toBeInTheDocument()
    // Art. 25 sous le tiers des voix (2 947 sur 10 000), hors travaux de l'art. 25 f : rejet sans second vote.
    expect(within(ligne(resultats, 'Ravalement de la façade sur rue')).getByText('Rejetée')).toBeInTheDocument()
    expect(within(ligne(resultats, 'Élection des membres du conseil syndical')).getByText('Adoptée')).toBeInTheDocument()
  })

  it('compte la présence, contrôle la convocation et les pouvoirs', async () => {
    await monter()
    const fiche = ouvrirAg('AG du 18/04/2026')
    const presence = bloc(fiche, 'Présence')
    expect(within(ligne(presence, 'Présents')).getByText('4 031')).toBeInTheDocument()
    expect(within(ligne(presence, 'Absents')).getByText('4 072')).toBeInTheDocument()
    expect(valeurSous(fiche, 'Présentation au plus tard')).toBe('27/03/2026')
    expect(valeurSous(fiche, 'Délai de 21 jours')).toBe('Respecté')
    expect(valeurSous(fiche, 'Pouvoirs')).toBe('5 · conformes (art. 22)')
    expect(valeurSous(fiche, 'Mandataires')).toBe('Inès Lefèvre, Laurent Mercier')
  })

  it('date la fin du délai de contestation depuis la présentation de la notification (art. 42, J1)', async () => {
    await monter()
    expect(valeurSous(ouvrirAg('AG du 18/04/2026'), "Contestation possible jusqu'au")).toBe('06/07/2026 (art. 42, sans report)')
  })

  it('une assemblée convoquée, pas encore tenue : résolutions à voter, présence à venir', async () => {
    await monter()
    const fiche = ouvrirAg('AG du 15/09/2026')
    expect(within(bloc(fiche, 'Ordre du jour et résultats')).getAllByText('À voter')).toHaveLength(2)
    expect(within(fiche).getByText(/Feuille de présence établie le jour de l'assemblée \(36 copropriétaires convoqués\)/)).toBeInTheDocument()
    expect(valeurSous(fiche, 'Délai de 21 jours')).toBe('Non vérifiable')
    expect(valeurSous(fiche, "Contestation possible jusqu'au")).toBe('Calculée à la notification')
  })

  it('« Modifier la fiche » recalcule la contestation ; « Fiche copropriété » ramène à la copropriété', async () => {
    await monter()
    fireEvent.click(within(ouvrirAg('AG du 18/04/2026')).getByRole('button', { name: /Modifier la fiche/ }))
    const formulaire = screen.getByRole('dialog', { name: 'Modifier la fiche — AG du 18/04/2026' })
    fireEvent.change(within(formulaire).getByLabelText('Notification du PV présentée le'), { target: { value: '2026-05-12' } })
    fireEvent.click(within(formulaire).getByRole('button', { name: 'Enregistrer' }))
    const fiche = screen.getByRole('dialog', { name: 'Assemblée générale du 18/04/2026' })
    expect(valeurSous(fiche, "Contestation possible jusqu'au")).toBe('13/07/2026 (art. 42, sans report)')
    fireEvent.click(within(fiche).getByRole('button', { name: 'Fiche copropriété' }))
    expect(screen.getByRole('dialog', { name: 'Résidence Le Méridien' })).toBeInTheDocument()
  })
})
