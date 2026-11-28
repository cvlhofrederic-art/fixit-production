// tests/components/aj-signalement/tableau.test.tsx
//
// Contenu de l'espace « AJ Signalement » (/fr/aj-signalement/, super admin) : TableauSignalementsQr, une seule instance
// gardée montée par l'espace, qui affiche la vue choisie dans son menu (Tableau de bord, Copropriétés, Signalements) :
// - un seul chargement (GET tableau, avec le jeton quand il est donné) pour les trois vues ;
// - changement de vue (menu ou bouton Retour du navigateur) : la fenêtre ouverte se ferme, le message de succès s'efface ;
// - tableau de bord : présentation, indicateurs, puis sous les quatre carrés la liste de tous les signalements reçus
//   avec le filtre par copropriété (demande de Hugo du 11/11/2026 : mêmes lignes, même détail, même filtre que la vue
//   Signalements, aucun second chargement ; les carrés restent ceux de tous les signalements) ;
//   copropriétés : cartes (lien, QR code dessiné, destinataires), ajout, modification ;
//   signalements : liste du plus récent au plus ancien, filtre par copropriété toujours visible ;
// - détail : coordonnées cliquables, changement de statut (PATCH) répercuté sur la liste et les indicateurs ;
// - nouvelle copropriété (POST) : carte ajoutée ; e-mails invalides refusés avant tout appel ;
// - base non initialisée : message avec la migration et bouton Réessayer ;
// - qualité du déclarant et « même problème que le signalement n° X » dans le détail et la liste ;
// - copropriété sans adresse : dernière adresse proposée d'après la position d'un déclarant, « Utiliser cette
//   adresse » (PATCH { adresse }) ; rien pour une copropriété dont l'adresse est renseignée.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import TableauSignalementsQr from '@/components/aj-signalement/TableauSignalementsQr'
import { TEXTES_TABLEAU_QR as T, dateHeureParis } from '@/lib/aj-signalement/affichage'
import type { VueEspaceQr } from '@/lib/aj-signalement/acces-espace'
import { remplir } from '@/lib/coproprietaire/textes'
import { gestionCoproprieteQrVide, type SignalementQr, type TableauQr } from '@/lib/aj-signalement/types'

const JETON = '0123456789abcdef0123456789abcdef'
const ID_COPRO = 'c0000000-0000-4000-8000-000000000001'
const ID_COPRO_2 = 'c0000000-0000-4000-8000-000000000002'

const marie: SignalementQr = {
  id: '5f2c9a1e-1111-4222-8333-444444444444', coproprieteId: ID_COPRO, coproprieteNom: 'Parc Belle Ombre',
  prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie@example.com', batiment: 'B', etage: '4', numLot: '12',
  estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier',
  priorite: 'urgente', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: '2026-11-04T14:05:10.000Z', emailErreur: null,
  confirmationEnvoyeeLe: '2026-11-04T14:05:12.000Z', confirmationErreur: null,
  qualiteDeclarant: 'locataire', adresseProposee: '1 Quai du Port 13002 Marseille', signalementLieId: '1a2b3c4d-0000-4000-8000-000000000001',
  creeLe: '2026-11-04T14:05:00.000Z', misAJourLe: '2026-11-04T14:05:00.000Z',
}
const paul: SignalementQr = {
  ...marie, id: '6a000000-0000-4000-8000-000000000002', coproprieteId: ID_COPRO_2, coproprieteNom: 'Les Oliviers',
  prenom: 'Paul', nom: 'Martin', telephone: '04 91 00 00 00', email: 'paul@example.com', batiment: '', etage: '1', numLot: '3',
  estPartieCommune: true, zoneSignalee: 'Hall d’entrée', typeIntervention: 'Ascenseur', description: 'Ascenseur bloqué',
  priorite: 'normale', statut: 'terminee', emailEnvoyeLe: null, emailErreur: 'RESEND_API_KEY not configured',
  confirmationEnvoyeeLe: null, confirmationErreur: 'limite atteinte pour cette adresse',
  qualiteDeclarant: null, adresseProposee: '', signalementLieId: null,
  creeLe: '2026-11-03T08:59:00.000Z', misAJourLe: '2026-11-03T12:00:00.000Z',
}

function tableau(): TableauQr {
  return {
    coproprietes: [
      {
        id: ID_COPRO, nom: 'Parc Belle Ombre', adresse: '', jeton: JETON, emailsDestinataires: [], actif: true, creeLe: '2026-11-04T10:00:00.000Z', nbSignalements: 1, nbEnAttente: 1,
        derniereAdresseProposee: { adresse: '1 Quai du Port 13002 Marseille', le: '2026-11-04T14:05:00.000Z' }, ...gestionCoproprieteQrVide(),
      },
      {
        id: ID_COPRO_2, nom: 'Les Oliviers', adresse: 'Aubagne', jeton: 'f'.repeat(32), emailsDestinataires: ['o@example.com'], actif: true, creeLe: '2026-11-04T11:00:00.000Z', nbSignalements: 1, nbEnAttente: 0,
        derniereAdresseProposee: null, ...gestionCoproprieteQrVide(),
      },
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
const lignes = () => within(screen.getByRole('list')).getAllByRole('listitem')
const appelsTableau = () => appels.filter((a) => a.url === '/api/aj-signalement/tableau')

/** Monte le tableau sur une vue, attend la fin du chargement ; `afficher` change de vue sur la même instance. */
async function rendrePret(vue: VueEspaceQr, routeur: (appel: Appel) => Response = () => json({ tableau: tableau() }), jeton: string | null = 'jeton') {
  simulerFetch(routeur)
  const { rerender } = render(<TableauSignalementsQr jeton={jeton} vue={vue} />)
  await waitFor(() => expect(screen.getByRole('button', { name: T.mettreAJour })).toBeInTheDocument())
  return { afficher: (autre: VueEspaceQr) => rerender(<TableauSignalementsQr jeton={jeton} vue={autre} />) }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('chargement et vues', () => {
  it('un seul appel (avec le jeton) pour les trois vues ; chaque vue n’affiche que sa partie', async () => {
    const { afficher } = await rendrePret('tableau-de-bord')
    expect(appels[0].url).toBe('/api/aj-signalement/tableau')
    expect((appels[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer jeton')

    // Tableau de bord : présentation, indicateurs, puis la liste de tous les signalements reçus (11/11/2026).
    expect(screen.getByText(T.intro)).toBeInTheDocument()
    expect(within(indicateurs()).getByText(T.kpis.recus).parentElement).toHaveTextContent('2')
    expect(within(indicateurs()).getByText(T.kpis.aTraiter).parentElement).toHaveTextContent('1')
    expect(within(indicateurs()).getByText(T.kpis.resolus).parentElement).toHaveTextContent('1')
    expect(screen.queryByRole('heading', { name: 'Parc Belle Ombre' })).toBeNull()
    expect(lignes()).toHaveLength(2)

    // Copropriétés : cartes (lien, QR code, destinataires, compteurs).
    afficher('coproprietes')
    // Cartes dans un groupe nommé natif (fieldset, rôle group) qui ne s'élargit pas au-delà de sa colonne (min-w-0).
    const groupe = screen.getByRole('group', { name: T.coproprietes })
    expect(groupe.tagName).toBe('FIELDSET')
    expect(groupe).toHaveClass('grid', 'min-w-0', 'gap-4')
    expect(within(groupe).getByRole('heading', { name: 'Parc Belle Ombre' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Parc Belle Ombre' })).toBeInTheDocument()
    expect(screen.getByText(lienPublic())).toBeInTheDocument()
    expect(screen.getByText(T.destinatairesDefaut, { exact: false })).toBeInTheDocument()
    expect(screen.getByText('o@example.com', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('1 signalement · 1 à traiter')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('img', { name: 'QR code de la copropriété Parc Belle Ombre' })).toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: T.affichePdf })[0]).toBeEnabled()
    expect(screen.queryByRole('region', { name: T.indicateurs })).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()

    // Signalements : liste du plus récent au plus ancien.
    afficher('signalements')
    expect(lignes()).toHaveLength(2)
    expect(lignes()[0]).toHaveTextContent('Marie Durand')
    expect(lignes()[0]).toHaveTextContent('Urgent')
    expect(lignes()[0]).toHaveTextContent('À traiter')
    expect(lignes()[0]).toHaveTextContent('Logement (bât. B, étage 4, lot 12)')
    expect(lignes()[1]).toHaveTextContent('Paul Martin')
    expect(lignes()[1]).toHaveTextContent('Parties communes — Hall d’entrée')
    expect(lignes()[1]).toHaveTextContent('Résolu')
    expect(screen.queryByRole('heading', { name: 'Parc Belle Ombre' })).toBeNull()

    expect(appelsTableau()).toHaveLength(1)
  })

  it('filtre par copropriété', async () => {
    await rendrePret('signalements')
    fireEvent.change(screen.getByLabelText(T.filtrerCopro), { target: { value: ID_COPRO_2 } })
    expect(lignes()).toHaveLength(1)
    expect(lignes()[0]).toHaveTextContent('Paul Martin')
  })

  it('filtre visible même avec une seule copropriété', async () => {
    const seule: TableauQr = { coproprietes: [tableau().coproprietes[0]], signalements: [marie] }
    await rendrePret('signalements', () => json({ tableau: seule }))
    const filtre = screen.getByLabelText(T.filtrerCopro)
    expect(within(filtre).getAllByRole('option').map((o) => o.textContent)).toEqual([T.toutesCopros, 'Parc Belle Ombre'])
  })

  it('changement de vue (bouton Retour du navigateur) : la fenêtre de détail ouverte se ferme', async () => {
    const { afficher } = await rendrePret('signalements')
    fireEvent.click(within(lignes()[0]).getByRole('button', { name: T.voirDetail }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    afficher('tableau-de-bord')
    expect(screen.queryByRole('dialog')).toBeNull()
    // Revenir à la vue ne la rouvre pas.
    afficher('signalements')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    ['création', () => fireEvent.click(screen.getByRole('button', { name: T.ajouterCopro }))],
    ['modification', () => fireEvent.click(screen.getAllByRole('button', { name: T.modifier })[0])],
  ])('changement de vue : la fenêtre de %s ouverte se ferme', async (_cas, ouvrirFenetre) => {
    const { afficher } = await rendrePret('coproprietes')
    ouvrirFenetre()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    afficher('signalements')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('changement de vue : le message de succès (« Adresse enregistrée ») ne réapparaît pas au retour', async () => {
    const { afficher } = await rendrePret('coproprietes', (appel) => (appel.init?.method === 'PATCH'
      ? json({ copropriete: { ...tableau().coproprietes[0], adresse: '1 Quai du Port 13002 Marseille', nbSignalements: 0, nbEnAttente: 0, derniereAdresseProposee: null } })
      : json({ tableau: tableau() })))
    fireEvent.click(screen.getByRole('button', { name: T.utiliserAdresse }))
    await waitFor(() => expect(screen.getByText(T.adresseEnregistree)).toBeInTheDocument())
    afficher('signalements')
    afficher('coproprietes')
    expect(screen.queryByText(T.adresseEnregistree)).toBeNull()
    // L'adresse enregistrée, elle, reste.
    expect(screen.getByText('1 Quai du Port 13002 Marseille')).toBeInTheDocument()
  })

  it('même vue rendue à nouveau : la fenêtre ouverte reste', async () => {
    const { afficher } = await rendrePret('signalements')
    fireEvent.click(within(lignes()[0]).getByRole('button', { name: T.voirDetail }))
    afficher('signalements')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('base non initialisée : message avec la migration, bouton Réessayer ; sans jeton, les cookies suffisent', async () => {
    simulerFetch(() => json({ error: 'base_absente' }, 503))
    render(<TableauSignalementsQr jeton={null} vue="tableau-de-bord" />)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('20261104_signalements_qr.sql'))
    expect((appels[0].init?.headers as Record<string, string>).Authorization).toBeUndefined()
    simulerFetch(() => json({ tableau: tableau() }))
    fireEvent.click(screen.getByRole('button', { name: T.reessayer }))
    await waitFor(() => expect(screen.getByRole('region', { name: T.indicateurs })).toBeInTheDocument())
  })

  it('compte marqué super admin mais refusé par le serveur (403) : message « interdit », aucune donnée', async () => {
    simulerFetch(() => json({ error: 'interdit' }, 403))
    render(<TableauSignalementsQr jeton={null} vue="signalements" />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(T.erreurs.interdit))
    expect(screen.queryByRole('list')).toBeNull()
  })
})

describe('tableau de bord : liste de tous les signalements reçus sous les indicateurs (Hugo, 11/11/2026)', () => {
  const regionListe = () => screen.getByRole('region', { name: T.signalements })
  const valeur = (libelle: string) => within(indicateurs()).getByText(libelle).previousElementSibling?.textContent
  const filtre = () => within(regionListe()).getByLabelText(T.filtrerCopro)

  it('sous les quatre carrés : section « Signalements reçus » (h2), toutes les lignes du plus récent au plus ancien, filtre par copropriété', async () => {
    await rendrePret('tableau-de-bord')
    const region = regionListe()
    expect(region.tagName).toBe('SECTION')
    expect(within(region).getByRole('heading', { level: 2, name: T.signalements })).toBeInTheDocument()
    // Placée après les quatre carrés dans l'ordre du document (lecteur d'écran, téléphone).
    expect(indicateurs().compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(region).getByRole('list', { name: T.signalements })).toBeInTheDocument()
    expect(lignes()).toHaveLength(2)
    expect(lignes()[0]).toHaveTextContent('Marie Durand')
    expect(lignes()[0]).toHaveTextContent('Urgent')
    expect(lignes()[0]).toHaveTextContent('Même problème que le signalement n° 1A2B3C4D')
    expect(lignes()[1]).toHaveTextContent('Paul Martin')
    expect(lignes()[1]).toHaveTextContent('Résolu')
    expect(within(filtre()).getAllByRole('option').map((o) => o.textContent)).toEqual([T.toutesCopros, 'Parc Belle Ombre', 'Les Oliviers'])
    // Aucun h1 dans le contenu : le seul h1 est dans l'en-tête de l'espace.
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0)
  })

  it('filtre : les lignes ET les carrés ne comptent que la copropriété choisie (demande de Hugo du 11/11/2026)', async () => {
    await rendrePret('tableau-de-bord')
    expect([valeur(T.kpis.recus), valeur(T.kpis.aTraiter), valeur(T.kpis.enCours), valeur(T.kpis.resolus)]).toEqual(['2', '1', '0', '1'])
    fireEvent.change(filtre(), { target: { value: ID_COPRO_2 } })
    expect(lignes()).toHaveLength(1)
    expect(lignes()[0]).toHaveTextContent('Paul Martin')
    expect([valeur(T.kpis.recus), valeur(T.kpis.aTraiter), valeur(T.kpis.enCours), valeur(T.kpis.resolus)]).toEqual(['1', '0', '0', '1'])
    fireEvent.change(filtre(), { target: { value: '' } })
    expect([valeur(T.kpis.recus), valeur(T.kpis.aTraiter), valeur(T.kpis.enCours), valeur(T.kpis.resolus)]).toEqual(['2', '1', '0', '1'])
    expect(lignes()).toHaveLength(Number(valeur(T.kpis.recus)))
  })

  it('« Voir le détail » depuis le tableau de bord : même fenêtre ; un statut changé met à jour carrés et ligne ensemble', async () => {
    await rendrePret('tableau-de-bord', (appel) => (appel.init?.method === 'PATCH'
      ? json({ signalement: { id: marie.id, statut: 'acceptee', misAJourLe: '2026-11-04T15:00:00.000Z' } })
      : json({ tableau: tableau() })))
    fireEvent.click(within(lignes()[0]).getByRole('button', { name: T.voirDetail }))
    const dialogue = screen.getByRole('dialog')
    expect(dialogue).toHaveTextContent('Fuite sous l’évier')
    expect(within(dialogue).getByRole('link', { name: '06 12 34 56 78' })).toHaveAttribute('href', 'tel:0612345678')
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Prendre en charge' }))
    await waitFor(() => expect(within(dialogue).getByRole('button', { name: 'Intervention en cours' })).toBeInTheDocument())
    fireEvent.click(within(dialogue).getByRole('button', { name: T.detail.fermer }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(lignes()[0]).toHaveTextContent('Pris en charge')
    expect([valeur(T.kpis.recus), valeur(T.kpis.aTraiter), valeur(T.kpis.enCours), valeur(T.kpis.resolus)]).toEqual(['2', '0', '1', '1'])
    expect(appelsTableau()).toHaveLength(1)
  })

  it('filtre partagé avec la vue Signalements (dans les deux sens), toujours un seul chargement', async () => {
    const { afficher } = await rendrePret('tableau-de-bord')
    fireEvent.change(filtre(), { target: { value: ID_COPRO_2 } })
    afficher('signalements')
    expect(screen.getByLabelText(T.filtrerCopro)).toHaveValue(ID_COPRO_2)
    expect(lignes()).toHaveLength(1)
    fireEvent.change(screen.getByLabelText(T.filtrerCopro), { target: { value: ID_COPRO } })
    afficher('tableau-de-bord')
    expect(filtre()).toHaveValue(ID_COPRO)
    expect(lignes()).toHaveLength(1)
    expect(lignes()[0]).toHaveTextContent('Marie Durand')
    afficher('coproprietes')
    afficher('tableau-de-bord')
    expect(appelsTableau()).toHaveLength(1)
  })

  it('aucun signalement : « Aucun signalement reçu pour le moment. » sous les carrés ; copropriété sans signalement : message du filtre', async () => {
    const vide: TableauQr = { coproprietes: tableau().coproprietes, signalements: [] }
    await rendrePret('tableau-de-bord', () => json({ tableau: vide }))
    expect(within(regionListe()).getByText(T.aucunSignalement)).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
    fireEvent.change(filtre(), { target: { value: ID_COPRO } })
    expect(within(regionListe()).getByText(T.aucunSignalementFiltre)).toBeInTheDocument()
  })
})

describe('détail d’un signalement', () => {
  it('coordonnées cliquables, e-mail non envoyé signalé, changement de statut répercuté dans toutes les vues', async () => {
    const { afficher } = await rendrePret('signalements', (appel) => (appel.init?.method === 'PATCH'
      ? json({ signalement: { id: marie.id, statut: 'acceptee', misAJourLe: '2026-11-04T15:00:00.000Z' } })
      : json({ tableau: tableau() })))
    fireEvent.click(within(lignes()[0]).getByRole('button', { name: T.voirDetail }))
    const dialogue = screen.getByRole('dialog')
    expect(within(dialogue).getByRole('link', { name: '06 12 34 56 78' })).toHaveAttribute('href', 'tel:0612345678')
    expect(within(dialogue).getByRole('link', { name: 'marie@example.com' })).toHaveAttribute('href', 'mailto:marie@example.com')
    expect(dialogue).toHaveTextContent('Fuite sous l’évier')
    expect(dialogue).toHaveTextContent('Signalement 5F2C9A1E')
    expect(dialogue).toHaveTextContent('Confirmation envoyée au déclarant le 4 novembre 2026 à 15:05.')

    fireEvent.click(within(dialogue).getByRole('button', { name: 'Prendre en charge' }))
    await waitFor(() => expect(within(dialogue).getByRole('button', { name: 'Intervention en cours' })).toBeInTheDocument())
    const patch = appels.find((a) => a.init?.method === 'PATCH')
    expect(patch?.url).toBe(`/api/aj-signalement/signalements/${marie.id}`)
    // PR 2 (point 7.17 du plan) : le statut affiché part aussi depuis l'écran du super admin (409 si changé entre-temps).
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ statut: 'acceptee', statutAttendu: 'en_attente' })

    fireEvent.click(within(dialogue).getByRole('button', { name: T.detail.fermer }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(lignes()[0]).toHaveTextContent('Pris en charge')
    afficher('tableau-de-bord')
    expect(within(indicateurs()).getByText(T.kpis.aTraiter).parentElement).toHaveTextContent('0')
    // Les deux copropriétés ont désormais un signalement sans rien à traiter.
    afficher('coproprietes')
    expect(screen.getAllByText('1 signalement')).toHaveLength(2)
    expect(appelsTableau()).toHaveLength(1)
  })

  it('e-mail non envoyé : l’erreur est rappelée dans la fiche, comme celle de la confirmation au déclarant', async () => {
    await rendrePret('signalements')
    fireEvent.click(within(lignes()[1]).getByRole('button', { name: T.voirDetail }))
    expect(screen.getByRole('dialog')).toHaveTextContent('E-mail non envoyé : RESEND_API_KEY not configured')
    expect(screen.getByRole('dialog')).toHaveTextContent('Confirmation non envoyée au déclarant : limite atteinte pour cette adresse.')
  })

  it('PR 2 : statut changé entre-temps (409 conflit_statut) : message dans la fiche, tableau rechargé, fiche gardée ouverte', async () => {
    await rendrePret('signalements', (appel) => (appel.init?.method === 'PATCH' ? json({ error: 'conflit_statut' }, 409) : json({ tableau: tableau() })))
    fireEvent.click(within(lignes()[0]).getByRole('button', { name: T.voirDetail }))
    const dialogue = screen.getByRole('dialog')
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Prendre en charge' }))
    expect(await within(screen.getByRole('dialog')).findByText(T.detail.conflitStatut)).toBeInTheDocument()
    await waitFor(() => expect(appelsTableau()).toHaveLength(2))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('copropriétés', () => {
  it('ajoute une copropriété : POST puis nouvelle carte avec son QR code', async () => {
    await rendrePret('coproprietes', (appel) => (appel.init?.method === 'POST'
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
    await rendrePret('coproprietes')
    fireEvent.click(screen.getByRole('button', { name: T.ajouterCopro }))
    const dialogue = screen.getByRole('dialog')
    fireEvent.change(within(dialogue).getByLabelText(T.formulaire.nom), { target: { value: 'Villa Rose' } })
    fireEvent.change(within(dialogue).getByLabelText(T.formulaire.emails), { target: { value: 'pas-un-email, ok@example.com' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: T.formulaire.creerBouton }))
    expect(within(dialogue).getByRole('alert')).toHaveTextContent('pas-un-email')
    expect(appels.filter((a) => a.init?.method === 'POST')).toHaveLength(0)
  })

  it('modifie une copropriété : PATCH avec nom, adresse, destinataires et activation', async () => {
    await rendrePret('coproprietes', (appel) => (appel.init?.method === 'PATCH'
      ? json({ copropriete: { ...tableau().coproprietes[0], nom: 'Parc Belle Ombre (bât. B)', actif: false, nbSignalements: 0, nbEnAttente: 0, derniereAdresseProposee: null } })
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
    // Les compteurs connus sont conservés, comme la dernière adresse proposée tant que l'adresse reste vide.
    expect(screen.getByText('1 signalement · 1 à traiter')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: T.utiliserAdresse })).toBeInTheDocument()
  })
})

describe('qualité du déclarant et signalement lié', () => {
  it('détail : qualité, « même problème que le signalement n° X », adresse proposée ; « Non indiquée » pour un signalement antérieur', async () => {
    await rendrePret('signalements')
    expect(lignes()[0]).toHaveTextContent('Même problème que le signalement n° 1A2B3C4D')
    expect(lignes()[1]).not.toHaveTextContent('Même problème')
    fireEvent.click(within(lignes()[0]).getByRole('button', { name: T.voirDetail }))
    const dialogue = screen.getByRole('dialog')
    expect(within(dialogue).getByText(T.detail.qualite).parentElement).toHaveTextContent('Locataire')
    expect(within(dialogue).getByText(T.detail.signalementLie).parentElement).toHaveTextContent('Même problème que le signalement n° 1A2B3C4D')
    expect(within(dialogue).getByText(T.detail.adresseProposee).parentElement).toHaveTextContent('1 Quai du Port 13002 Marseille')
    fireEvent.click(within(dialogue).getByRole('button', { name: T.detail.fermer }))

    fireEvent.click(within(lignes()[1]).getByRole('button', { name: T.voirDetail }))
    const autre = screen.getByRole('dialog')
    expect(within(autre).getByText(T.detail.qualite).parentElement).toHaveTextContent('Non indiquée')
    expect(within(autre).queryByText(T.detail.signalementLie)).toBeNull()
    expect(within(autre).queryByText(T.detail.adresseProposee)).toBeNull()
  })
})

describe('adresse proposée d’après la position d’un déclarant', () => {
  const texteProposee = remplir(T.derniereAdresseProposee, { date: dateHeureParis('2026-11-04T14:05:00.000Z'), adresse: '1 Quai du Port 13002 Marseille' })
  const carte = (nom: string) => screen.getByRole('heading', { name: nom }).closest('section') as HTMLElement

  it('copropriété sans adresse : dernière adresse proposée (date) et « Utiliser cette adresse » ; rien pour une copropriété qui a une adresse', async () => {
    await rendrePret('coproprietes')
    expect(within(carte('Parc Belle Ombre')).getByText(texteProposee)).toBeInTheDocument()
    expect(within(carte('Parc Belle Ombre')).getByText(T.sansAdresse)).toBeInTheDocument()
    expect(within(carte('Les Oliviers')).queryByRole('button', { name: T.utiliserAdresse })).toBeNull()
    expect(screen.getAllByRole('button', { name: T.utiliserAdresse })).toHaveLength(1)
  })

  it('« Utiliser cette adresse » : PATCH { adresse } puis l’adresse devient celle de la copropriété', async () => {
    await rendrePret('coproprietes', (appel) => (appel.init?.method === 'PATCH'
      ? json({ copropriete: { ...tableau().coproprietes[0], adresse: '1 Quai du Port 13002 Marseille', nbSignalements: 0, nbEnAttente: 0, derniereAdresseProposee: null } })
      : json({ tableau: tableau() })))
    fireEvent.click(within(carte('Parc Belle Ombre')).getByRole('button', { name: T.utiliserAdresse }))
    await waitFor(() => expect(screen.getByText(T.adresseEnregistree)).toBeInTheDocument())
    const patch = appels.find((a) => a.init?.method === 'PATCH')
    expect(patch?.url).toBe(`/api/aj-signalement/coproprietes/${ID_COPRO}`)
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ adresse: '1 Quai du Port 13002 Marseille' })
    expect((patch?.init?.headers as Record<string, string>).Authorization).toBe('Bearer jeton')
    expect(within(carte('Parc Belle Ombre')).getByText('1 Quai du Port 13002 Marseille')).toBeInTheDocument()
    expect(within(carte('Parc Belle Ombre')).queryByText(T.sansAdresse)).toBeNull()
    expect(screen.queryByRole('button', { name: T.utiliserAdresse })).toBeNull()
    // Les compteurs connus sont conservés.
    expect(screen.getByText('1 signalement · 1 à traiter')).toBeInTheDocument()
  })

  it('enregistrement refusé : erreur dans la carte, l’adresse proposée reste', async () => {
    await rendrePret('coproprietes', (appel) => (appel.init?.method === 'PATCH' ? json({ error: 'interdit' }, 403) : json({ tableau: tableau() })))
    fireEvent.click(within(carte('Parc Belle Ombre')).getByRole('button', { name: T.utiliserAdresse }))
    await waitFor(() => expect(within(carte('Parc Belle Ombre')).getByRole('alert')).toHaveTextContent(T.erreurAdresse))
    expect(within(carte('Parc Belle Ombre')).getByText(texteProposee)).toBeInTheDocument()
    expect(within(carte('Parc Belle Ombre')).getByRole('button', { name: T.utiliserAdresse })).toBeEnabled()
  })
})
