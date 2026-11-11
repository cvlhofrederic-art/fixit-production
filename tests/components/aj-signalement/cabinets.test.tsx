// tests/components/aj-signalement/cabinets.test.tsx
//
// Vue « Cabinets » de l'espace AJ Signalement (super admin ; demandes de Hugo du 10/11/2026) : chaque cabinet client a
// sa ligne (nom, identifiant du chemin vitfix.io/<identifiant>/, langue, domaines e-mail), saisie ici, jamais dans le
// code. Création (identifiant proposé depuis le nom, aperçu de l'adresse, réservés et messageries publiques refusés
// avant tout appel), modification (identifiant figé non modifiable, seuls les champs changés partent), rattachement
// définitif des copropriétés sans cabinet (avertissement d'abord), lien vers le Journal.

import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXTES_GESTION_QR as G } from '@/lib/aj-signalement/affichage-gestion'
import { TEXTES_TABLEAU_QR as T } from '@/lib/aj-signalement/affichage'
import { remplir } from '@/lib/coproprietaire/textes'
import { gestionCoproprieteQrVide, type CabinetQr, type CoproprieteQr } from '@/lib/aj-signalement/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { default: CabinetsQr } = await import('@/components/aj-signalement/CabinetsQr')

const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const K2 = 'a0000000-0000-4000-8000-0000000000a2'
const C1 = 'c0000000-0000-4000-8000-000000000001'
const C2 = 'c0000000-0000-4000-8000-000000000002'

const cabinetFige: CabinetQr = { id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', domaines: ['exemple.test'], identifiantFige: true, nbCoproprietes: 1, nbGestionnaires: 2 }
const cabinetNeuf: CabinetQr = { id: K2, nom: 'Autre Exemple', identifiant: 'autre-exemple', langue: 'pt', domaines: [], identifiantFige: false, nbCoproprietes: 0, nbGestionnaires: 0 }

const copro = (id: string, nom: string, cabinet: CabinetQr | null): CoproprieteQr => ({
  id, nom, adresse: '', jeton: '0'.repeat(32), emailsDestinataires: [], actif: true, creeLe: '2026-11-01T00:00:00Z', nbSignalements: 0,
  nbEnAttente: 0, derniereAdresseProposee: null, ...gestionCoproprieteQrVide(),
  cabinet: cabinet ? { id: cabinet.id, nom: cabinet.nom, identifiant: cabinet.identifiant } : null,
})

type Appel = { url: string; methode: string; corps: unknown }
let appels: Appel[] = []
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

function simulerFetch(routeur: (appel: Appel) => Response) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const appel = { url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) : null }
    appels.push(appel)
    return routeur(appel)
  }))
}

const rappels = { onModifie: vi.fn(), onReessayer: vi.fn(), onJournal: vi.fn() }
function rendre(cabinets: CabinetQr[] | null = [cabinetFige, cabinetNeuf], coproprietes: CoproprieteQr[] = [copro(C1, 'Parc Belle Ombre', null), copro(C2, 'Résidence Exemple', cabinetFige)]) {
  return render(<CabinetsQr cabinets={cabinets} erreur={null} coproprietes={coproprietes} {...rappels} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  simulerFetch(() => json({}))
})
afterEach(() => vi.unstubAllGlobals())

describe('liste des cabinets', () => {
  it('nom, adresse vitfix.io/<identifiant>/, langue, domaines, compteurs, identifiant figé', () => {
    rendre()
    const carte = screen.getByRole('heading', { name: 'Cabinet Exemple' }).closest('section') as HTMLElement
    expect(within(carte).getByText('vitfix.io/cabinet-exemple/')).toBeInTheDocument()
    expect(within(carte).getByText(remplir(G.cabinets.domainesLigne, { domaines: 'exemple.test' }))).toBeInTheDocument()
    expect(within(carte).getByText(G.cabinets.fige)).toBeInTheDocument()
    const autre = screen.getByRole('heading', { name: 'Autre Exemple' }).closest('section') as HTMLElement
    expect(within(autre).getByText(remplir(G.cabinets.langueLigne, { langue: G.cabinets.langues.pt }))).toBeInTheDocument()
    expect(within(autre).getByText(remplir(G.cabinets.domainesLigne, { domaines: G.cabinets.aucunDomaine }))).toBeInTheDocument()
    expect(within(autre).queryByText(G.cabinets.fige)).toBeNull()
  })

  it('chargement (null) puis aucun cabinet : message', () => {
    const { rerender } = rendre(null)
    expect(screen.getByRole('status')).toHaveTextContent(G.chargement)
    rerender(<CabinetsQr cabinets={[]} erreur={null} coproprietes={[]} {...rappels} />)
    expect(screen.getByText(G.cabinets.aucun)).toBeInTheDocument()
  })

  it('« Voir le journal » ouvre la vue Journal (absente de la barre du bas du téléphone)', () => {
    rendre()
    fireEvent.click(screen.getByRole('button', { name: G.cabinets.voirJournal }))
    expect(rappels.onJournal).toHaveBeenCalledTimes(1)
  })
})

describe('création', () => {
  const ouvrir = () => {
    fireEvent.click(screen.getByRole('button', { name: G.cabinets.nouveau }))
    return screen.getByRole('dialog')
  }

  it('identifiant proposé depuis le nom, aperçu de l’adresse, POST strict, puis rechargement', async () => {
    simulerFetch(() => json({ cabinet: { ...cabinetNeuf, id: K2 } }, 201))
    rendre()
    const fenetre = ouvrir()
    fireEvent.change(within(fenetre).getByLabelText(G.cabinets.nom), { target: { value: 'Cabinet Été Exemple' } })
    const identifiant = within(fenetre).getByLabelText(G.cabinets.identifiant) as HTMLInputElement
    expect(identifiant.value).toBe('cabinet-ete-exemple')
    expect(within(fenetre).getByText(remplir(G.cabinets.identifiantAide, { apercu: 'vitfix.io/cabinet-ete-exemple/signalement/…' }))).toBeInTheDocument()
    fireEvent.change(within(fenetre).getByLabelText(G.cabinets.domaines), { target: { value: 'Exemple.test' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: G.cabinets.creer }))
    await waitFor(() => expect(rappels.onModifie).toHaveBeenCalledTimes(1))
    expect(appels).toEqual([{ url: '/api/aj-signalement/cabinets', methode: 'POST', corps: { nom: 'Cabinet Été Exemple', identifiant: 'cabinet-ete-exemple', langue: 'fr', domaines: ['exemple.test'] } }])
    expect(screen.getByText(G.cabinets.cree)).toBeInTheDocument()
  })

  it('identifiant modifié à la main : la proposition ne l’écrase plus ; identifiant réservé refusé avant tout appel', () => {
    rendre()
    const fenetre = ouvrir()
    fireEvent.change(within(fenetre).getByLabelText(G.cabinets.nom), { target: { value: 'Cabinet Exemple' } })
    fireEvent.change(within(fenetre).getByLabelText(G.cabinets.identifiant), { target: { value: 'signalement' } })
    fireEvent.change(within(fenetre).getByLabelText(G.cabinets.nom), { target: { value: 'Cabinet Exemple bis' } })
    expect((within(fenetre).getByLabelText(G.cabinets.identifiant) as HTMLInputElement).value).toBe('signalement')
    fireEvent.click(within(fenetre).getByRole('button', { name: G.cabinets.creer }))
    expect(within(fenetre).getByText(G.cabinets.identifiantReserve)).toBeInTheDocument()
    expect(appels).toEqual([])
  })

  it('messagerie publique comme domaine : refusée avant tout appel', () => {
    rendre()
    const fenetre = ouvrir()
    fireEvent.change(within(fenetre).getByLabelText(G.cabinets.nom), { target: { value: 'Cabinet Exemple' } })
    fireEvent.change(within(fenetre).getByLabelText(G.cabinets.domaines), { target: { value: 'gmail.com' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: G.cabinets.creer }))
    expect(within(fenetre).getByText(remplir(G.cabinets.domainesInvalides, { liste: 'gmail.com' }))).toBeInTheDocument()
    expect(appels).toEqual([])
  })

  it.each([
    ['identifiant_pris', 409],
    ['domaine_pris', 409],
  ])('refus du serveur « %s » : message, la fenêtre reste ouverte', async (code, status) => {
    simulerFetch(() => json({ error: code }, status))
    rendre()
    const fenetre = ouvrir()
    fireEvent.change(within(fenetre).getByLabelText(G.cabinets.nom), { target: { value: 'Cabinet Exemple' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: G.cabinets.creer }))
    expect(await within(fenetre).findByText(T.erreurs[code as 'identifiant_pris'])).toBeInTheDocument()
    expect(rappels.onModifie).not.toHaveBeenCalled()
  })
})

describe('modification', () => {
  it('identifiant figé : champ non modifiable et expliqué ; seuls les champs changés partent ; fiches hors des nouveaux domaines signalées', async () => {
    simulerFetch(() => json({ cabinet: cabinetFige, fichesHorsDomaines: [{ id: 'g1', nom: 'Marie Exemple' }] }))
    rendre()
    const carte = screen.getByRole('heading', { name: 'Cabinet Exemple' }).closest('section') as HTMLElement
    fireEvent.click(within(carte).getByRole('button', { name: G.cabinets.modifier }))
    const fenetre = screen.getByRole('dialog')
    expect(within(fenetre).getByLabelText(G.cabinets.identifiant)).toBeDisabled()
    expect(within(fenetre).getByText(G.cabinets.identifiantFige)).toBeInTheDocument()
    fireEvent.change(within(fenetre).getByLabelText(G.cabinets.domaines), { target: { value: 'exemple.test, cabinet-exemple.test' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: G.enregistrer }))
    await waitFor(() => expect(rappels.onModifie).toHaveBeenCalledTimes(1))
    expect(appels).toEqual([{ url: `/api/aj-signalement/cabinets/${K1}`, methode: 'PATCH', corps: { domaines: ['exemple.test', 'cabinet-exemple.test'] } }])
    expect(screen.getByText(remplir(G.cabinets.fichesHorsDomaines, { noms: 'Marie Exemple' }))).toBeInTheDocument()
  })

  it('cabinet sans copropriété ni gestionnaire : identifiant modifiable', async () => {
    simulerFetch(() => json({ cabinet: { ...cabinetNeuf, identifiant: 'autre-exemple-bis' }, fichesHorsDomaines: [] }))
    rendre()
    const carte = screen.getByRole('heading', { name: 'Autre Exemple' }).closest('section') as HTMLElement
    fireEvent.click(within(carte).getByRole('button', { name: G.cabinets.modifier }))
    const fenetre = screen.getByRole('dialog')
    fireEvent.change(within(fenetre).getByLabelText(G.cabinets.identifiant), { target: { value: 'Autre-Exemple-Bis ' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: G.enregistrer }))
    await waitFor(() => expect(appels).toHaveLength(1))
    expect(appels[0].corps).toEqual({ identifiant: 'autre-exemple-bis' })
  })

  it('rien de changé : aucun appel, la fenêtre se ferme', () => {
    rendre()
    const carte = screen.getByRole('heading', { name: 'Cabinet Exemple' }).closest('section') as HTMLElement
    fireEvent.click(within(carte).getByRole('button', { name: G.cabinets.modifier }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: G.enregistrer }))
    expect(appels).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('rattachement des copropriétés sans cabinet', () => {
  it('liste des copropriétés sans cabinet ; avertissement (adresse du QR code, définitif) avant l’appel', async () => {
    simulerFetch(() => json({ rattachees: 1 }))
    rendre()
    const bloc = screen.getByRole('heading', { name: remplir(G.cabinets.sansCabinet, { n: 1 }) }).closest('section') as HTMLElement
    expect(within(bloc).queryByText('Résidence Exemple')).toBeNull()
    fireEvent.click(within(bloc).getByRole('checkbox', { name: /Parc Belle Ombre/ }))
    fireEvent.change(within(bloc).getByLabelText(G.cabinets.rattacherA), { target: { value: K1 } })
    fireEvent.click(within(bloc).getByRole('button', { name: G.cabinets.rattacher }))
    expect(within(bloc).getByText(remplir(G.cabinets.rattachementAvertissement, { identifiant: 'cabinet-exemple' }))).toBeInTheDocument()
    expect(appels).toEqual([])
    fireEvent.click(within(bloc).getByRole('button', { name: G.cabinets.confirmerRattachement }))
    await waitFor(() => expect(rappels.onModifie).toHaveBeenCalledTimes(1))
    expect(appels).toEqual([{ url: `/api/aj-signalement/cabinets/${K1}/rattachement`, methode: 'POST', corps: { coproprieteIds: [C1] } }])
    expect(screen.getByText(remplir(G.cabinets.rattachees, { n: 1 }))).toBeInTheDocument()
  })

  it('rien de choisi : aucun appel', () => {
    rendre()
    const bloc = screen.getByRole('heading', { name: remplir(G.cabinets.sansCabinet, { n: 1 }) }).closest('section') as HTMLElement
    fireEvent.click(within(bloc).getByRole('button', { name: G.cabinets.rattacher }))
    expect(within(bloc).getByText(G.cabinets.choisirAuMoinsUne)).toBeInTheDocument()
    expect(appels).toEqual([])
  })
})
