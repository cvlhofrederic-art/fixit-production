// tests/components/aj-signalement/affiches-logo.test.tsx
//
// Logo du cabinet sur les affiches PDF préparées dans l'espace (demande de Hugo du 13/11/2026) : les écrans qui
// téléchargent l'affiche passent le logo du cabinet de la copropriété, SANS requête par copropriété pour le trouver :
//   - carte d'une copropriété (super admin) : métadonnées du logo prises dans la liste des cabinets déjà chargée
//     (gestion.cabinets) ; gestionnaire connecté : celles de SON cabinet (GET /moi, déjà chargé) ;
//   - assistant d'import : celles du cabinet choisi ;
//   - l'image elle-même est lue au clic par la route publique versionnée (une lecture par affiche ou par lot) ;
//   - sans logo : affichePdfQr / affichesPdfQr appelées exactement comme avant (aucune option, aucune lecture) ;
//   - logo illisible ou réseau coupé : l'affiche est préparée SANS logo, et un avertissement le dit.
// jsPDF n'est pas appelé (qr.ts simulé, matrice du QR code réelle) ; images synthétiques.

import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXTES_TABLEAU_QR as T } from '@/lib/aj-signalement/affichage'
import { TEXTES_GESTION_QR as G } from '@/lib/aj-signalement/affichage-gestion'
import { TEXTES_IMPORT_QR as I } from '@/lib/aj-signalement/import/textes'
import { remplir } from '@/lib/coproprietaire/textes'
import { gestionCoproprieteQrVide, type CabinetQr, type CoproprieteQr } from '@/lib/aj-signalement/types'
import { pngSynthetique } from '../../helpers/png-synthetique'

const sonner = vi.hoisted(() => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))
vi.mock('sonner', () => sonner)
vi.mock('@/lib/aj-signalement/qr', async (original) => ({
  ...(await original<typeof import('@/lib/aj-signalement/qr')>()),
  affichePdfQr: vi.fn(async () => new Blob(['%PDF'])),
  affichesPdfQr: vi.fn(async () => new Blob(['%PDF'])),
  telechargerFichier: vi.fn(),
}))

const qr = await import('@/lib/aj-signalement/qr')
const { default: CarteCoproprieteQr } = await import('@/components/aj-signalement/CarteCoproprieteQr')
const { default: TableauSignalementsQr } = await import('@/components/aj-signalement/TableauSignalementsQr')
const { default: AssistantImportQr } = await import('@/components/aj-signalement/AssistantImportQr')

const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const K2 = 'a0000000-0000-4000-8000-0000000000a2'
const C1 = 'c0000000-0000-4000-8000-000000000001'
const C2 = 'c0000000-0000-4000-8000-000000000002'
const C3 = 'c0000000-0000-4000-8000-000000000003'
const VERSION = '0123456789abcdef'
const META = { version: VERSION, largeur: 320, hauteur: 120 }
const PNG = pngSynthetique(320, 120)
const ROUTE_LOGO = `/api/aj-signalement/logo/cabinet-exemple/?v=${VERSION}`

const cabinet = (id: string, nom: string, identifiant: string, logo?: typeof META): CabinetQr => ({
  id, nom, identifiant, langue: 'fr', domaines: ['exemple.test'], identifiantFige: true, nbCoproprietes: 1, nbGestionnaires: 0, ...(logo ? { logo } : {}),
})
const AVEC_LOGO = cabinet(K1, 'Cabinet Exemple', 'cabinet-exemple', META)
const SANS_LOGO = cabinet(K2, 'Autre Exemple', 'autre-exemple')
const resume = (k: CabinetQr) => ({ id: k.id, nom: k.nom, identifiant: k.identifiant })

const copro = (id: string, nom: string, k: CabinetQr | null): CoproprieteQr => ({
  id, nom, adresse: '1 rue Exemple', jeton: id.replace(/-/g, '').slice(0, 32).padEnd(32, '0').replace(/[^0-9a-f]/g, '0'), emailsDestinataires: [], actif: true,
  creeLe: '2026-11-01T10:00:00.000Z', nbSignalements: 0, nbEnAttente: 0, derniereAdresseProposee: null, ...gestionCoproprieteQrVide(),
  cabinet: k ? resume(k) : null,
})

type Appel = { url: string; methode: string; corps: Record<string, unknown> | null }
let appels: Appel[] = []
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })
function simulerFetch(routeur: (appel: Appel) => Response) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const appel = { url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null }
    appels.push(appel)
    return routeur(appel)
  }))
}
const routeurLogo = (appel: Appel) => (appel.url === ROUTE_LOGO ? new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } }) : json({ error: 'introuvable' }, 404))
const lecturesLogo = () => appels.filter((a) => a.url.startsWith('/api/aj-signalement/logo/'))

beforeEach(() => {
  vi.clearAllMocks()
  simulerFetch(routeurLogo)
})
afterEach(() => vi.unstubAllGlobals())

/** Attend le QR code (matrice calculée), puis clique « Affiche PDF » de la carte. */
async function telechargerAffiche(nom: string) {
  const carte = (await screen.findByRole('heading', { name: nom })).closest('section') as HTMLElement
  const bouton = within(carte).getByRole('button', { name: T.affichePdf })
  await waitFor(() => expect(bouton).toBeEnabled())
  fireEvent.click(bouton)
}

describe('carte d’une copropriété', () => {
  it('cabinet avec logo : l’image est lue au clic par la route publique, puis passée à l’affiche', async () => {
    const c = copro(C1, 'Résidence Exemple', AVEC_LOGO)
    render(<CarteCoproprieteQr copropriete={c} origine="https://vitfix.io" onModifier={vi.fn()} logoCabinet={META} />)
    await telechargerAffiche('Résidence Exemple')
    await waitFor(() => expect(qr.affichePdfQr).toHaveBeenCalledTimes(1))
    expect(lecturesLogo().map((a) => a.url)).toEqual([ROUTE_LOGO])
    const [affiche, options] = vi.mocked(qr.affichePdfQr).mock.calls[0]
    expect(affiche).toMatchObject({ nom: 'Résidence Exemple', adresse: '1 rue Exemple', url: `https://vitfix.io/cabinet-exemple/signalement/${c.jeton}/` })
    expect(options).toEqual({ logo: { png: PNG, largeur: 320, hauteur: 120 } })
    expect(qr.telechargerFichier).toHaveBeenCalledWith('affiche-qr-residence-exemple.pdf', expect.any(Blob))
  })

  it('sans logo : affiche d’avant (un seul argument), aucune lecture', async () => {
    render(<CarteCoproprieteQr copropriete={copro(C2, 'Résidence Sans Logo', SANS_LOGO)} origine="https://vitfix.io" onModifier={vi.fn()} />)
    await telechargerAffiche('Résidence Sans Logo')
    await waitFor(() => expect(qr.affichePdfQr).toHaveBeenCalledTimes(1))
    expect(vi.mocked(qr.affichePdfQr).mock.calls[0]).toHaveLength(1)
    expect(appels).toEqual([])
  })

  it('logo illisible (404, réseau coupé) : affiche préparée sans logo, avertissement', async () => {
    simulerFetch(() => json({ error: 'introuvable' }, 404))
    render(<CarteCoproprieteQr copropriete={copro(C1, 'Résidence Exemple', AVEC_LOGO)} origine="https://vitfix.io" onModifier={vi.fn()} logoCabinet={META} />)
    await telechargerAffiche('Résidence Exemple')
    await waitFor(() => expect(qr.affichePdfQr).toHaveBeenCalledTimes(1))
    expect(vi.mocked(qr.affichePdfQr).mock.calls[0]).toHaveLength(1)
    expect(sonner.toast.warning).toHaveBeenCalledWith(G.cabinets.logo.afficheSansLogo)
    expect(qr.telechargerFichier).toHaveBeenCalled()
  })

  // Relecture de sécurité du 13/11/2026 : un logo lu et revérifié que jsPDF ne savait pas décoder rendait TOUTE affiche du
  // cabinet impossible (« Le fichier n'a pas pu être préparé », à chaque essai). L'affiche est refaite sans le logo.
  it.each([['super admin', false], ['gestionnaire', true]] as const)(
    'jsPDF échoue AVEC le logo (%s) : affiche refaite sans logo, avertissement, fichier téléchargé, aucun message d’échec', async (_vue, vueGestionnaire) => {
      const avertir = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      // Premier appel (avec le logo) : jsPDF lève ; les suivants gardent la simulation du fichier (rien ne déborde sur les autres tests).
      vi.mocked(qr.affichePdfQr).mockRejectedValueOnce(new Error('Error while decompressing the data: -3'))
      render(<CarteCoproprieteQr copropriete={copro(C1, 'Résidence Exemple', AVEC_LOGO)} origine="https://vitfix.io" onModifier={vi.fn()} vueGestionnaire={vueGestionnaire} logoCabinet={META} />)
      await telechargerAffiche('Résidence Exemple')
      await waitFor(() => expect(qr.telechargerFichier).toHaveBeenCalledTimes(1))
      expect(vi.mocked(qr.affichePdfQr).mock.calls.map((c) => c.length)).toEqual([2, 1])
      expect(sonner.toast.warning).toHaveBeenCalledWith(G.cabinets.logo.afficheSansLogo)
      expect(screen.queryByText(T.erreurFichier)).toBeNull()
      expect(avertir).toHaveBeenCalledWith('[aj-signalement] affiche non préparée avec le logo : nouvel essai sans lui', 'Error')
      avertir.mockRestore()
    })

  it('jsPDF échoue aussi SANS le logo : message d’échec, comme avant (un seul avertissement du logo)', async () => {
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.mocked(qr.affichePdfQr).mockRejectedValueOnce(new Error('panne')).mockRejectedValueOnce(new Error('panne'))
    render(<CarteCoproprieteQr copropriete={copro(C1, 'Résidence Exemple', AVEC_LOGO)} origine="https://vitfix.io" onModifier={vi.fn()} logoCabinet={META} />)
    await telechargerAffiche('Résidence Exemple')
    expect(await screen.findByText(T.erreurFichier)).toBeInTheDocument()
    expect(vi.mocked(qr.affichePdfQr)).toHaveBeenCalledTimes(2)
    expect(qr.telechargerFichier).not.toHaveBeenCalled()
    avertir.mockRestore()
  })

  it('vue d’un gestionnaire : même règle (logo de son cabinet)', async () => {
    render(<CarteCoproprieteQr copropriete={copro(C1, 'Résidence Exemple', AVEC_LOGO)} origine="https://vitfix.io" onModifier={vi.fn()} vueGestionnaire logoCabinet={META} />)
    await telechargerAffiche('Résidence Exemple')
    await waitFor(() => expect(qr.affichePdfQr).toHaveBeenCalledTimes(1))
    expect(vi.mocked(qr.affichePdfQr).mock.calls[0][1]).toEqual({ logo: { png: PNG, largeur: 320, hauteur: 120 } })
  })
})

describe('liste des copropriétés : logo trouvé dans les données déjà chargées', () => {
  const tableau = {
    tableau: {
      coproprietes: [copro(C1, 'Résidence Exemple', AVEC_LOGO), copro(C2, 'Résidence Sans Logo', SANS_LOGO), copro(C3, 'Parc Sans Cabinet', null)],
      signalements: [],
    },
  }

  it('super admin : métadonnées prises dans la liste des cabinets ; seule la lecture de l’image au clic', async () => {
    simulerFetch((a) => (a.url.startsWith('/api/aj-signalement/tableau') ? json(tableau) : routeurLogo(a)))
    render(<TableauSignalementsQr jeton={null} vue="coproprietes" gestion={{ cabinets: [AVEC_LOGO, SANS_LOGO], gestionnaires: [] }} />)
    await telechargerAffiche('Résidence Exemple')
    await waitFor(() => expect(qr.affichePdfQr).toHaveBeenCalledTimes(1))
    expect(vi.mocked(qr.affichePdfQr).mock.calls[0][1]).toEqual({ logo: { png: PNG, largeur: 320, hauteur: 120 } })
    await telechargerAffiche('Résidence Sans Logo')
    await telechargerAffiche('Parc Sans Cabinet')
    await waitFor(() => expect(qr.affichePdfQr).toHaveBeenCalledTimes(3))
    expect(vi.mocked(qr.affichePdfQr).mock.calls[1]).toHaveLength(1)
    expect(vi.mocked(qr.affichePdfQr).mock.calls[2]).toHaveLength(1)
    // Une lecture du tableau, une lecture de l'image : aucune requête par copropriété pour trouver son logo.
    expect(appels.map((a) => a.url.split('?')[0])).toEqual(['/api/aj-signalement/tableau', '/api/aj-signalement/logo/cabinet-exemple/'])
  })

  it('gestionnaire : le logo de SON cabinet (profil déjà chargé)', async () => {
    simulerFetch((a) => (a.url.startsWith('/api/aj-signalement/tableau') ? json({ tableau: { ...tableau.tableau, coproprietes: [tableau.tableau.coproprietes[0]] } }) : routeurLogo(a)))
    render(<TableauSignalementsQr jeton={null} vue="coproprietes" gestionnaire={{ domaines: ['exemple.test'], logo: META }} />)
    await telechargerAffiche('Résidence Exemple')
    await waitFor(() => expect(qr.affichePdfQr).toHaveBeenCalledTimes(1))
    expect(vi.mocked(qr.affichePdfQr).mock.calls[0][1]).toEqual({ logo: { png: PNG, largeur: 320, hauteur: 120 } })
  })
})

// ── Assistant d'import : toutes les affiches d'un lot ────────────────────────

const JETON = 'b'.repeat(32)
const CREEE = { numeroLigne: 2, id: 'c0000000-0000-4000-8000-000000000101', jeton: JETON, nom: 'Villa Exemple', adresse: '', codePostal: '13002', ville: 'Marseille' }
const diagnostic = { numeroLigne: 2, nom: 'Villa Exemple', etat: 'a_creer', action: 'creer', messages: [], doublon: null, gestionnaires: [], emailsDestinataires: [], emailsHorsDomaine: [] }

async function importerUneLigne(cabinetImport: CabinetQr, appelsAttendus = 1) {
  simulerFetch((a) => {
    if (a.corps?.mode === 'verifier') return json({ diagnostics: [diagnostic], gestionnairesInconnus: [], horsDomaine: false })
    if (a.corps?.mode === 'creer') return json({ creees: [CREEE], completees: [], ignorees: 0, rejeu: false })
    return routeurLogo(a)
  })
  render(<AssistantImportQr cabinets={[cabinetImport]} origine="https://vitfix.io" onFermer={vi.fn()} onImporte={vi.fn()} />)
  fireEvent.change(screen.getByLabelText(I.fichier), { target: { files: [new File(['Nom de la copropriété;Code postal\r\nVilla Exemple;13002'], 'c.csv', { type: 'text/csv' })] } })
  await screen.findByText(I.correspondance)
  fireEvent.click(screen.getByRole('button', { name: I.verifier }))
  await screen.findByText(I.apercu)
  fireEvent.click(screen.getByRole('button', { name: remplir(I.importer, { n: 1, m: 0 }) }))
  await screen.findByText(remplir(I.resultat, { creees: 1, completees: 0, ignorees: 0 }))
  fireEvent.click(screen.getByRole('button', { name: I.affiches }))
  await waitFor(() => expect(qr.affichesPdfQr).toHaveBeenCalledTimes(appelsAttendus))
}

describe('assistant d’import', () => {
  it('cabinet avec logo : une lecture de l’image pour tout le lot, passée à affichesPdfQr', async () => {
    await importerUneLigne(AVEC_LOGO)
    expect(lecturesLogo().map((a) => a.url)).toEqual([ROUTE_LOGO])
    expect(vi.mocked(qr.affichesPdfQr).mock.calls[0][2]).toEqual({ logo: { png: PNG, largeur: 320, hauteur: 120 } })
  })

  it('cabinet sans logo : affichesPdfQr appelée comme avant (liste et avancement seulement), aucune lecture', async () => {
    await importerUneLigne({ ...AVEC_LOGO, logo: undefined })
    expect(lecturesLogo()).toEqual([])
    expect(vi.mocked(qr.affichesPdfQr).mock.calls[0]).toHaveLength(2)
  })

  it('jsPDF échoue AVEC le logo : affiches refaites sans logo, avertissement, fichier téléchargé (relecture de sécurité)', async () => {
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.mocked(qr.affichesPdfQr).mockRejectedValueOnce(new Error('Error while decompressing the data: -3'))
    await importerUneLigne(AVEC_LOGO, 2)
    await waitFor(() => expect(qr.telechargerFichier).toHaveBeenCalledTimes(1))
    expect(vi.mocked(qr.affichesPdfQr).mock.calls.map((c) => c.length)).toEqual([3, 2])
    expect(sonner.toast.warning).toHaveBeenCalledWith(G.cabinets.logo.affichesSansLogo)
    expect(sonner.toast.error).not.toHaveBeenCalled()
    avertir.mockRestore()
  })
})
