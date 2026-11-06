// tests/components/aj-signalement/app-public.test.tsx
//
// Application publique « AJ Signalement » (page ouverte par le QR code) :
// - nom et adresse de la copropriété, bouton désactivé tant que coordonnées et parcours sont incomplets ;
// - erreurs de saisie sous le champ quitté (e-mail invalide, champ obligatoire vide) ;
// - « Dans mon logement (…) » reprend les coordonnées saisies ;
// - envoi : corps attendu, confirmation avec le numéro, nouveau signalement vide ;
// - parties communes : zone obligatoire et envoyée ;
// - erreur persistante (429, 404), formulaire intact.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AppSignalementQr from '@/components/aj-signalement/AppSignalementQr'
import { TEXTES_SIGNALEMENT_QR } from '@/lib/aj-signalement/textes'
import { textesCopro } from '@/lib/coproprietaire/textes'

const tq = TEXTES_SIGNALEMENT_QR.fr
const t = textesCopro('fr')
const JETON = '0123456789abcdef0123456789abcdef'

type Appel = { url: string; init?: RequestInit }
let appels: Appel[] = []

function simulerFetch(reponse: () => Promise<Response>) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, init })
    return reponse()
  }))
}

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

const REPONSE_OK = { signalement: { id: 'b1c2d3e4-0000-4000-8000-000000000000', numero: 'B1C2D3E4', creeLe: '2026-11-04T14:05:00.000Z', emailEnvoye: true } }

function rendre() {
  return render(<AppSignalementQr jeton={JETON} copropriete={{ nom: 'Parc Belle Ombre', adresse: '12 allée des Pins, 13009 Marseille' }} langue="fr" />)
}

const bouton = () => screen.getByRole('button', { name: tq.envoyer })

type Coordonnees = 'prenom' | 'nom' | 'telephone' | 'email' | 'batiment' | 'etage' | 'numLot'

function remplirCoordonnees(sur: Partial<Record<Coordonnees, string>> = {}) {
  const valeurs: Record<Coordonnees, string> = {
    prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie.durand@example.com', batiment: '', etage: '4', numLot: '12', ...sur,
  }
  for (const champ of Object.keys(valeurs) as Coordonnees[]) {
    const input = screen.getByLabelText(tq[champ])
    fireEvent.change(input, { target: { value: valeurs[champ] } })
    fireEvent.blur(input)
  }
}

function remplirParcours() {
  fireEvent.click(screen.getByLabelText(/Dans mon logement/))
  fireEvent.change(screen.getByLabelText(t.demandes.typeProbleme), { target: { value: 'Ascenseur' } })
  fireEvent.change(screen.getByLabelText(t.demandes.decrivez), { target: { value: 'Ascenseur bloqué entre deux étages' } })
  fireEvent.click(screen.getByLabelText(t.demandes.urgenceUrgent))
}

beforeEach(() => {
  vi.unstubAllGlobals()
  window.scrollTo = vi.fn()
})

describe('page ouverte par le QR code', () => {
  it('affiche la copropriété ; le bouton reste désactivé tant que coordonnées et parcours sont incomplets', () => {
    rendre()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Parc Belle Ombre')
    expect(screen.getByText('12 allée des Pins, 13009 Marseille')).toBeInTheDocument()
    expect(screen.getByText(tq.coordonneesAide)).toBeInTheDocument()
    expect(bouton()).toBeDisabled()
    remplirCoordonnees()
    expect(bouton()).toBeDisabled()
    remplirParcours()
    expect(bouton()).toBeEnabled()
  })

  it('signale un e-mail invalide et un champ obligatoire vide quand on quitte le champ', () => {
    rendre()
    const email = screen.getByLabelText(tq.email)
    fireEvent.change(email, { target: { value: 'marie@localhost' } })
    fireEvent.blur(email)
    expect(screen.getByText(tq.emailInvalide)).toBeInTheDocument()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    fireEvent.blur(screen.getByLabelText(tq.numLot))
    expect(screen.getByText(tq.champObligatoire)).toBeInTheDocument()
    // Le bâtiment, facultatif, ne produit jamais d'erreur.
    fireEvent.blur(screen.getByLabelText(tq.batiment))
    expect(screen.getAllByText(tq.champObligatoire)).toHaveLength(1)
    remplirCoordonnees()
    expect(screen.queryByText(tq.emailInvalide)).toBeNull()
    expect(screen.queryByText(tq.champObligatoire)).toBeNull()
  })

  it('« Dans mon logement » reprend les coordonnées saisies', () => {
    rendre()
    expect(screen.getByLabelText(`Dans mon logement (${tq.votreLogement})`)).toBeInTheDocument()
    remplirCoordonnees({ batiment: 'B' })
    expect(screen.getByLabelText('Dans mon logement (bât. B, 4e étage, lot 12)')).toBeInTheDocument()
  })

  it('envoie le corps attendu, confirme avec le numéro et les coordonnées, puis repart d’un formulaire vide', async () => {
    simulerFetch(async () => json(REPONSE_OK))
    rendre()
    remplirCoordonnees()
    remplirParcours()
    fireEvent.click(bouton())
    await waitFor(() => expect(screen.getByText('Numéro : B1C2D3E4')).toBeInTheDocument())
    expect(appels).toHaveLength(1)
    expect(appels[0].url).toBe('/api/aj-signalement/signalements')
    expect(appels[0].init?.method).toBe('POST')
    expect(JSON.parse(String(appels[0].init?.body))).toEqual({
      jeton: JETON, prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie.durand@example.com', batiment: '', etage: '4', numLot: '12',
      estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Ascenseur', description: 'Ascenseur bloqué entre deux étages', priorite: 'urgente', langue: 'fr',
    })
    expect(screen.getByText(/4 novembre 2026/)).toBeInTheDocument()
    expect(screen.getByText(/06 12 34 56 78/)).toHaveTextContent('marie.durand@example.com')
    expect(window.scrollTo).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: tq.autreSignalement }))
    expect(bouton()).toBeDisabled()
    expect(screen.getByLabelText(tq.prenom)).toHaveValue('')
  })

  it('parties communes : la zone est obligatoire et envoyée, le lieu du logement n’est pas transmis', async () => {
    simulerFetch(async () => json(REPONSE_OK))
    rendre()
    remplirCoordonnees()
    fireEvent.click(screen.getByLabelText(t.demandes.dansPartiesCommunes))
    fireEvent.change(screen.getByLabelText(t.demandes.typeProbleme), { target: { value: 'Éclairage des parties communes' } })
    fireEvent.change(screen.getByLabelText(t.demandes.decrivez), { target: { value: 'Plus de lumière dans la cage d’escalier' } })
    fireEvent.click(screen.getByLabelText(t.demandes.urgenceGenant))
    expect(bouton()).toBeDisabled()
    fireEvent.change(screen.getByLabelText(t.demandes.zone), { target: { value: 'Escalier' } })
    expect(bouton()).toBeEnabled()
    fireEvent.click(bouton())
    await waitFor(() => expect(appels).toHaveLength(1))
    expect(JSON.parse(String(appels[0].init?.body))).toMatchObject({ estPartieCommune: true, zoneSignalee: 'Escalier', priorite: 'normale', etage: '4', numLot: '12' })
  })

  it('refus du serveur : message dédié et persistant (429), formulaire intact ; QR code retiré (404)', async () => {
    simulerFetch(async () => json({ error: 'rate' }, 429))
    rendre()
    remplirCoordonnees()
    remplirParcours()
    fireEvent.click(bouton())
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(tq.erreurs.trop_de_demandes))
    expect(screen.getByLabelText(tq.prenom)).toHaveValue('Marie')
    expect(bouton()).toBeEnabled()

    simulerFetch(async () => json({ error: 'introuvable' }, 404))
    fireEvent.click(bouton())
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(tq.erreurs.introuvable))
  })
})
