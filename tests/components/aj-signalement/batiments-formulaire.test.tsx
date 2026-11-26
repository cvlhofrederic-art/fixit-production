// tests/components/aj-signalement/batiments-formulaire.test.tsx
//
// Formulaire public « AJ Signalement » : bâtiment choisi dans la liste saisie par le cabinet (demande du 17/11/2026 ;
// constat : une copropriété avait ses bâtiments saisis — par exemple Bâtiment A, Bâtiment B, Les Pins, commerces — mais
// un déclarant a pu saisir « A »).
//   - copropriété avec au moins un bâtiment : liste à choix native (select), dans l'ordre saisi, option vide « Choisir… »,
//     même libellé, aide sous le champ, toujours obligatoire (erreur sous le champ quitté, bouton désactivé) ;
//   - « Dans mon logement (bât. X, …) » reprend le bâtiment choisi ; la recherche des signalements semblables aussi ;
//   - le nom envoyé est celui du cabinet ; refus du serveur (bâtiment absent de la liste) : message dédié, formulaire intact ;
//   - copropriété sans bâtiment : texte libre inchangé (même aide, 50 caractères) ;
//   - portugais : libellé, option vide et aide dans la langue de la page.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import AppSignalementQr from '@/components/aj-signalement/AppSignalementQr'
import { TEXTES_SIGNALEMENT_QR } from '@/lib/aj-signalement/textes'
import { TYPES_PROBLEME, textesCopro } from '@/lib/coproprietaire/textes'
import type { LangueSignalementQr } from '@/lib/aj-signalement/types'

const tq = TEXTES_SIGNALEMENT_QR.fr
const t = textesCopro('fr')
const JETON = '0123456789abcdef0123456789abcdef'
const BATIMENTS = ['Bâtiment A', 'Bâtiment B', 'Les Pins', 'commerces']

type Appel = { url: string; init?: RequestInit }
let appels: Appel[] = []

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

const REPONSE_OK = { signalement: { id: 'b1c2d3e4-0000-4000-8000-000000000000', numero: 'B1C2D3E4', creeLe: '2026-11-17T09:05:00.000Z', emailEnvoye: true } }

function simulerFetch(depot: () => Response = () => json(REPONSE_OK)) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, init })
    if (url.startsWith('/api/aj-signalement/similaires')) return json({ semblables: [] })
    return depot()
  }))
}

const depots = () => appels.filter((a) => a.url === '/api/aj-signalement/signalements')
const corpsDepot = () => JSON.parse(String(depots()[0].init?.body)) as Record<string, unknown>

function rendre(batiments?: string[], langue: LangueSignalementQr = 'fr') {
  const copropriete = { nom: 'Résidence Exemple', adresse: '12 allée des Pins, 13009 Marseille', ...(batiments ? { batiments } : {}) }
  return render(<AppSignalementQr jeton={JETON} copropriete={copropriete} langue={langue} />)
}

const bouton = () => screen.getByRole('button', { name: tq.envoyer })
const champBatiment = (libelle = tq.batiment) => screen.getByLabelText(libelle)

type Coordonnees = 'prenom' | 'nom' | 'telephone' | 'email' | 'etage' | 'numLot'

function remplirSaufBatiment(langue: LangueSignalementQr = 'fr') {
  const tql = TEXTES_SIGNALEMENT_QR[langue]
  const tl = textesCopro(langue)
  const valeurs: Record<Coordonnees, string> = {
    prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie.durand@example.com', etage: '4', numLot: '12',
  }
  for (const champ of Object.keys(valeurs) as Coordonnees[]) {
    fireEvent.change(screen.getByLabelText(tql[champ]), { target: { value: valeurs[champ] } })
  }
  fireEvent.click(screen.getByLabelText(tql.qualites.proprietaire))
  // « Dans mon logement (…) » / « Na minha habitação (…) » : le libellé reprend les coordonnées.
  fireEvent.click(screen.getByLabelText(new RegExp(`^${tl.demandes.dansMonLogement.split(' (')[0]}`)))
  fireEvent.change(screen.getByLabelText(tl.demandes.typeProbleme), { target: { value: TYPES_PROBLEME[langue][3] } })
  fireEvent.change(screen.getByLabelText(tl.demandes.decrivez), { target: { value: 'Ascenseur bloqué entre deux étages' } })
  fireEvent.click(screen.getByLabelText(tl.demandes.urgenceNon))
}

beforeEach(() => {
  vi.unstubAllGlobals()
  window.scrollTo = vi.fn()
  simulerFetch()
})

describe('copropriété dont le cabinet a saisi les bâtiments', () => {
  it('liste à choix native, dans l’ordre saisi, option vide « Choisir… », même libellé, aide sous le champ', () => {
    rendre(BATIMENTS)
    const champ = champBatiment()
    expect(champ.tagName).toBe('SELECT')
    expect(screen.getByRole('combobox', { name: tq.batiment })).toBe(champ)
    expect(screen.queryByRole('textbox', { name: tq.batiment })).toBeNull()
    const options = within(champ).getAllByRole('option') as HTMLOptionElement[]
    expect(options.map((o) => o.textContent)).toEqual(['Choisir…', ...BATIMENTS])
    expect(options.map((o) => o.value)).toEqual(['', ...BATIMENTS])
    expect(champ).toHaveValue('')
    // Aide reliée au champ (aria-describedby), adaptée au choix dans une liste.
    const aide = document.getElementById(String(champ.getAttribute('aria-describedby')))
    expect(aide).toHaveTextContent(tq.batimentListeAide)
    expect(screen.queryByText(tq.batimentAide)).toBeNull()
  })

  it('toujours obligatoire : rien de choisi → erreur sous le champ quitté et bouton désactivé ; choisi → envoi possible', () => {
    rendre(BATIMENTS)
    remplirSaufBatiment()
    const champ = champBatiment()
    expect(champ).toBeRequired()
    fireEvent.blur(champ)
    expect(screen.getByText(tq.champObligatoire)).toBeInTheDocument()
    expect(champ).toHaveAttribute('aria-invalid', 'true')
    expect(bouton()).toBeDisabled()
    fireEvent.change(champ, { target: { value: 'Bâtiment B' } })
    expect(screen.queryByText(tq.champObligatoire)).toBeNull()
    expect(champ).not.toHaveAttribute('aria-invalid')
    expect(bouton()).toBeEnabled()
  })

  it('« Dans mon logement » reprend le bâtiment choisi', () => {
    rendre(BATIMENTS)
    remplirSaufBatiment()
    fireEvent.change(champBatiment(), { target: { value: 'Les Pins' } })
    expect(screen.getByLabelText('Dans mon logement (bât. Les Pins, 4e étage, lot 12)')).toBeInTheDocument()
  })

  it('envoie le nom du bâtiment tel que le cabinet l’a saisi', async () => {
    rendre(BATIMENTS)
    remplirSaufBatiment()
    fireEvent.change(champBatiment(), { target: { value: 'commerces' } })
    fireEvent.click(bouton())
    await waitFor(() => expect(depots()).toHaveLength(1))
    expect(corpsDepot()).toMatchObject({ batiment: 'commerces', etage: '4', numLot: '12', estPartieCommune: false })
    await waitFor(() => expect(screen.getByText('Numéro : B1C2D3E4')).toBeInTheDocument())
  })

  it('parties communes : les signalements semblables sont cherchés pour le bâtiment choisi', async () => {
    rendre(BATIMENTS)
    fireEvent.change(champBatiment(), { target: { value: 'Bâtiment A' } })
    fireEvent.click(screen.getByLabelText(t.demandes.dansPartiesCommunes))
    fireEvent.change(screen.getByLabelText(t.demandes.zone), { target: { value: 'Escalier' } })
    await waitFor(() => expect(appels.some((a) => a.url.startsWith('/api/aj-signalement/similaires'))).toBe(true))
    const recherche = new URL(appels.find((a) => a.url.startsWith('/api/aj-signalement/similaires'))?.url ?? '', 'https://vitfix.io')
    expect(recherche.searchParams.get('batiment')).toBe('Bâtiment A')
  })

  it('refus du serveur (bâtiment absent de la liste) : message dédié et persistant, formulaire intact', async () => {
    simulerFetch(() => json({ error: 'batiment_inconnu', message: 'texte du serveur' }, 400))
    rendre(BATIMENTS)
    remplirSaufBatiment()
    fireEvent.change(champBatiment(), { target: { value: 'Bâtiment B' } })
    fireEvent.click(bouton())
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(tq.erreurs.batiment_inconnu))
    expect(screen.queryByText('texte du serveur')).toBeNull()
    expect(champBatiment()).toHaveValue('Bâtiment B')
    expect(screen.getByLabelText(tq.prenom)).toHaveValue('Marie')
    expect(bouton()).toBeEnabled()
  })
})

describe('copropriété sans bâtiment saisi : texte libre inchangé', () => {
  it.each([
    ['liste absente', undefined],
    ['liste vide', []],
  ])('%s : champ texte, même aide, 50 caractères, toute saisie envoyée telle quelle', async (_cas, batiments) => {
    rendre(batiments)
    const champ = champBatiment()
    expect(champ.tagName).toBe('INPUT')
    expect(screen.getByRole('textbox', { name: tq.batiment })).toBe(champ)
    expect(champ).toHaveAttribute('maxLength', '50')
    expect(champ).toBeRequired()
    expect(screen.getByText(tq.batimentAide)).toBeInTheDocument()
    expect(screen.queryByText(tq.batimentListeAide)).toBeNull()
    remplirSaufBatiment()
    fireEvent.change(champ, { target: { value: 'A' } })
    expect(screen.getByLabelText('Dans mon logement (bât. A, 4e étage, lot 12)')).toBeInTheDocument()
    fireEvent.click(bouton())
    await waitFor(() => expect(depots()).toHaveLength(1))
    expect(corpsDepot()).toMatchObject({ batiment: 'A' })
  })
})

describe('page en portugais', () => {
  it('libellé « Bloco », option vide et aide en portugais ; « Na minha habitação (bloco X, …) »', () => {
    const tqPt = TEXTES_SIGNALEMENT_QR.pt
    rendre(BATIMENTS, 'pt')
    const champ = champBatiment(tqPt.batiment)
    expect(champ.tagName).toBe('SELECT')
    const options = within(champ).getAllByRole('option')
    expect(options[0]).toHaveTextContent(tqPt.choisirBatiment)
    expect(tqPt.choisirBatiment).not.toBe(tq.choisirBatiment)
    expect(screen.getByText(tqPt.batimentListeAide)).toBeInTheDocument()
    fireEvent.change(champ, { target: { value: 'Les Pins' } })
    expect(screen.getByText(/bloco Les Pins/)).toBeInTheDocument()
  })

  it('envoi du bloc choisi ; refus du serveur (bloc absent de la liste) : message en portugais, formulaire intact', async () => {
    const tqPt = TEXTES_SIGNALEMENT_QR.pt
    simulerFetch(() => json({ error: 'batiment_inconnu', message: 'texte du serveur' }, 400))
    rendre(BATIMENTS, 'pt')
    remplirSaufBatiment('pt')
    fireEvent.change(champBatiment(tqPt.batiment), { target: { value: 'Les Pins' } })
    expect(screen.getByLabelText('Na minha habitação (bloco Les Pins, 4.º piso, fração 12)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: tqPt.envoyer }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(tqPt.erreurs.batiment_inconnu))
    expect(corpsDepot()).toMatchObject({ batiment: 'Les Pins', langue: 'pt' })
    expect(screen.queryByText('texte du serveur')).toBeNull()
    expect(champBatiment(tqPt.batiment)).toHaveValue('Les Pins')
  })
})
