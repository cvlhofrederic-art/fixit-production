import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LotsCoproprietairesModule } from '@/components/administrateur-judiciaire/modules/patrimoine/LotsCoproprietairesModule'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

/**
 * Lots & copropriétaires : fiche d'un lot sur le modèle de la fiche lot de Gestéam (identification, situation,
 * propriété, occupation, tantièmes et quote-part par clé, caractéristiques, charges, équipements, documents), ouverte
 * depuis la colonne « Lot » du registre ou depuis la fiche du copropriétaire. Demande de Hugo du 29/10/2026.
 */

async function monter() {
  await act(async () => {
    render(
      <ToastProvider>
        <LotsCoproprietairesModule />
      </ToastProvider>,
    )
  })
}

const ouvrirLotDuRegistre = (libelle: string) => {
  fireEvent.click(screen.getByRole('button', { name: libelle }))
  return screen.getByRole('dialog', { name: libelle })
}
const valeurSous = (fiche: HTMLElement, libelle: string) => within(fiche).getByText(libelle).nextElementSibling?.textContent
const bloc = (fiche: HTMLElement, nom: string) => within(fiche).getByRole('region', { name: nom })
const ligne = (region: HTMLElement, debut: string) => within(region).getByText(debut).closest('tr') as HTMLElement

describe('Lots & copropriétaires — fiche lot', () => {
  it('s’ouvre depuis la colonne « Lot » du registre, sans ouvrir la fiche du copropriétaire', async () => {
    await monter()
    const fiche = ouvrirLotDuRegistre('Lot 12 — Apt B3')
    expect(screen.queryByRole('dialog', { name: 'Laurent Mercier' })).toBeNull()
    for (const nom of [
      'Identification',
      'Situation',
      'Propriété',
      'Occupation',
      'Tantièmes par clé',
      'Caractéristiques',
      'Charges et assurance',
      'Équipements du lot',
      'Documents du lot',
    ])
      expect(bloc(fiche, nom)).toBeInTheDocument()
    expect(within(fiche).getByText('Résidence Le Méridien · Appartement · lot principal')).toBeInTheDocument()
    expect(valeurSous(fiche, 'N° de lot')).toBe('12')
    expect(valeurSous(fiche, 'Copropriétaire')).toBe('Compte n° 00012 · Laurent Mercier')
  })

  it('calcule la quote-part par clé et les charges annuelles sur le budget', async () => {
    await monter()
    const fiche = ouvrirLotDuRegistre('Lot 12 — Apt B3')
    const generale = ligne(bloc(fiche, 'Tantièmes par clé'), 'Charges générales')
    expect(within(generale).getByText('412')).toBeInTheDocument()
    expect(within(generale).getByText('4,12 %')).toBeInTheDocument()
    expect(within(ligne(bloc(fiche, 'Tantièmes par clé'), 'Ascenseur bât. B')).getByText('5,80 %')).toBeInTheDocument()
    // Budget de la Résidence Le Méridien (142 000 €) × 412 / 10 000.
    expect(valeurSous(fiche, 'Charges annuelles (budget)')).toBe(formatEuros(5850))
    expect(valeurSous(fiche, 'Fonds de travaux attaché au lot')).toBe(`${formatEuros(1236)} (non remboursable à la vente)`)
  })

  it('un lot loué montre le locataire du compte ; un lot occupé par son propriétaire, non', async () => {
    await monter()
    let fiche = ouvrirLotDuRegistre('Lot 12 — Apt B3')
    expect(valeurSous(fiche, 'Occupé par')).toBe('Locataire')
    expect(valeurSous(fiche, 'Identité du locataire')).toBe('Julien Morel')
    expect(valeurSous(fiche, 'Téléphone du locataire')).toBe('06 45 18 27 93')
    fireEvent.click(within(fiche).getAllByRole('button', { name: 'Fermer' })[0])
    fiche = ouvrirLotDuRegistre('Lot 27 — Apt 4G')
    expect(valeurSous(fiche, 'Occupé par')).toBe('Résident')
    expect(within(fiche).queryByText('Identité du locataire')).toBeNull()
  })

  it('s’ouvre depuis la fiche du copropriétaire, pour chacun de ses lots', async () => {
    await monter()
    fireEvent.click(screen.getByText('SCI Belvédère'))
    const compte = screen.getByRole('dialog', { name: 'SCI Belvédère' })
    fireEvent.click(within(compte).getByRole('button', { name: 'Lot 9 — Local' }))
    const fiche = screen.getByRole('dialog', { name: 'Lot 9 — Local' })
    expect(within(fiche).getByText('Copropriété Les Tilleuls · Local commercial · lot secondaire')).toBeInTheDocument()
    expect(within(ligne(bloc(fiche, 'Tantièmes par clé'), 'Charges communes générales')).getByText('3,20 %')).toBeInTheDocument()
    fireEvent.click(within(fiche).getByRole('button', { name: 'Fiche du copropriétaire' }))
    expect(screen.getByRole('dialog', { name: 'SCI Belvédère' })).toBeInTheDocument()
  })

  it('« Modifier la fiche » change la situation et la surface du lot', async () => {
    await monter()
    fireEvent.click(within(ouvrirLotDuRegistre('Lot 12 — Apt B3')).getByRole('button', { name: /Modifier la fiche/ }))
    const formulaire = screen.getByRole('dialog', { name: 'Modifier la fiche — Lot 12 — Apt B3' })
    expect(within(formulaire).getByLabelText('Bâtiment')).toHaveValue('B')
    fireEvent.change(within(formulaire).getByLabelText('Bâtiment'), { target: { value: 'D' } })
    fireEvent.change(within(formulaire).getByLabelText('Surface (m²)'), { target: { value: '70.5' } })
    fireEvent.click(within(formulaire).getByRole('button', { name: 'Enregistrer' }))
    const fiche = screen.getByRole('dialog', { name: 'Lot 12 — Apt B3' })
    expect(valeurSous(fiche, 'Bâtiment')).toBe('D')
    expect(valeurSous(fiche, 'Surface')).toBe('70,5 m²')
    // Le reste de la fiche est gardé.
    expect(valeurSous(fiche, 'Escalier')).toBe('2')
  })
})
