// tests/components/aj-signalement/tableau.test.tsx
//
// Tableau de bord « AJ Signalement » (vue super admin du portail copropriétaire) :
// - chargement (GET tableau avec le jeton) : indicateurs, carte de la copropriété (lien, QR code dessiné,
//   destinataires), signalements du plus récent au plus ancien ;
// - détail : coordonnées cliquables, changement de statut (PATCH) répercuté sur la liste et les indicateurs ;
// - nouvelle copropriété (POST) : carte ajoutée ; e-mails invalides refusés avant tout appel ;
// - base non initialisée : message avec la migration et bouton Réessayer ; filtre par copropriété.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import TableauSignalementsQr from '@/components/aj-signalement/TableauSignalementsQr'
import { TEXTES_TABLEAU_QR as T } from '@/lib/aj-signalement/affichage'
import type { SignalementQr, TableauQr } from '@/lib/aj-signalement/types'

const JETON = '0123456789abcdef0123456789abcdef'
const ID_COPRO = 'c0000000-0000-4000-8000-000000000001'
const ID_COPRO_2 = 'c0000000-0000-4000-8000-000000000002'

const marie: SignalementQr = {
  id: '5f2c9a1e-1111-4222-8333-444444444444', coproprieteId: ID_COPRO, coproprieteNom: 'Parc Belle Ombre',
  prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie@example.com', batiment: 'B', etage: '4', numLot: '12',
  estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier',
  priorite: 'urgente', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: '2026-11-04T14:05:10.000Z', emailErreur: null,
  creeLe: '2026-11-04T14:05:00.000Z', misAJourLe: '2026-11-04T14:05:00.000Z',
}
const paul: SignalementQr = {
  ...marie, id: '6a000000-0000-4000-8000-000000000002', coproprieteId: ID_COPRO_2, coproprieteNom: 'Les Oliviers',
  prenom: 'Paul', nom: 'Martin', telephone: '04 91 00 00 00', email: 'paul@example.com', batiment: '', etage: '1', numLot: '3',
  estPartieCommune: true, zoneSignalee: 'Hall d’entrée', typeIntervention: 'Ascenseur', description: 'Ascenseur bloqué',
  priorite: 'normale', statut: 'terminee', emailEnvoyeLe: null, emailErreur: 'RESEND_API_KEY not configured',
  creeLe: '2026-11-03T08:59:00.000Z', misAJourLe: '2026-11-03T12:00:00.000Z',
}

function tableau(): TableauQr {
  return {
    coproprietes: [
      { id: ID_COPRO, nom: 'Parc Belle Ombre', adresse: '', jeton: JETON, emailsDestinataires: [], actif: true, creeLe: '2026-11-04T10:00:00.000Z', nbSignalements: 1, nbEnAttente: 1 },
      { id: ID_COPRO_2, nom: 'Les Oliviers', adresse: 'Aubagne', jeton: 'f'.repeat(32), emailsDestinataires: ['o@example.com'], actif: true, creeLe: '2026-11-04T11:00:00.000Z', nbSignalements: 1, nbEnAttente: 0 },
    ],
    signalements: [paul, marie],
  }
}

type Appel = { url: string; init?: RequestInit }
let appels: Appel[] = []

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

function simulerFetch(routeur: (appel: Appel) => Response) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const appel = { url, init }
    appels.push(appel)
    return routeur(appel)
  }))
}

const lienPublic = () => `${window.location.origin}/fr/signalement/${JETON}/`
const indicateurs = () => screen.getByRole('region', { name: T.indicateurs })

async function rendrePret(routeur: (appel: Appel) => Response = () => json({ tableau: tableau() })) {
  simulerFetch(routeur)
  render(<TableauSignalementsQr jeton="jeton" />)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Parc Belle Ombre' })).toBeInTheDocument())
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('chargement', () => {
  it('appelle le tableau avec le jeton ; indicateurs, copropriétés (lien, QR code, destinataires) et signalements', async () => {
    await rendrePret()
    expect(appels[0].url).toBe('/api/aj-signalement/tableau')
    expect((appels[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer jeton')

    expect(within(indicateurs()).getByText(T.kpis.recus).parentElement).toHaveTextContent('2')
    expect(within(indicateurs()).getByText(T.kpis.aTraiter).parentElement).toHaveTextContent('1')
    expect(within(indicateurs()).getByText(T.kpis.resolus).parentElement).toHaveTextContent('1')

    expect(screen.getByText(lienPublic())).toBeInTheDocument()
    expect(screen.getByText(T.destinatairesDefaut, { exact: false })).toBeInTheDocument()
    expect(screen.getByText('o@example.com', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('1 signalement · 1 à traiter')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('img', { name: 'QR code de la copropriété Parc Belle Ombre' })).toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: T.affichePdf })[0]).toBeEnabled()

    const lignes = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(lignes).toHaveLength(2)
    expect(lignes[0]).toHaveTextContent('Marie Durand')
    expect(lignes[0]).toHaveTextContent('Urgent')
    expect(lignes[0]).toHaveTextContent('À traiter')
    expect(lignes[0]).toHaveTextContent('Logement (bât. B, étage 4, lot 12)')
    expect(lignes[1]).toHaveTextContent('Paul Martin')
    expect(lignes[1]).toHaveTextContent('Parties communes — Hall d’entrée')
    expect(lignes[1]).toHaveTextContent('Résolu')
  })

  it('filtre par copropriété', async () => {
    await rendrePret()
    fireEvent.change(screen.getByLabelText(T.filtrerCopro), { target: { value: ID_COPRO_2 } })
    const lignes = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toHaveTextContent('Paul Martin')
  })

  it('base non initialisée : message avec la migration, bouton Réessayer', async () => {
    simulerFetch(() => json({ error: 'base_absente' }, 503))
    render(<TableauSignalementsQr jeton={null} />)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('20261104_signalements_qr.sql'))
    expect((appels[0].init?.headers as Record<string, string>).Authorization).toBeUndefined()
    simulerFetch(() => json({ tableau: tableau() }))
    fireEvent.click(screen.getByRole('button', { name: T.reessayer }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Parc Belle Ombre' })).toBeInTheDocument())
  })
})

describe('détail d’un signalement', () => {
  it('coordonnées cliquables, e-mail non envoyé signalé, changement de statut répercuté', async () => {
    await rendrePret((appel) => (appel.init?.method === 'PATCH'
      ? json({ signalement: { id: marie.id, statut: 'acceptee', misAJourLe: '2026-11-04T15:00:00.000Z' } })
      : json({ tableau: tableau() })))
    fireEvent.click(within(within(screen.getByRole('list')).getAllByRole('listitem')[0]).getByRole('button', { name: T.voirDetail }))
    const dialogue = screen.getByRole('dialog')
    expect(within(dialogue).getByRole('link', { name: '06 12 34 56 78' })).toHaveAttribute('href', 'tel:0612345678')
    expect(within(dialogue).getByRole('link', { name: 'marie@example.com' })).toHaveAttribute('href', 'mailto:marie@example.com')
    expect(dialogue).toHaveTextContent('Fuite sous l’évier')
    expect(dialogue).toHaveTextContent('Signalement 5F2C9A1E')

    fireEvent.click(within(dialogue).getByRole('button', { name: 'Prendre en charge' }))
    await waitFor(() => expect(within(dialogue).getByRole('button', { name: 'Intervention en cours' })).toBeInTheDocument())
    const patch = appels.find((a) => a.init?.method === 'PATCH')
    expect(patch?.url).toBe(`/api/aj-signalement/signalements/${marie.id}`)
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ statut: 'acceptee' })

    fireEvent.click(within(dialogue).getByRole('button', { name: T.detail.fermer }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(screen.getByRole('list')).getAllByRole('listitem')[0]).toHaveTextContent('Pris en charge')
    expect(within(indicateurs()).getByText(T.kpis.aTraiter).parentElement).toHaveTextContent('0')
    // Les deux copropriétés ont désormais un signalement sans rien à traiter.
    expect(screen.getAllByText('1 signalement')).toHaveLength(2)
  })

  it('e-mail non envoyé : l’erreur est rappelée dans la fiche', async () => {
    await rendrePret()
    fireEvent.click(within(within(screen.getByRole('list')).getAllByRole('listitem')[1]).getByRole('button', { name: T.voirDetail }))
    expect(screen.getByRole('dialog')).toHaveTextContent('E-mail non envoyé : RESEND_API_KEY not configured')
  })
})

describe('copropriétés', () => {
  it('ajoute une copropriété : POST puis nouvelle carte avec son QR code', async () => {
    await rendrePret((appel) => (appel.init?.method === 'POST'
      ? json({ copropriete: { id: 'c3', nom: 'Villa Rose', adresse: 'Cassis', jeton: 'a'.repeat(32), emailsDestinataires: ['rose@example.com'], actif: true, creeLe: '2026-11-04T12:00:00.000Z', nbSignalements: 0, nbEnAttente: 0 } }, 201)
      : json({ tableau: tableau() })))
    fireEvent.click(screen.getByRole('button', { name: T.ajouterCopro }))
    const dialogue = screen.getByRole('dialog')
    fireEvent.change(within(dialogue).getByLabelText(T.formulaire.nom), { target: { value: 'Villa Rose' } })
    fireEvent.change(within(dialogue).getByLabelText(T.formulaire.adresse), { target: { value: 'Cassis' } })
    fireEvent.change(within(dialogue).getByLabelText(T.formulaire.emails), { target: { value: 'Rose@Example.com' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: T.formulaire.creerBouton }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Villa Rose' })).toBeInTheDocument())
    const post = appels.find((a) => a.init?.method === 'POST')
    expect(post?.url).toBe('/api/aj-signalement/coproprietes')
    expect(JSON.parse(String(post?.init?.body))).toEqual({ nom: 'Villa Rose', adresse: 'Cassis', emailsDestinataires: ['rose@example.com'] })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText(`${window.location.origin}/fr/signalement/${'a'.repeat(32)}/`)).toBeInTheDocument()
  })

  it('e-mails invalides ou nom vide : refusés avant tout appel', async () => {
    await rendrePret()
    fireEvent.click(screen.getByRole('button', { name: T.ajouterCopro }))
    const dialogue = screen.getByRole('dialog')
    fireEvent.change(within(dialogue).getByLabelText(T.formulaire.nom), { target: { value: 'Villa Rose' } })
    fireEvent.change(within(dialogue).getByLabelText(T.formulaire.emails), { target: { value: 'pas-un-email, ok@example.com' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: T.formulaire.creerBouton }))
    expect(within(dialogue).getByRole('alert')).toHaveTextContent('pas-un-email')
    expect(appels.filter((a) => a.init?.method === 'POST')).toHaveLength(0)
  })

  it('modifie une copropriété : PATCH avec nom, adresse, destinataires et activation', async () => {
    await rendrePret((appel) => (appel.init?.method === 'PATCH'
      ? json({ copropriete: { ...tableau().coproprietes[0], nom: 'Parc Belle Ombre (bât. B)', actif: false, nbSignalements: 0, nbEnAttente: 0 } })
      : json({ tableau: tableau() })))
    fireEvent.click(screen.getAllByRole('button', { name: T.modifier })[0])
    const dialogue = screen.getByRole('dialog')
    fireEvent.change(within(dialogue).getByLabelText(T.formulaire.nom), { target: { value: 'Parc Belle Ombre (bât. B)' } })
    fireEvent.click(within(dialogue).getByLabelText(T.formulaire.actif))
    fireEvent.click(within(dialogue).getByRole('button', { name: T.formulaire.enregistrer }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Parc Belle Ombre (bât. B)' })).toBeInTheDocument())
    const patch = appels.find((a) => a.init?.method === 'PATCH')
    expect(patch?.url).toBe(`/api/aj-signalement/coproprietes/${ID_COPRO}`)
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ nom: 'Parc Belle Ombre (bât. B)', adresse: '', emailsDestinataires: [], actif: false })
    expect(screen.getByText(T.qrDesactive)).toBeInTheDocument()
    // Les compteurs connus sont conservés.
    expect(screen.getByText('1 signalement · 1 à traiter')).toBeInTheDocument()
  })
})
