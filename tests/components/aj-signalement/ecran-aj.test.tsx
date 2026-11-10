// tests/components/aj-signalement/ecran-aj.test.tsx
//
// Écran « Signalements QR » de l'Administrateur judiciaire (miroir du tableau de bord, session par cookies) :
// la fiche d'un signalement montre la qualité du déclarant (Propriétaire / Locataire, « Non indiquée » avant le
// 06/11/2026) et, s'il l'a choisi, « Même problème que le signalement n° X » ; l'adresse proposée d'après sa position.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { SignalementsQrModule } from '@/components/administrateur-judiciaire/modules/extranet/SignalementsQrModule'
import type { SignalementQr, TableauQr } from '@/lib/aj-signalement/types'

const ID_COPRO = 'c0000000-0000-4000-8000-000000000001'

const base: SignalementQr = {
  id: '5f2c9a1e-1111-4222-8333-444444444444', coproprieteId: ID_COPRO, coproprieteNom: 'Parc Belle Ombre',
  prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie@example.com', batiment: 'B', etage: '4', numLot: '12',
  estPartieCommune: true, zoneSignalee: 'Escalier', typeIntervention: 'Éclairage des parties communes', description: 'Plus de lumière',
  priorite: 'normale', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: '2026-11-04T14:05:10.000Z', emailErreur: null,
  confirmationEnvoyeeLe: null, confirmationErreur: null,
  qualiteDeclarant: 'locataire', adresseProposee: '1 Quai du Port 13002 Marseille', signalementLieId: '1a2b3c4d-0000-4000-8000-000000000001',
  creeLe: '2026-11-04T14:05:00.000Z', misAJourLe: '2026-11-04T14:05:00.000Z',
}
const ancien: SignalementQr = {
  ...base, id: '6a000000-0000-4000-8000-000000000002', prenom: 'Paul', nom: 'Martin', qualiteDeclarant: null, adresseProposee: '', signalementLieId: null,
  creeLe: '2026-11-03T08:59:00.000Z',
}

const tableau = (): TableauQr => ({
  coproprietes: [{
    id: ID_COPRO, nom: 'Parc Belle Ombre', adresse: '', jeton: '0'.repeat(32), emailsDestinataires: [], actif: true,
    creeLe: '2026-11-04T10:00:00.000Z', nbSignalements: 2, nbEnAttente: 2, derniereAdresseProposee: null,
  }],
  signalements: [base, ancien],
})

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ tableau: tableau() }), { status: 200 })))
})

function ouvrir(nom: string) {
  fireEvent.click(screen.getByText(new RegExp(`${nom}`)).closest('[role="button"]') as HTMLElement)
  return screen.getByRole('dialog')
}

const valeur = (dialogue: HTMLElement, libelle: string) => within(dialogue).getByText(libelle).nextElementSibling?.textContent

describe('écran « Signalements QR » de l’AJ', () => {
  it('fiche : qualité, signalement lié et adresse proposée', async () => {
    render(<ToastProvider><SignalementsQrModule /></ToastProvider>)
    await waitFor(() => expect(screen.getByText(/Marie Durand/)).toBeInTheDocument())
    const dialogue = ouvrir('Marie Durand')
    expect(valeur(dialogue, 'Qualité')).toBe('Locataire')
    expect(valeur(dialogue, 'Signalement lié')).toBe('Même problème que le signalement n° 1A2B3C4D')
    expect(valeur(dialogue, 'Adresse proposée (position du déclarant)')).toBe('1 Quai du Port 13002 Marseille')
  })

  it('signalement antérieur : qualité « Non indiquée », ni lien ni adresse proposée', async () => {
    render(<ToastProvider><SignalementsQrModule /></ToastProvider>)
    await waitFor(() => expect(screen.getByText(/Paul Martin/)).toBeInTheDocument())
    const dialogue = ouvrir('Paul Martin')
    expect(valeur(dialogue, 'Qualité')).toBe('Non indiquée')
    expect(within(dialogue).queryByText('Signalement lié')).toBeNull()
    expect(within(dialogue).queryByText('Adresse proposée (position du déclarant)')).toBeNull()
  })
})
