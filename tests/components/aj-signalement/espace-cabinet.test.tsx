// tests/components/aj-signalement/espace-cabinet.test.tsx
//
// PR 2, lot 5 : écrans de l'espace d'un cabinet (vitfix.io/<identifiant>/suivi/), vus par un gestionnaire connecté (SPEC
// § 2.8, décisions de Hugo du 11/11/2026). Remplace la partie connectée de l'E2E (la base n'existe pas en CI) : toutes
// les réponses des routes sont simulées, sous la forme que le serveur leur donne pour un gestionnaire (minimisées).
//   - chargement : GET /moi (profil et cabinet de la session) puis GET /tableau ; aucune route du super admin ;
//     403 acces_retire → « Votre accès a été retiré par le cabinet. » et « Se déconnecter » ; 503 → « Fonction pas
//     encore activée. » ; réseau → toast « Connexion impossible, réessayez. » ;
//   - coquille : nom du cabinet sous « AJ Signalement », menu Tableau de bord · Copropriétés · Signalements ;
//   - tableau de bord : 4 carrés (reçus / à traiter / en cours / résolus) qui SUIVENT le filtre par copropriété, puis la
//     liste ;
//   - copropriétés : « Créée par vous », « Commune à tous les gestionnaires » sans « Modifier » (fiche modifiable par le
//     cabinet seulement), désactivée en bas sans QR code, adresses du cabinet masquées comptées ; ni import, ni filtre des
//     gestionnaires, ni bloc des gestionnaires ;
//   - « Ajouter une copropriété » : fenêtre du gestionnaire (champs obligatoires, domaines du cabinet), corps strict,
//     « Copropriété créée. Elle vous est attribuée. » puis la carte et son QR ; doublons ; modification des seuls champs
//     changés ; 403 lecture_seule ;
//   - statut : le statut affiché part avec la demande (statutAttendu) ; 409 → « Le statut a été changé entre-temps » et
//     rechargement ; auteur du changement sans nom (vous, un collègue, le cabinet).
// Données fictives (exemple.test, externe.test).

import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXTES_TABLEAU_QR as T } from '@/lib/aj-signalement/affichage'
import { TEXTES_ESPACE_CABINET_QR as E } from '@/lib/aj-signalement/affichage-gestionnaire'
import { remplir } from '@/lib/coproprietaire/textes'
import { gestionCoproprieteQrVide, type CoproprieteQr, type SignalementQr, type TableauQr } from '@/lib/aj-signalement/types'

type Rappel = (evenement: string, session: unknown) => void

const simul = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
  toastErreur: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: simul.getUser,
      signOut: simul.signOut,
      onAuthStateChange: (_rappel: Rappel) => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))
vi.mock('sonner', () => ({ toast: { error: simul.toastErreur, success: vi.fn() } }))

const { default: EspaceAjSignalement } = await import('@/components/aj-signalement/espace/EspaceAjSignalement')

const CABINET_PAGE = { identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple' }
const RESUME = { id: 'ca000000-0000-4000-8000-000000000001', nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }
const C1 = 'c0000000-0000-4000-8000-000000000001'
const C_TOUS = 'c0000000-0000-4000-8000-000000000003'
const C_OFF = 'c0000000-0000-4000-8000-000000000007'
const C_CREE = 'c0000000-0000-4000-8000-000000000101'
const S1 = '5f000000-0000-4000-8000-000000000001'
const S_TOUS = '5f000000-0000-4000-8000-000000000003'
const S_RESOLU = '5f000000-0000-4000-8000-000000000009'

const copro = (id: string, nom: string, sur: Partial<CoproprieteQr> = {}): CoproprieteQr => ({
  id, nom, adresse: '1 rue Exemple', jeton: '0123456789abcdef0123456789abcdef', emailsDestinataires: [], actif: true, creeLe: '2026-11-01T09:00:00.000Z',
  nbSignalements: 1, nbEnAttente: 1, derniereAdresseProposee: null, ...gestionCoproprieteQrVide(), cabinet: RESUME, codePostal: '13001', ville: 'Marseille',
  creePar: 'administrateur', modifiable: true, adressesMasquees: 0, creeeParVous: false, ...sur,
})

const signalement = (id: string, coproprieteId: string, coproprieteNom: string, sur: Partial<SignalementQr> = {}): SignalementQr => ({
  id, coproprieteId, coproprieteNom, prenom: 'Prénom', nom: 'Déclarant', telephone: '06 00 00 00 00', email: 'declarant@exemple.test',
  batiment: 'A', etage: '1', numLot: '7', estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Plomberie', description: 'Fuite d’eau',
  priorite: 'normale', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: '2026-11-10T09:30:00.000Z', emailErreur: null,
  confirmationEnvoyeeLe: null, confirmationErreur: null, qualiteDeclarant: 'locataire', adresseProposee: '', signalementLieId: null,
  creeLe: '2026-11-10T09:00:00.000Z', misAJourLe: '2026-11-10T09:00:00.000Z', statutModifiePar: null, ...sur,
})

/** Tableau tel que le serveur le rend à un gestionnaire : sa portée seule, minimisée (aucun collègue nommé). */
const tableau = (): TableauQr => ({
  coproprietes: [
    copro(C_OFF, 'Résidence Fermée', { actif: false, jeton: '', modifiable: false, nbSignalements: 0, nbEnAttente: 0 }),
    copro(C1, 'Résidence Une', { emailsDestinataires: ['cs-une@externe.test'] }),
    copro(C_TOUS, 'Résidence Test', { attribueeATous: true, modifiable: false, emailsDestinataires: ['cs@externe.test'], adressesMasquees: 1 }),
  ],
  signalements: [
    signalement(S1, C1, 'Résidence Une', { creeLe: '2026-11-10T09:03:00.000Z' }),
    signalement(S_TOUS, C_TOUS, 'Résidence Test', { statut: 'acceptee', statutModifiePar: 'collegue', creeLe: '2026-11-10T09:02:00.000Z' }),
    signalement(S_RESOLU, C1, 'Résidence Une', { statut: 'terminee', creeLe: '2026-11-10T09:01:00.000Z' }),
  ],
})

const MOI = { profil: 'gestionnaire', nom: 'Marie Exemple', cabinet: { identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple', domaines: ['exemple.test'] } }

type Appel = { url: string; methode: string; corps: unknown }
let appels: Appel[] = []
type Routeur = (appel: Appel) => Response | undefined
let routeur: Routeur = () => undefined

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

function reponseParDefaut(appel: Appel): Response {
  if (appel.url === '/api/aj-signalement/moi') return json(MOI)
  if (appel.url === '/api/aj-signalement/tableau') return json({ tableau: tableau() })
  return json({ error: 'interdit' }, 403)
}

const appelsVers = (debut: string, methode = 'GET') => appels.filter((a) => a.url.startsWith(debut) && a.methode === methode)

beforeEach(() => {
  vi.clearAllMocks()
  appels = []
  routeur = () => undefined
  simul.signOut.mockResolvedValue({ error: null })
  simul.getUser.mockResolvedValue({
    data: { user: { id: 'u1', email: 'marie.exemple@exemple.test', app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'cabinet-exemple' }, user_metadata: {} } },
    error: null,
  })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const appel = { url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) : null }
    appels.push(appel)
    return routeur(appel) ?? reponseParDefaut(appel)
  }))
  window.history.replaceState(null, '', '/cabinet-exemple/suivi/')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const menuLateral = () => screen.getAllByRole('navigation', { name: 'Menu AJ Signalement' })[0]
const titre = () => screen.getByRole('heading', { level: 1 })
const indicateurs = () => screen.getByRole('region', { name: T.indicateurs })
const valeurCarre = (libelle: string) => within(indicateurs()).getByText(libelle).parentElement?.textContent?.replace(libelle, '')
const carte = (nom: string) => screen.getByRole('heading', { level: 2, name: nom }).closest('section') as HTMLElement

// Dernière passe du 12/11/2026 : le premier rendu du fichier (React, jsdom et les requêtes par rôle, à froid) prend déjà
// environ 1,2 s seul, et davantage quand la suite tourne en parallèle. Avec le délai par défaut de waitFor (1 s), le
// premier test échouait sous charge (8 sur 8 lancés ensemble). Le premier affichage de l'espace a donc 5 s, comme dans
// tests/components/admin-dashboard-cartes-copro.test.tsx ; les attentes suivantes gardent le délai par défaut.
const PREMIER_RENDU = { timeout: 5000 }

async function ouvrir(vue: 'Tableau de bord' | 'Copropriétés' | 'Signalements' = 'Tableau de bord') {
  render(<EspaceAjSignalement cabinet={CABINET_PAGE} />)
  await waitFor(() => expect(titre()).toHaveTextContent('Tableau de bord'), PREMIER_RENDU)
  await waitFor(() => expect(indicateurs()).toBeInTheDocument(), PREMIER_RENDU)
  if (vue !== 'Tableau de bord') {
    fireEvent.click(within(menuLateral()).getByRole('link', { name: vue }))
    await waitFor(() => expect(titre()).toHaveTextContent(vue), PREMIER_RENDU)
  }
}

describe('chargement et coquille', () => {
  it('/moi puis /tableau, aucune route du super admin ; nom du cabinet sous « AJ Signalement » ; trois entrées', async () => {
    await ouvrir()
    expect(appels.map((a) => a.url)).toEqual(['/api/aj-signalement/moi', '/api/aj-signalement/tableau'])
    expect(screen.getByRole('banner')).toHaveTextContent('Cabinet Exemple')
    expect(within(menuLateral()).getAllByRole('link').map((e) => e.textContent)).toEqual(['Tableau de bord', 'Copropriétés', 'Signalements'])
    expect(screen.queryByRole('link', { name: 'Panneau admin' })).toBeNull()
  })

  it('403 acces_retire (fiche désactivée ou bloquée) : message, « Se déconnecter », aucun tableau', async () => {
    routeur = (a) => (a.url === '/api/aj-signalement/moi' ? json({ error: 'acces_retire' }, 403) : undefined)
    render(<EspaceAjSignalement cabinet={CABINET_PAGE} />)
    expect(await screen.findByText('Votre accès a été retiré par le cabinet.', undefined, PREMIER_RENDU)).toBeInTheDocument()
    // Relecture du lot 6 (accessibilité) : un titre de page, même sur un état pleine page (lu, non affiché).
    expect(titre()).toHaveTextContent('AJ Signalement')
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(appelsVers('/api/aj-signalement/tableau')).toEqual([])
  })

  it('503 base_absente : « Fonction pas encore activée. » et Réessayer, qui relit /moi', async () => {
    routeur = (a) => (a.url === '/api/aj-signalement/moi' ? json({ error: 'base_absente' }, 503) : undefined)
    render(<EspaceAjSignalement cabinet={CABINET_PAGE} />)
    expect(await screen.findByText('Fonction pas encore activée.', undefined, PREMIER_RENDU)).toBeInTheDocument()
    expect(titre()).toHaveTextContent('AJ Signalement')
    routeur = () => undefined
    fireEvent.click(screen.getByRole('button', { name: T.reessayer }))
    await waitFor(() => expect(titre()).toHaveTextContent('Tableau de bord'), PREMIER_RENDU)
    expect(appelsVers('/api/aj-signalement/moi')).toHaveLength(2)
  })

  it('réseau coupé : toast « Connexion impossible, réessayez. » et message à l’écran', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    routeur = (a) => {
      if (a.url === '/api/aj-signalement/moi') throw new TypeError('Failed to fetch')
      return undefined
    }
    render(<EspaceAjSignalement cabinet={CABINET_PAGE} />)
    expect(await screen.findByText('Connexion impossible, réessayez.', undefined, PREMIER_RENDU)).toBeInTheDocument()
    expect(simul.toastErreur).toHaveBeenCalledWith('Connexion impossible, réessayez.')
  })

  it('accès retiré en cours de route (tableau 403 acces_retire) : le même message', async () => {
    routeur = (a) => (a.url === '/api/aj-signalement/tableau' ? json({ error: 'acces_retire' }, 403) : undefined)
    render(<EspaceAjSignalement cabinet={CABINET_PAGE} />)
    expect(await screen.findByText('Votre accès a été retiré par le cabinet.', undefined, PREMIER_RENDU)).toBeInTheDocument()
  })
})

describe('tableau de bord', () => {
  it('quatre carrés sur sa portée, qui suivent le filtre par copropriété ; la liste a autant de lignes que « Reçus »', async () => {
    await ouvrir()
    expect(valeurCarre(T.kpis.recus)).toBe('3')
    expect(valeurCarre(T.kpis.aTraiter)).toBe('1')
    expect(valeurCarre(T.kpis.resolus)).toBe('1')
    const filtre = screen.getByRole('combobox', { name: T.filtrerCopro })
    expect(within(filtre).getAllByRole('option').map((o) => o.textContent)).toEqual([T.toutesCopros, 'Résidence Fermée', 'Résidence Une', 'Résidence Test'])
    fireEvent.change(filtre, { target: { value: C_TOUS } })
    expect(valeurCarre(T.kpis.recus)).toBe('1')
    expect(valeurCarre(T.kpis.aTraiter)).toBe('0')
    expect(valeurCarre(T.kpis.enCours)).toBe('1')
    expect(within(screen.getByRole('list', { name: T.signalements })).getAllByRole('listitem')).toHaveLength(1)
  })
})

describe('statut d’un signalement', () => {
  const ouvrirDetail = async (index: number) => {
    await ouvrir('Signalements')
    fireEvent.click(within(within(screen.getByRole('list', { name: T.signalements })).getAllByRole('listitem')[index]).getByRole('button', { name: T.voirDetail }))
    return screen.getByRole('dialog')
  }

  it('auteur sans nom (« un collègue ») ; le changement part avec le statut affiché, puis « par vous »', async () => {
    const commune = await ouvrirDetail(1)
    expect(commune).toHaveTextContent('Statut modifié par un collègue')
    expect(commune).not.toHaveTextContent('Paul')
    fireEvent.click(within(commune).getByRole('button', { name: T.detail.fermer }))

    routeur = (a) => (a.methode === 'PATCH' ? json({ signalement: { id: S1, statut: 'acceptee', misAJourLe: '2026-11-10T10:00:00.000Z' } }) : undefined)
    fireEvent.click(within(within(screen.getByRole('list', { name: T.signalements })).getAllByRole('listitem')[0]).getByRole('button', { name: T.voirDetail }))
    const dialogue = screen.getByRole('dialog')
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Prendre en charge' }))
    await waitFor(() => expect(dialogue).toHaveTextContent('Statut modifié par vous'))
    const patch = appelsVers(`/api/aj-signalement/signalements/${S1}`, 'PATCH')
    expect(patch.map((a) => a.corps)).toEqual([{ statut: 'acceptee', statutAttendu: 'en_attente' }])
  })

  it('409 conflit_statut : « Le statut a été changé entre-temps », tableau rechargé', async () => {
    const dialogue = await ouvrirDetail(0)
    routeur = (a) => (a.methode === 'PATCH' ? json({ error: 'conflit_statut' }, 409) : undefined)
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Prendre en charge' }))
    expect(await within(dialogue).findByText(/Le statut a été changé entre-temps/)).toBeInTheDocument()
    await waitFor(() => expect(appelsVers('/api/aj-signalement/tableau')).toHaveLength(2))
  })

  it('aucune erreur technique d’envoi n’est affichée : « E-mail non envoyé. » seulement', async () => {
    routeur = (a) => {
      if (a.url !== '/api/aj-signalement/tableau') return undefined
      const t = tableau()
      t.signalements[0] = { ...t.signalements[0], emailEnvoyeLe: null }
      return json({ tableau: t })
    }
    const dialogue = await ouvrirDetail(0)
    expect(dialogue).toHaveTextContent(E.emailNonEnvoye)
    expect(dialogue).not.toHaveTextContent('E-mail non envoyé : —')
  })
})

describe('copropriétés', () => {
  it('« à tous » sans « Modifier » (fiche modifiable par le cabinet seulement) ; adresses masquées ; désactivée en bas sans QR', async () => {
    await ouvrir('Copropriétés')
    const titres = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titres).toEqual(['Résidence Une', 'Résidence Test', 'Résidence Fermée'])

    const une = carte('Résidence Une')
    expect(within(une).getByRole('button', { name: T.modifier })).toBeInTheDocument()
    expect(une).toHaveTextContent('cs-une@externe.test')

    const commune = carte('Résidence Test')
    expect(within(commune).queryByRole('button', { name: T.modifier })).toBeNull()
    expect(commune).toHaveTextContent(E.copropriete.commune)
    expect(commune).toHaveTextContent(E.copropriete.communeLectureSeule)
    expect(commune).toHaveTextContent(remplir(E.copropriete.adressesMasquees, { n: 1 }))
    await waitFor(() => expect(screen.getByRole('img', { name: 'QR code de la copropriété Résidence Test' })).toBeInTheDocument())

    const fermee = carte('Résidence Fermée')
    expect(fermee).toHaveTextContent(E.copropriete.desactivee)
    expect(within(fermee).queryByRole('img')).toBeNull()
    expect(within(fermee).queryByRole('button', { name: T.affichePdf })).toBeNull()
    expect(within(fermee).queryByRole('button', { name: T.modifier })).toBeNull()
  })

  it('ni import, ni filtre du super admin, ni bloc des gestionnaires, ni créateur nommé', async () => {
    await ouvrir('Copropriétés')
    expect(screen.queryByRole('button', { name: /Importer/ })).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByText(/Gestionnaires :|Tous les gestionnaires|Créée par l’administrateur/)).toBeNull()
  })

  it('« Ajouter une copropriété » : fenêtre du gestionnaire, corps strict, « Copropriété créée. Elle vous est attribuée. » et la carte avec son QR', async () => {
    const creee = copro(C_CREE, 'Résidence Neuve', { creeeParVous: true, nbSignalements: 0, nbEnAttente: 0, emailsDestinataires: ['conseil@exemple.test'] })
    routeur = (a) => (a.methode === 'POST' && a.url === '/api/aj-signalement/coproprietes' ? json({ copropriete: creee }, 201) : undefined)
    await ouvrir('Copropriétés')
    fireEvent.click(screen.getByRole('button', { name: T.ajouterCopro }))
    const fenetre = screen.getByRole('dialog')
    expect(fenetre).toHaveTextContent(remplir(E.formulaire.emailsAide, { domaines: 'exemple.test' }))
    expect(within(fenetre).queryByRole('checkbox')).toBeNull()
    expect(within(fenetre).queryByRole('combobox')).toBeNull()

    // Champs obligatoires : rien ne part.
    fireEvent.click(within(fenetre).getByRole('button', { name: T.formulaire.creerBouton }))
    expect(await within(fenetre).findByText(E.formulaire.champsRequis)).toBeInTheDocument()
    expect(appelsVers('/api/aj-signalement/coproprietes', 'POST')).toEqual([])

    fireEvent.change(within(fenetre).getByLabelText(E.formulaire.nom), { target: { value: 'Résidence Neuve' } })
    fireEvent.change(within(fenetre).getByLabelText(E.formulaire.adresse), { target: { value: '8 avenue Neuve' } })
    fireEvent.change(within(fenetre).getByLabelText(E.formulaire.codePostal), { target: { value: '13002' } })
    fireEvent.change(within(fenetre).getByLabelText(E.formulaire.ville), { target: { value: 'Marseille' } })
    fireEvent.change(within(fenetre).getByLabelText(E.formulaire.batiments), { target: { value: 'A, B, A' } })
    fireEvent.change(within(fenetre).getByLabelText(E.formulaire.emails), { target: { value: 'conseil@exemple.test' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: T.formulaire.creerBouton }))

    expect(await screen.findByText(E.copropriete.creee)).toBeInTheDocument()
    const [post] = appelsVers('/api/aj-signalement/coproprietes', 'POST')
    expect(post.corps).toEqual({
      operationId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
      nom: 'Résidence Neuve', adresse: '8 avenue Neuve', codePostal: '13002', ville: 'Marseille', batiments: ['A', 'B'], emailsDestinataires: ['conseil@exemple.test'],
    })
    expect(within(carte('Résidence Neuve')).getByText(E.copropriete.creeeParVous)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('img', { name: 'QR code de la copropriété Résidence Neuve' })).toBeInTheDocument())
  })

  const remplirCreation = (fenetre: HTMLElement, emails = '') => {
    fireEvent.change(within(fenetre).getByLabelText(E.formulaire.nom), { target: { value: 'Résidence Neuve' } })
    fireEvent.change(within(fenetre).getByLabelText(E.formulaire.adresse), { target: { value: '8 avenue Neuve' } })
    fireEvent.change(within(fenetre).getByLabelText(E.formulaire.codePostal), { target: { value: '13002' } })
    fireEvent.change(within(fenetre).getByLabelText(E.formulaire.ville), { target: { value: 'Marseille' } })
    if (emails) fireEvent.change(within(fenetre).getByLabelText(E.formulaire.emails), { target: { value: emails } })
  }

  it('adresse ajoutée hors des domaines du cabinet : refusée avant l’envoi', async () => {
    await ouvrir('Copropriétés')
    fireEvent.click(screen.getByRole('button', { name: T.ajouterCopro }))
    const fenetre = screen.getByRole('dialog')
    remplirCreation(fenetre, 'cs@externe.test')
    fireEvent.click(within(fenetre).getByRole('button', { name: T.formulaire.creerBouton }))
    expect(await within(fenetre).findByText(remplir(E.formulaire.horsDomaine, { liste: 'cs@externe.test' }))).toBeInTheDocument()
    expect(appelsVers('/api/aj-signalement/coproprietes', 'POST')).toEqual([])
  })

  it('doublon certain hors de sa portée : « existe déjà au cabinet », sans nom ; dans sa portée : « déjà dans vos copropriétés »', async () => {
    routeur = (a) => (a.methode === 'POST' ? json({ error: 'doublon', doublon: { certitude: 'certain', critere: 'nom_code_postal' } }, 409) : undefined)
    await ouvrir('Copropriétés')
    fireEvent.click(screen.getByRole('button', { name: T.ajouterCopro }))
    const fenetre = screen.getByRole('dialog')
    remplirCreation(fenetre)
    fireEvent.click(within(fenetre).getByRole('button', { name: T.formulaire.creerBouton }))
    expect(await within(fenetre).findByText(E.formulaire.doublonCabinet)).toBeInTheDocument()
    expect(within(fenetre).queryByRole('button', { name: E.formulaire.ouiCreer })).toBeNull()

    routeur = (a) => (a.methode === 'POST'
      ? json({ error: 'doublon', doublon: { certitude: 'certain', critere: 'immatriculation', copropriete: { id: C1, nom: 'Résidence Une', ville: 'Marseille' } } }, 409)
      : undefined)
    fireEvent.click(within(fenetre).getByRole('button', { name: T.formulaire.creerBouton }))
    expect(await within(fenetre).findByText(remplir(E.formulaire.doublonVous, { nom: 'Résidence Une' }))).toBeInTheDocument()
  })

  it('doublon probable : la question, puis « Oui, créer » renvoie la même saisie avec confirmerDoublonProbable', async () => {
    let n = 0
    routeur = (a) => {
      if (a.methode !== 'POST') return undefined
      n += 1
      return n === 1
        ? json({ error: 'doublon', doublon: { certitude: 'probable', critere: 'nom' } }, 409)
        : json({ copropriete: copro(C_CREE, 'Résidence Neuve', { creeeParVous: true }) }, 201)
    }
    await ouvrir('Copropriétés')
    fireEvent.click(screen.getByRole('button', { name: T.ajouterCopro }))
    const fenetre = screen.getByRole('dialog')
    remplirCreation(fenetre)
    fireEvent.click(within(fenetre).getByRole('button', { name: T.formulaire.creerBouton }))
    expect(await within(fenetre).findByText(E.formulaire.doublonProbable)).toBeInTheDocument()
    fireEvent.click(within(fenetre).getByRole('button', { name: E.formulaire.ouiCreer }))
    expect(await screen.findByText(E.copropriete.creee)).toBeInTheDocument()
    const posts = appelsVers('/api/aj-signalement/coproprietes', 'POST')
    expect(posts).toHaveLength(2)
    expect(posts[1].corps).toEqual({ ...(posts[0].corps as object), confirmerDoublonProbable: true })
  })

  it('relecture du lot 6 : « Voir cette copropriété » ferme la fenêtre et porte le focus sur sa carte (pas sur « Ajouter »)', async () => {
    routeur = (a) => (a.methode === 'POST'
      ? json({ error: 'doublon', doublon: { certitude: 'certain', critere: 'immatriculation', copropriete: { id: C1, nom: 'Résidence Une', ville: 'Marseille' } } }, 409)
      : undefined)
    await ouvrir('Copropriétés')
    fireEvent.click(screen.getByRole('button', { name: T.ajouterCopro }))
    const fenetre = screen.getByRole('dialog')
    remplirCreation(fenetre)
    fireEvent.click(within(fenetre).getByRole('button', { name: T.formulaire.creerBouton }))
    fireEvent.click(await within(fenetre).findByRole('button', { name: E.formulaire.voirDoublon }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(carte('Résidence Une')))
  })

  it('relecture du lot 6 : doublon probable DANS sa portée : « déjà dans vos copropriétés : <nom> », la question et « Voir cette copropriété »', async () => {
    routeur = (a) => (a.methode === 'POST'
      ? json({ error: 'doublon', doublon: { certitude: 'probable', critere: 'adresse_code_postal', copropriete: { id: C1, nom: 'Résidence Une', ville: 'Marseille' } } }, 409)
      : undefined)
    await ouvrir('Copropriétés')
    fireEvent.click(screen.getByRole('button', { name: T.ajouterCopro }))
    const fenetre = screen.getByRole('dialog')
    remplirCreation(fenetre)
    fireEvent.click(within(fenetre).getByRole('button', { name: T.formulaire.creerBouton }))
    expect(await within(fenetre).findByText(remplir(E.formulaire.doublonProbableVous, { nom: 'Résidence Une' }))).toBeInTheDocument()
    expect(within(fenetre).queryByText(E.formulaire.doublonProbable)).toBeNull()
    expect(within(fenetre).getByRole('button', { name: E.formulaire.voirDoublon })).toBeInTheDocument()
    expect(within(fenetre).getByRole('button', { name: E.formulaire.ouiCreer })).toBeInTheDocument()
  })

  it('« Modifier » (copropriété attribuée) : champs préremplis, seuls les champs changés partent ; 403 lecture_seule → message', async () => {
    routeur = (a) => (a.methode === 'PATCH' ? json({ error: 'lecture_seule' }, 403) : undefined)
    await ouvrir('Copropriétés')
    fireEvent.click(within(carte('Résidence Une')).getByRole('button', { name: T.modifier }))
    const fenetre = screen.getByRole('dialog')
    expect(within(fenetre).getByLabelText(E.formulaire.nom)).toHaveValue('Résidence Une')
    expect(within(fenetre).getByLabelText(E.formulaire.emails)).toHaveValue('cs-une@externe.test')
    fireEvent.change(within(fenetre).getByLabelText(E.formulaire.ville), { target: { value: 'Aubagne' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: T.formulaire.enregistrer }))
    expect(await within(fenetre).findByText(E.copropriete.lectureSeule)).toBeInTheDocument()
    expect(appelsVers(`/api/aj-signalement/coproprietes/${C1}`, 'PATCH').map((a) => a.corps)).toEqual([{ ville: 'Aubagne' }])
  })

  it('modification enregistrée : la carte est mise à jour, message de succès', async () => {
    routeur = (a) => (a.methode === 'PATCH' ? json({ copropriete: copro(C1, 'Résidence Une', { ville: 'Aubagne', emailsDestinataires: ['cs-une@externe.test'] }) }) : undefined)
    await ouvrir('Copropriétés')
    fireEvent.click(within(carte('Résidence Une')).getByRole('button', { name: T.modifier }))
    const fenetre = screen.getByRole('dialog')
    fireEvent.change(within(fenetre).getByLabelText(E.formulaire.ville), { target: { value: 'Aubagne' } })
    await act(async () => { fireEvent.click(within(fenetre).getByRole('button', { name: T.formulaire.enregistrer })) })
    expect(await screen.findByText(E.copropriete.modifiee)).toBeInTheDocument()
    expect(carte('Résidence Une')).toHaveTextContent('13001 Aubagne')
  })
})
