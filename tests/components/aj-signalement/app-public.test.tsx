// tests/components/aj-signalement/app-public.test.tsx
//
// Application publique « AJ Signalement » (page ouverte par le QR code) :
// - nom et adresse de la copropriété, bouton désactivé tant que coordonnées (bâtiment et qualité compris) et
//   parcours sont incomplets ;
// - erreurs de saisie sous le champ quitté (e-mail invalide, champ obligatoire vide, bâtiment compris) ;
// - « Dans mon logement (…) » reprend les coordonnées saisies ;
// - envoi : corps attendu, confirmation avec le numéro, nouveau signalement vide ;
// - parties communes : zone obligatoire et envoyée ;
// - erreur persistante (429, 404), formulaire intact ;
// - géolocalisation (copropriété sans adresse) : phrase d'explication, position demandée une seule fois, adresse
//   proposée affichée et envoyée ; refus, échec ou envoi anticipé jamais bloquants ; aucune demande si l'adresse
//   est connue ;
// - signalements déjà faits au même endroit : liste (date du jour, sans heure), « même problème » (numéro envoyé)
//   ou « autre problème », choix effacé dès que l'endroit change (il ne revient pas au retour au même endroit),
//   apparition de la liste annoncée par une région vivante présente dès le premier rendu, aucune recherche pour un
//   logement.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import AppSignalementQr from '@/components/aj-signalement/AppSignalementQr'
import { TEXTES_SIGNALEMENT_QR } from '@/lib/aj-signalement/textes'
import { remplir, textesCopro } from '@/lib/coproprietaire/textes'

const tq = TEXTES_SIGNALEMENT_QR.fr
const t = textesCopro('fr')
const JETON = '0123456789abcdef0123456789abcdef'

type Appel = { url: string; init?: RequestInit }
let appels: Appel[] = []

function simulerFetch(reponse: (appel: Appel) => Promise<Response>) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const appel = { url, init }
    appels.push(appel)
    return reponse(appel)
  }))
}

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

const REPONSE_OK = { signalement: { id: 'b1c2d3e4-0000-4000-8000-000000000000', numero: 'B1C2D3E4', creeLe: '2026-11-04T14:05:00.000Z', emailEnvoye: true } }
const ADRESSE_PROPOSEE = '1 Quai du Port 13002 Marseille'
const SEMBLABLES = [
  // GET similaires rend le jour (AAAA-MM-JJ), jamais l'heure du dépôt.
  { numero: '1A2B3C4D', typeIntervention: 'Ascenseur', zone: 'Escalier', creeLe: '2026-11-05', statut: 'acceptee' },
  { numero: '5E6F7A8B', typeIntervention: 'Éclairage des parties communes', zone: 'Escalier', creeLe: '2026-11-01', statut: 'en_attente' },
]

/** Routeur des appels : dépôt, adresse proposée, signalements semblables. */
function routeur(sur: { adresse?: () => Response; similaires?: () => Response } = {}) {
  return async (appel: Appel) => {
    if (appel.url.startsWith('/api/aj-signalement/adresse')) return sur.adresse ? sur.adresse() : json({ adresse: ADRESSE_PROPOSEE })
    if (appel.url.startsWith('/api/aj-signalement/similaires')) return sur.similaires ? sur.similaires() : json({ semblables: SEMBLABLES })
    return json(REPONSE_OK)
  }
}

const depots = () => appels.filter((a) => a.url === '/api/aj-signalement/signalements')
const corpsDepot = (n = 0) => JSON.parse(String(depots()[n].init?.body)) as Record<string, unknown>

function rendre(adresse = '12 allée des Pins, 13009 Marseille') {
  return render(<AppSignalementQr jeton={JETON} copropriete={{ nom: 'Parc Belle Ombre', adresse }} langue="fr" />)
}

const bouton = () => screen.getByRole('button', { name: tq.envoyer })

type Coordonnees = 'prenom' | 'nom' | 'telephone' | 'email' | 'batiment' | 'etage' | 'numLot'

function remplirCoordonnees(sur: Partial<Record<Coordonnees, string>> = {}, qualite: string | null = tq.qualites.proprietaire) {
  const valeurs: Record<Coordonnees, string> = {
    prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie.durand@example.com', batiment: 'B', etage: '4', numLot: '12', ...sur,
  }
  for (const champ of Object.keys(valeurs) as Coordonnees[]) {
    const input = screen.getByLabelText(tq[champ])
    fireEvent.change(input, { target: { value: valeurs[champ] } })
    fireEvent.blur(input)
  }
  if (qualite) fireEvent.click(screen.getByLabelText(qualite))
}

function remplirParcours() {
  fireEvent.click(screen.getByLabelText(/Dans mon logement/))
  fireEvent.change(screen.getByLabelText(t.demandes.typeProbleme), { target: { value: 'Ascenseur' } })
  fireEvent.change(screen.getByLabelText(t.demandes.decrivez), { target: { value: 'Ascenseur bloqué entre deux étages' } })
  fireEvent.click(screen.getByLabelText(t.demandes.urgenceUrgent))
}

function remplirPartiesCommunes(zone = 'Escalier') {
  fireEvent.click(screen.getByLabelText(t.demandes.dansPartiesCommunes))
  fireEvent.change(screen.getByLabelText(t.demandes.zone), { target: { value: zone } })
  fireEvent.change(screen.getByLabelText(t.demandes.typeProbleme), { target: { value: 'Éclairage des parties communes' } })
  fireEvent.change(screen.getByLabelText(t.demandes.decrivez), { target: { value: 'Plus de lumière dans la cage d’escalier' } })
  fireEvent.click(screen.getByLabelText(t.demandes.urgenceGenant))
}

// ── Position du navigateur simulée ──
type Succes = (p: { coords: { latitude: number; longitude: number } }) => void
type Echec = (e: { code: number; message: string }) => void
let getCurrentPosition = vi.fn<(succes: Succes, echec?: Echec, options?: unknown) => void>()

function simulerPosition(comportement: 'accepte' | 'refuse' | 'jamais') {
  getCurrentPosition = vi.fn((succes: Succes, echec?: Echec) => {
    if (comportement === 'accepte') succes({ coords: { latitude: 43.2951, longitude: 5.3741 } })
    if (comportement === 'refuse') echec?.({ code: 1, message: 'User denied Geolocation' })
  })
  Object.defineProperty(window.navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
}

beforeEach(() => {
  vi.unstubAllGlobals()
  window.scrollTo = vi.fn()
})

afterEach(() => {
  Reflect.deleteProperty(window.navigator, 'geolocation')
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

  it('tous les champs sont obligatoires : bâtiment et qualité compris', () => {
    rendre()
    remplirCoordonnees({ batiment: '' }, null)
    remplirParcours()
    expect(bouton()).toBeDisabled()
    expect(screen.getByLabelText(tq.batiment)).toBeRequired()
    fireEvent.change(screen.getByLabelText(tq.batiment), { target: { value: 'A' } })
    expect(bouton()).toBeDisabled()
    fireEvent.click(screen.getByLabelText(tq.qualites.locataire))
    expect(bouton()).toBeEnabled()
    expect(screen.queryByText(/facultatif/i)).toBeNull()
  })

  it('signale un e-mail invalide et un champ obligatoire vide (bâtiment compris) quand on quitte le champ', () => {
    rendre()
    const email = screen.getByLabelText(tq.email)
    fireEvent.change(email, { target: { value: 'marie@localhost' } })
    fireEvent.blur(email)
    expect(screen.getByText(tq.emailInvalide)).toBeInTheDocument()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    fireEvent.blur(screen.getByLabelText(tq.numLot))
    expect(screen.getByText(tq.champObligatoire)).toBeInTheDocument()
    // Le bâtiment est obligatoire depuis le 06/11/2026.
    fireEvent.blur(screen.getByLabelText(tq.batiment))
    expect(screen.getAllByText(tq.champObligatoire)).toHaveLength(2)
    expect(screen.getByLabelText(tq.batiment)).toHaveAttribute('aria-invalid', 'true')
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
      jeton: JETON, prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie.durand@example.com', batiment: 'B', etage: '4', numLot: '12',
      estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Ascenseur', description: 'Ascenseur bloqué entre deux étages', priorite: 'urgente', langue: 'fr',
      qualiteDeclarant: 'proprietaire', adresseProposee: '', signalementLieNumero: '',
    })
    expect(screen.getByText(/4 novembre 2026/)).toBeInTheDocument()
    expect(screen.getByText(/06 12 34 56 78/)).toHaveTextContent('marie.durand@example.com')
    expect(window.scrollTo).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: tq.autreSignalement }))
    expect(bouton()).toBeDisabled()
    expect(screen.getByLabelText(tq.prenom)).toHaveValue('')
    expect(screen.getByLabelText(tq.qualites.proprietaire)).not.toBeChecked()
  })

  it('parties communes : la zone est obligatoire et envoyée, le lieu du logement n’est pas transmis', async () => {
    simulerFetch(routeur({ similaires: () => json({ semblables: [] }) }))
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
    await waitFor(() => expect(depots()).toHaveLength(1))
    expect(corpsDepot()).toMatchObject({ estPartieCommune: true, zoneSignalee: 'Escalier', priorite: 'normale', etage: '4', numLot: '12', signalementLieNumero: '' })
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

describe('géolocalisation : adresse proposée quand celle de la copropriété n’est pas renseignée', () => {
  const messageProposee = remplir(tq.adresseProposee, { adresse: ADRESSE_PROPOSEE })

  it('explique, demande la position une fois, affiche la copropriété « à moitié identifiée » et envoie l’adresse proposée', async () => {
    simulerPosition('accepte')
    simulerFetch(routeur())
    rendre('')
    expect(screen.getByText(tq.geolocalisationExplication)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(messageProposee)).toBeInTheDocument())
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    // Message dans une région annoncée aux lecteurs d'écran.
    expect(screen.getByText(messageProposee).closest('[aria-live="polite"]')).not.toBeNull()
    const appelAdresse = appels.find((a) => a.url === '/api/aj-signalement/adresse')
    expect(appelAdresse?.init?.method).toBe('POST')
    expect(JSON.parse(String(appelAdresse?.init?.body))).toEqual({ jeton: JETON, latitude: 43.2951, longitude: 5.3741 })
    expect(screen.getByText(tq.copropriete).closest('section')).toHaveTextContent('Parc Belle Ombre')

    remplirCoordonnees()
    remplirParcours()
    fireEvent.click(bouton())
    await waitFor(() => expect(depots()).toHaveLength(1))
    expect(corpsDepot()).toMatchObject({ adresseProposee: ADRESSE_PROPOSEE })
    expect(Object.keys(corpsDepot()).some((c) => /lat|lon/i.test(c))).toBe(false)
  })

  it('adresse déjà renseignée : aucune demande de position, aucune phrase d’explication', async () => {
    simulerPosition('accepte')
    simulerFetch(routeur())
    rendre()
    await new Promise((r) => setTimeout(r, 50))
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(screen.queryByText(tq.geolocalisationExplication)).toBeNull()
    expect(appels.filter((a) => a.url === '/api/aj-signalement/adresse')).toHaveLength(0)
  })

  it('position refusée : message non bloquant, aucun appel au serveur, signalement envoyé sans adresse', async () => {
    simulerPosition('refuse')
    simulerFetch(routeur())
    rendre('')
    await waitFor(() => expect(screen.getByText(tq.positionRefusee)).toBeInTheDocument())
    expect(appels.filter((a) => a.url === '/api/aj-signalement/adresse')).toHaveLength(0)
    remplirCoordonnees()
    remplirParcours()
    expect(bouton()).toBeEnabled()
    fireEvent.click(bouton())
    await waitFor(() => expect(depots()).toHaveLength(1))
    expect(corpsDepot()).toMatchObject({ adresseProposee: '' })
  })

  it.each([
    ['aucune adresse trouvée', () => json({ adresse: null })],
    ['service indisponible', () => json({ error: 'serveur' }, 500)],
  ])('%s : message non bloquant, envoi possible', async (_cas, adresse) => {
    simulerPosition('accepte')
    simulerFetch(routeur({ adresse }))
    rendre('')
    await waitFor(() => expect(screen.getByText(tq.adresseIntrouvable)).toBeInTheDocument())
    remplirCoordonnees()
    remplirParcours()
    fireEvent.click(bouton())
    await waitFor(() => expect(depots()).toHaveLength(1))
    expect(corpsDepot()).toMatchObject({ adresseProposee: '' })
  })

  it('navigateur sans géolocalisation : aucun plantage, envoi possible', async () => {
    simulerFetch(routeur())
    rendre('')
    await waitFor(() => expect(screen.getByText(tq.adresseIntrouvable)).toBeInTheDocument())
    remplirCoordonnees()
    remplirParcours()
    expect(bouton()).toBeEnabled()
  })

  it('envoi avant la réponse de la position : adresse vide, rien n’attend la géolocalisation', async () => {
    simulerPosition('jamais')
    simulerFetch(routeur())
    rendre('')
    remplirCoordonnees()
    remplirParcours()
    fireEvent.click(bouton())
    await waitFor(() => expect(depots()).toHaveLength(1))
    expect(corpsDepot()).toMatchObject({ adresseProposee: '' })
  })

  it('« Faire un autre signalement » ne redemande pas la position et garde l’adresse proposée', async () => {
    simulerPosition('accepte')
    simulerFetch(routeur())
    rendre('')
    await waitFor(() => expect(screen.getByText(messageProposee)).toBeInTheDocument())
    remplirCoordonnees()
    remplirParcours()
    fireEvent.click(bouton())
    await waitFor(() => expect(screen.getByText('Numéro : B1C2D3E4')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: tq.autreSignalement }))
    expect(screen.getByText(messageProposee)).toBeInTheDocument()
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(appels.filter((a) => a.url === '/api/aj-signalement/adresse')).toHaveLength(1)
  })
})

describe('signalements déjà faits au même endroit', () => {
  const appelsSemblables = () => appels.filter((a) => a.url.startsWith('/api/aj-signalement/similaires'))
  const listeSemblables = () => screen.getByRole('list', { name: tq.semblablesTitre })

  async function afficherSemblables(zone = 'Escalier') {
    simulerFetch(routeur())
    rendre()
    remplirCoordonnees({ batiment: 'Bât. B' })
    remplirPartiesCommunes(zone)
    await waitFor(() => expect(screen.getByText(remplir(tq.semblableNumero, { numero: '1A2B3C4D' }))).toBeInTheDocument())
  }

  it('parties communes, bâtiment et zone : liste (numéro, type, zone, date, statut) ; « même problème » envoie le numéro', async () => {
    await afficherSemblables()
    const url = new URL(appelsSemblables()[0].url, 'https://vitfix.io')
    expect(Object.fromEntries(url.searchParams)).toEqual({ jeton: JETON, batiment: 'Bât. B', zone: 'Escalier', langue: 'fr' })
    const lignes = within(listeSemblables()).getAllByRole('listitem')
    expect(lignes).toHaveLength(2)
    expect(lignes[0]).toHaveTextContent('Ascenseur')
    expect(lignes[0]).toHaveTextContent('Escalier')
    expect(lignes[0]).toHaveTextContent('5 novembre 2026')
    expect(lignes[0]).toHaveTextContent(tq.statutsSemblables.acceptee)
    expect(lignes[1]).toHaveTextContent(tq.statutsSemblables.en_attente)

    const meme = within(lignes[0]).getByRole('button', { name: tq.memeProbleme })
    expect(meme).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(meme)
    expect(meme).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(remplir(tq.rattacheA, { numero: '1A2B3C4D' }))).toBeInTheDocument()
    expect(screen.getByText(remplir(tq.rattacheA, { numero: '1A2B3C4D' })).closest('[aria-live="polite"]')).not.toBeNull()

    fireEvent.click(bouton())
    await waitFor(() => expect(depots()).toHaveLength(1))
    expect(corpsDepot()).toMatchObject({ estPartieCommune: true, zoneSignalee: 'Escalier', batiment: 'Bât. B', signalementLieNumero: '1A2B3C4D' })
  })

  it('« C’est un autre problème » : aucun lien ; le choix n’empêche jamais l’envoi', async () => {
    await afficherSemblables()
    expect(bouton()).toBeEnabled()
    fireEvent.click(within(within(listeSemblables()).getAllByRole('listitem')[1]).getByRole('button', { name: tq.memeProbleme }))
    const autre = screen.getByRole('button', { name: tq.autreProbleme })
    fireEvent.click(autre)
    expect(autre).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(tq.nouveauProbleme)).toBeInTheDocument()
    fireEvent.click(bouton())
    await waitFor(() => expect(depots()).toHaveLength(1))
    expect(corpsDepot()).toMatchObject({ signalementLieNumero: '' })
  })

  it('changer la zone remet le choix à zéro et relance la recherche', async () => {
    await afficherSemblables()
    fireEvent.click(within(within(listeSemblables()).getAllByRole('listitem')[0]).getByRole('button', { name: tq.memeProbleme }))
    fireEvent.change(screen.getByLabelText(t.demandes.zone), { target: { value: 'Hall d’entrée' } })
    await waitFor(() => expect(appelsSemblables()).toHaveLength(2))
    await waitFor(() => expect(within(listeSemblables()).getAllByRole('listitem')).toHaveLength(2))
    for (const b of screen.getAllByRole('button', { name: tq.memeProbleme })) expect(b).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(bouton())
    await waitFor(() => expect(depots()).toHaveLength(1))
    expect(corpsDepot()).toMatchObject({ zoneSignalee: 'Hall d’entrée', signalementLieNumero: '' })
  })

  const zone = (valeur: string) => fireEvent.change(screen.getByLabelText(t.demandes.zone), { target: { value: valeur } })
  const batiment = (valeur: string) => fireEvent.change(screen.getByLabelText(tq.batiment), { target: { value: valeur } })
  it.each([
    ['passage par « Dans mon logement »', () => {
      fireEvent.click(screen.getByLabelText(/Dans mon logement/))
      fireEvent.click(screen.getByLabelText(t.demandes.dansPartiesCommunes))
      zone('Escalier')
    }],
    ['autre zone puis retour', () => { zone('Hall d’entrée'); zone('Escalier') }],
    ['autre bâtiment puis retour', () => { batiment('A'); batiment('Bât. B') }],
  ])('le choix est effacé dès que l’endroit change : il ne revient pas au retour au même endroit (%s)', async (_cas, allerRetour) => {
    await afficherSemblables()
    const meme = within(within(listeSemblables()).getAllByRole('listitem')[0]).getByRole('button', { name: tq.memeProbleme })
    fireEvent.click(meme)
    expect(meme).toHaveAttribute('aria-pressed', 'true')
    allerRetour()
    await waitFor(() => expect(within(listeSemblables()).getAllByRole('listitem')).toHaveLength(2))
    for (const b of screen.getAllByRole('button', { name: tq.memeProbleme })) expect(b).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: tq.autreProbleme })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText(remplir(tq.rattacheA, { numero: '1A2B3C4D' }))).toBeNull()
    fireEvent.click(bouton())
    await waitFor(() => expect(depots()).toHaveLength(1))
    expect(corpsDepot()).toMatchObject({ zoneSignalee: 'Escalier', batiment: 'Bât. B', signalementLieNumero: '' })
  })

  it('« même problème » garde son choix tant que l’endroit ne change pas (bâtiment réécrit sous une forme équivalente)', async () => {
    await afficherSemblables()
    fireEvent.click(within(within(listeSemblables()).getAllByRole('listitem')[0]).getByRole('button', { name: tq.memeProbleme }))
    batiment('Bâtiment B')
    expect(within(within(listeSemblables()).getAllByRole('listitem')[0]).getByRole('button', { name: tq.memeProbleme })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(bouton())
    await waitFor(() => expect(depots()).toHaveLength(1))
    expect(corpsDepot()).toMatchObject({ batiment: 'Bâtiment B', signalementLieNumero: '1A2B3C4D' })
  })

  it('l’apparition de la liste est annoncée par une région vivante présente dès le premier rendu, vidée sans liste', async () => {
    simulerFetch(routeur())
    rendre()
    // Régions vivantes du premier rendu : l'annonce doit passer par l'une d'elles, pas par un nœud créé avec la liste.
    const regions = Array.from(document.querySelectorAll('[aria-live="polite"], [role="status"]'))
    const textes = () => regions.map((r) => r.textContent ?? '')
    const annonce = remplir(tq.semblablesAnnonce, { n: 2 })
    expect(annonce).toMatch(/2/)
    remplirCoordonnees({ batiment: 'Bât. B' })
    remplirPartiesCommunes()
    await waitFor(() => expect(textes()).toContain(annonce))
    expect(screen.getByText(annonce).isConnected).toBe(true)
    fireEvent.click(screen.getByLabelText(/Dans mon logement/))
    expect(textes()).not.toContain(annonce)
    expect(screen.queryByText(annonce)).toBeNull()
  })

  it('un seul signalement semblable : annonce au singulier ; en portugais : annonce portugaise', async () => {
    simulerFetch(routeur({ similaires: () => json({ semblables: [SEMBLABLES[0]] }) }))
    rendre()
    const regions = Array.from(document.querySelectorAll('[aria-live="polite"], [role="status"]'))
    remplirCoordonnees({ batiment: 'Bât. B' })
    remplirPartiesCommunes()
    await waitFor(() => expect(regions.map((r) => r.textContent)).toContain(tq.semblablesAnnonceUn))

    const tqPt = TEXTES_SIGNALEMENT_QR.pt
    expect(tqPt.semblablesAnnonceUn).not.toBe(tq.semblablesAnnonceUn)
    expect(remplir(tqPt.semblablesAnnonce, { n: 3 })).toContain('3')
  })

  it('logement : aucune recherche, aucune liste', async () => {
    simulerFetch(routeur())
    rendre()
    remplirCoordonnees()
    remplirParcours()
    await new Promise((r) => setTimeout(r, 600))
    expect(appelsSemblables()).toHaveLength(0)
    expect(screen.queryByRole('list', { name: tq.semblablesTitre })).toBeNull()
  })

  it('recherche en échec ou sans résultat : rien d’affiché, l’envoi reste possible', async () => {
    simulerFetch(routeur({ similaires: () => json({ error: 'serveur' }, 500) }))
    rendre()
    remplirCoordonnees()
    remplirPartiesCommunes()
    await waitFor(() => expect(appelsSemblables()).toHaveLength(1))
    expect(screen.queryByRole('list', { name: tq.semblablesTitre })).toBeNull()
    fireEvent.click(bouton())
    await waitFor(() => expect(depots()).toHaveLength(1))
    expect(corpsDepot()).toMatchObject({ signalementLieNumero: '' })
  })
})
