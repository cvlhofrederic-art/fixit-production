// tests/components/aj-signalement/copropriete-gestion.test.tsx
//
// Copropriétés de l'espace AJ Signalement enrichies par la PR 1 (SPEC § 1.8, choix de Hugo du 10/11/2026) :
// - fenêtre de création : cabinet (ou « sans cabinet », l'ancienne adresse), CP, ville, gestionnaires du cabinet,
//   « Attribuer à tous » (rappel de la règle) ; corps actuel inchangé quand rien de nouveau n'est saisi ;
// - doublon : « Ce n'est pas un doublon, créer » (nom + CP, forcerDoublon) ou « Créer quand même » (probable) ;
//   adresse saisie hors des domaines du cabinet : confirmation (confirmerHorsDomaine) ; adresse d'un gestionnaire
//   refusée avant tout appel ;
// - modification : cabinet affiché (rattachement depuis la vue Cabinets) ; gestionnaires par PUT après le PATCH ;
//   suppression proposée seulement sans signalement, nom à ressaisir ;
// - carte : adresse du QR code sous le chemin du cabinet, gestionnaires ou « Tous les gestionnaires », créateur.

import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXTES_GESTION_QR as G } from '@/lib/aj-signalement/affichage-gestion'
import { TEXTES_TABLEAU_QR as T } from '@/lib/aj-signalement/affichage'
import { remplir } from '@/lib/coproprietaire/textes'
import { gestionCoproprieteQrVide, type CabinetQr, type CoproprieteQr, type GestionnaireQr } from '@/lib/aj-signalement/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { default: ModaleCoproprieteQr } = await import('@/components/aj-signalement/ModaleCoproprieteQr')
const { default: CarteCoproprieteQr } = await import('@/components/aj-signalement/CarteCoproprieteQr')

const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const G1 = '11111111-1111-4111-8111-111111111111'
const G2 = '22222222-2222-4222-8222-222222222222'
const C1 = 'c0000000-0000-4000-8000-000000000001'
const C9 = 'c0000000-0000-4000-8000-000000000009'
const JETON = '0123456789abcdef0123456789abcdef'

const cabinet: CabinetQr = { id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', domaines: ['exemple.test'], identifiantFige: true, nbCoproprietes: 1, nbGestionnaires: 2 }
const resume = { id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }
const gest = (id: string, nom: string, etat: GestionnaireQr['etat']): GestionnaireQr => ({
  id, nom, cabinet: resume, email: `${nom.split(' ')[0].toLowerCase()}@exemple.test`, etat, domaineForce: false, coproprietes: 0, ouverts: 0, urgents: 0,
  creeLe: '2026-11-01T00:00:00Z', confirmeeLe: null,
})
const gestionnaires = [gest(G1, 'Marie Exemple', 'adresse_confirmee'), gest(G2, 'Paul Exemple', 'desactive')]

const copro = (gestion: Partial<CoproprieteQr> = {}): CoproprieteQr => ({
  id: C1, nom: 'Résidence Exemple', adresse: '1 rue Exemple', jeton: JETON, emailsDestinataires: [], actif: true, creeLe: '2026-11-01T10:00:00.000Z',
  nbSignalements: 0, nbEnAttente: 0, derniereAdresseProposee: null, ...gestionCoproprieteQrVide(), ...gestion,
})

type Appel = { url: string; methode: string; corps: unknown }
let appels: Appel[] = []
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })
function simulerFetch(routeur: (appel: Appel, rang: number) => Response) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const appel = { url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) : null }
    appels.push(appel)
    return routeur(appel, appels.length - 1)
  }))
}

const rappels = { onFermer: vi.fn(), onEnregistre: vi.fn(), onSupprimee: vi.fn(), onOuvrir: vi.fn() }
const rendreCreation = () => render(<ModaleCoproprieteQr copropriete={null} jeton={null} cabinets={[cabinet]} gestionnaires={gestionnaires} {...rappels} />)

beforeEach(() => {
  vi.clearAllMocks()
  simulerFetch(() => json({ copropriete: copro({ cabinet: resume }) }, 201))
})
afterEach(() => vi.unstubAllGlobals())

describe('création', () => {
  it('sans cabinet choisi : le corps actuel, sans champ nouveau', async () => {
    rendreCreation()
    fireEvent.change(screen.getByLabelText(T.formulaire.nom), { target: { value: 'Villa Exemple' } })
    fireEvent.click(screen.getByRole('button', { name: T.formulaire.creerBouton }))
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(appels[0].corps).toEqual({ nom: 'Villa Exemple', adresse: '', emailsDestinataires: [] })
    // Sans cabinet, ni gestionnaires ni « à tous ».
    expect(screen.queryByText(G.copropriete.aTous)).toBeNull()
  })

  it('avec un cabinet : CP, ville, gestionnaires actifs du cabinet, « à tous » et son rappel', async () => {
    rendreCreation()
    fireEvent.change(screen.getByLabelText(T.formulaire.nom), { target: { value: 'Villa Exemple' } })
    fireEvent.change(screen.getByLabelText(G.copropriete.cabinet), { target: { value: K1 } })
    fireEvent.change(screen.getByLabelText(G.copropriete.codePostal), { target: { value: '13002' } })
    fireEvent.change(screen.getByLabelText(G.copropriete.ville), { target: { value: 'Exempleville' } })
    expect(screen.queryByRole('checkbox', { name: /Paul Exemple/ })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: /Marie Exemple/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: G.copropriete.aTous }))
    expect(screen.getByText(G.copropriete.aTousRappel)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: T.formulaire.creerBouton }))
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(appels[0].corps).toEqual({
      nom: 'Villa Exemple', adresse: '', emailsDestinataires: [], cabinetId: K1, codePostal: '13002', ville: 'Exempleville',
      gestionnaireIds: [G1], attribueeATous: true,
    })
  })

  it('doublon certain nom + CP : « Ce n’est pas un doublon, créer » renvoie avec forcerDoublon', async () => {
    simulerFetch((_a, rang) => (rang === 0
      ? json({ error: 'doublon', doublon: { certitude: 'certain', critere: 'nom_code_postal', copropriete: { id: C9, nom: 'Résidence Exemple', ville: 'Exempleville' } } }, 409)
      : json({ copropriete: copro() }, 201)))
    rendreCreation()
    fireEvent.change(screen.getByLabelText(T.formulaire.nom), { target: { value: 'Résidence Exemple' } })
    fireEvent.click(screen.getByRole('button', { name: T.formulaire.creerBouton }))
    expect(await screen.findByText(remplir(G.copropriete.doublon, { nom: 'Résidence Exemple', ville: 'Exempleville' }))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: G.copropriete.creerQuandMeme })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: G.copropriete.ouvrirDoublon }))
    expect(rappels.onOuvrir).toHaveBeenCalledWith(C9)
    fireEvent.click(screen.getByRole('button', { name: G.copropriete.pasDoublon }))
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(appels[1].corps).toMatchObject({ nom: 'Résidence Exemple', forcerDoublon: true })
  })

  it('doublon probable : « Créer quand même » (confirmerDoublonProbable) ; doublon d’immatriculation : rien à forcer', async () => {
    simulerFetch((_a, rang) => (rang === 0
      ? json({ error: 'doublon', doublon: { certitude: 'probable', critere: 'nom', copropriete: { id: C9, nom: 'Résidence Exemple', ville: '' } } }, 409)
      : rang === 1
        ? json({ error: 'doublon', doublon: { certitude: 'certain', critere: 'immatriculation', copropriete: { id: C9, nom: 'Résidence Exemple', ville: '' } } }, 409)
        : json({ copropriete: copro() }, 201)))
    rendreCreation()
    fireEvent.change(screen.getByLabelText(T.formulaire.nom), { target: { value: 'Résidence Exemple' } })
    fireEvent.click(screen.getByRole('button', { name: T.formulaire.creerBouton }))
    fireEvent.click(await screen.findByRole('button', { name: G.copropriete.creerQuandMeme }))
    expect(await screen.findByText(G.copropriete.doublonBloquant)).toBeInTheDocument()
    expect(appels[1].corps).toMatchObject({ confirmerDoublonProbable: true })
    expect(screen.queryByRole('button', { name: G.copropriete.pasDoublon })).toBeNull()
    expect(screen.queryByRole('button', { name: G.copropriete.creerQuandMeme })).toBeNull()
  })

  it('adresse saisie hors des domaines du cabinet : confirmation (confirmerHorsDomaine)', async () => {
    simulerFetch((_a, rang) => (rang === 0 ? json({ error: 'hors_domaine', champ: 'emailsDestinataires' }, 409) : json({ copropriete: copro() }, 201)))
    rendreCreation()
    fireEvent.change(screen.getByLabelText(T.formulaire.nom), { target: { value: 'Villa Exemple' } })
    fireEvent.change(screen.getByLabelText(G.copropriete.cabinet), { target: { value: K1 } })
    fireEvent.change(screen.getByLabelText(T.formulaire.emails), { target: { value: 'conseil@autre-exemple.test' } })
    fireEvent.click(screen.getByRole('button', { name: T.formulaire.creerBouton }))
    fireEvent.click(await screen.findByRole('button', { name: G.copropriete.confirmerHorsDomaine }))
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(appels[1].corps).toMatchObject({ emailsDestinataires: ['conseil@autre-exemple.test'], confirmerHorsDomaine: true })
  })

  it('adresse d’un gestionnaire parmi les destinataires : refusée avant tout appel', () => {
    rendreCreation()
    fireEvent.change(screen.getByLabelText(T.formulaire.nom), { target: { value: 'Villa Exemple' } })
    fireEvent.change(screen.getByLabelText(T.formulaire.emails), { target: { value: 'Marie@exemple.test' } })
    fireEvent.click(screen.getByRole('button', { name: T.formulaire.creerBouton }))
    expect(screen.getByText(remplir(G.copropriete.adresseGestionnaire, { liste: 'marie@exemple.test' }))).toBeInTheDocument()
    expect(appels).toEqual([])
  })
})

describe('modification', () => {
  it('copropriété rattachée : cabinet affiché ; gestionnaires changés → PATCH (corps actuel) puis PUT des attributions', async () => {
    const existante = copro({ cabinet: resume, gestionnaires: [], nbSignalements: 2 })
    simulerFetch((a) => (a.methode === 'PUT'
      ? json({ gestionnaires: [{ id: G1, nom: 'Marie Exemple' }], attribueeATous: false, adressesRetirees: 0 })
      : json({ copropriete: existante })))
    render(<ModaleCoproprieteQr copropriete={existante} jeton={null} cabinets={[cabinet]} gestionnaires={gestionnaires} {...rappels} />)
    expect(screen.getByText(remplir(G.copropriete.cabinetActuel, { nom: 'Cabinet Exemple' }))).toBeInTheDocument()
    expect(screen.queryByLabelText(G.copropriete.cabinet)).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: /Marie Exemple/ }))
    fireEvent.click(screen.getByRole('button', { name: T.formulaire.enregistrer }))
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(appels.map((a) => `${a.methode} ${a.url}`)).toEqual([`PATCH /api/aj-signalement/coproprietes/${C1}`, `PUT /api/aj-signalement/coproprietes/${C1}/gestionnaires`])
    expect(appels[0].corps).toEqual({ nom: 'Résidence Exemple', adresse: '1 rue Exemple', emailsDestinataires: [], actif: true })
    expect(appels[1].corps).toEqual({ gestionnaireIds: [G1], attribueeATous: false })
    expect(rappels.onEnregistre.mock.calls[0][0].gestionnaires).toEqual([{ id: G1, nom: 'Marie Exemple' }])
    // Avec des signalements, pas de suppression.
    expect(screen.queryByRole('button', { name: G.copropriete.supprimer })).toBeNull()
  })

  it('copropriété sans cabinet : renvoi vers la vue Cabinets pour le rattachement, pas de gestionnaires', () => {
    render(<ModaleCoproprieteQr copropriete={copro()} jeton={null} cabinets={[cabinet]} gestionnaires={gestionnaires} {...rappels} />)
    expect(screen.getByText(G.copropriete.sansCabinetModif)).toBeInTheDocument()
    expect(screen.queryByText(G.copropriete.aTous)).toBeNull()
  })

  it('suppression (sans signalement) : nom à ressaisir, DELETE, puis la carte disparaît', async () => {
    simulerFetch(() => new Response(null, { status: 204 }))
    render(<ModaleCoproprieteQr copropriete={copro()} jeton={null} cabinets={[cabinet]} gestionnaires={gestionnaires} {...rappels} />)
    fireEvent.click(screen.getByRole('button', { name: G.copropriete.supprimer }))
    expect(screen.getByText(G.copropriete.supprimerAide)).toBeInTheDocument()
    const confirmer = screen.getByRole('button', { name: G.copropriete.confirmerSupprimer })
    expect(confirmer).toBeDisabled()
    fireEvent.change(screen.getByLabelText(G.copropriete.nomConfirmation), { target: { value: 'Résidence Exemple' } })
    fireEvent.click(confirmer)
    await waitFor(() => expect(rappels.onSupprimee).toHaveBeenCalledWith(C1))
    expect(appels).toEqual([{ url: `/api/aj-signalement/coproprietes/${C1}`, methode: 'DELETE', corps: { nomConfirmation: 'Résidence Exemple' } }])
  })
})

describe('carte d’une copropriété', () => {
  it('rattachée : adresse du QR code sous le chemin du cabinet ; gestionnaires ; créateur', () => {
    render(<CarteCoproprieteQr copropriete={copro({ cabinet: resume, gestionnaires: [{ id: G1, nom: 'Marie Exemple' }, { id: G2, nom: null }] })} origine="https://vitfix.io" onModifier={vi.fn()} />)
    expect(screen.getByText(`https://vitfix.io/cabinet-exemple/signalement/${JETON}/`)).toBeInTheDocument()
    expect(screen.getByText(remplir(G.copropriete.cabinetLigne, { nom: 'Cabinet Exemple' }))).toBeInTheDocument()
    expect(screen.getByText(remplir(G.copropriete.gestionnairesLigne, { noms: `Marie Exemple, ${G.fiche.ancien}` }))).toBeInTheDocument()
    expect(screen.getByText(G.copropriete.creeeParAdmin, { exact: false })).toBeInTheDocument()
  })

  it('« attribuée à tous » : badge ; adresses de gestionnaires saisies : rappel', () => {
    render(<CarteCoproprieteQr copropriete={copro({ cabinet: resume, attribueeATous: true, adressesDeGestionnaires: 1 })} origine="https://vitfix.io" onModifier={vi.fn()} />)
    expect(screen.getByText(G.copropriete.tousGestionnaires)).toBeInTheDocument()
    expect(screen.getByText(remplir(G.copropriete.adressesGestionnaires, { n: 1 }))).toBeInTheDocument()
  })

  it('sans cabinet : l’ancienne adresse (affiches déjà imprimées)', () => {
    render(<CarteCoproprieteQr copropriete={copro()} origine="https://vitfix.io" onModifier={vi.fn()} />)
    expect(screen.getByText(`https://vitfix.io/fr/signalement/${JETON}/`)).toBeInTheDocument()
    expect(screen.queryByText(G.copropriete.tousGestionnaires)).toBeNull()
  })
})

describe('liste des copropriétés : filtre', () => {
  it('filtre « Sans gestionnaire » : seules les copropriétés concernées restent', async () => {
    const { default: TableauSignalementsQr } = await import('@/components/aj-signalement/TableauSignalementsQr')
    simulerFetch(() => json({ tableau: {
      coproprietes: [
        copro({ id: C1, nom: 'Résidence Une', cabinet: resume, gestionnaires: [{ id: G1, nom: 'Marie Exemple' }] }),
        copro({ id: C9, nom: 'Résidence Neuf', cabinet: resume }),
      ],
      signalements: [],
    } }))
    render(<TableauSignalementsQr jeton={null} vue="coproprietes" gestion={{ cabinets: [cabinet], gestionnaires }} />)
    expect(await screen.findByRole('heading', { name: 'Résidence Une' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(G.copropriete.filtre), { target: { value: 'sans_gestionnaire' } })
    expect(screen.queryByRole('heading', { name: 'Résidence Une' })).toBeNull()
    expect(within(screen.getByRole('group', { name: T.coproprietes })).getByRole('heading', { name: 'Résidence Neuf' })).toBeInTheDocument()
  })
})
