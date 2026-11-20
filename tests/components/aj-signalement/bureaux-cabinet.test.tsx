// tests/components/aj-signalement/bureaux-cabinet.test.tsx
//
// Bureaux des cabinets clients (PR 2 : écrans du super admin, BROUILLON soumis avant fusion) — écran E1 du plan des bureaux :
// vue « Cabinets », bouton « Bureaux (n) » sur chaque carte, qui ouvre la fenêtre des bureaux du cabinet :
//   - liste (nom, ouvert ou fermé, gestionnaires actifs et copropriétés actives rattachés), « Ajouter un bureau »,
//     « Renommer », « Fermer » ou « Rouvrir » (routes de la PR 1 : GET et POST /cabinets/[id]/bureaux, PATCH /bureaux/[id]) ;
//   - refus en clair : 409 nom_pris, plafond_bureaux, bureau_utilise, a_reverifier (la liste est alors relue) ;
//   - migration 20261119 non appliquée (503 base_absente) : « fonction pas encore disponible », rien d'autre ne casse ;
//   - après chaque action : liste des bureaux ET liste des cabinets relues (compteur de la carte) avant l'annonce ; la
//     fenêtre reste occupée jusque-là ; le focus va au message (annoncé), jamais sur le fond de la page ;
//   - tant qu'aucun bureau n'existe : « Bureaux (0) », aucune requête avant l'ouverture de la fenêtre.
// Données fictives : « Cabinet Exemple », bureaux « Nord » et « Sud », adresses @exemple.test.

import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { TEXTES_GESTION_QR as G, compteursBureauQr } from '@/lib/aj-signalement/affichage-gestion'
import { TEXTES_TABLEAU_QR as T } from '@/lib/aj-signalement/affichage'
import { remplir } from '@/lib/coproprietaire/textes'
import type { CabinetQr } from '@/lib/aj-signalement/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { default: CabinetsQr } = await import('@/components/aj-signalement/CabinetsQr')

const B = G.bureaux.fenetre
const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const K2 = 'a0000000-0000-4000-8000-0000000000a2'
const B1 = 'b0000000-0000-4000-8000-0000000000b1'
const B2 = 'b0000000-0000-4000-8000-0000000000b2'

const sansBureau: CabinetQr = { id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', domaines: ['exemple.test'], identifiantFige: true, nbCoproprietes: 3, nbGestionnaires: 2 }
const avecBureaux: CabinetQr = { id: K2, nom: 'Autre Exemple', identifiant: 'autre-exemple', langue: 'fr', domaines: ['autre.exemple.test'], identifiantFige: true, nbCoproprietes: 1, nbGestionnaires: 1, nbBureaux: 2, nbBureauxOuverts: 1 }

type Bureau = { id: string; nom: string; ferme: boolean; cabinetId: string; fermeLe: string | null; creeLe: string; nbGestionnaires: number; nbCoproprietes: number }
const bureau = (id: string, nom: string, ferme = false, nbGestionnaires = 0, nbCoproprietes = 0): Bureau => ({
  id, nom, ferme, cabinetId: K1, fermeLe: ferme ? '2026-11-19T09:00:00+00:00' : null, creeLe: '2026-11-19T08:00:00+00:00', nbGestionnaires, nbCoproprietes,
})

type Appel = { url: string; methode: string; corps: unknown }
let appels: Appel[] = []
let bureaux: Bureau[] = []
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })
const URL_LISTE = `/api/aj-signalement/cabinets/${K1}/bureaux`

/** Simulacre des routes des bureaux : `refus` répond à la prochaine écriture (POST ou PATCH) ; la liste suit les écritures. */
let refus: { code: string; status: number } | null = null
function routeur(a: Appel): Response {
  if (a.methode === 'GET') return json({ bureaux })
  if (refus) {
    const r = refus
    refus = null
    return json({ error: r.code }, r.status)
  }
  const corps = a.corps as { nom?: string; fermer?: boolean }
  if (a.methode === 'POST') {
    const cree = bureau(B2, corps.nom ?? '')
    bureaux = [...bureaux, cree]
    return json({ bureau: cree }, 201)
  }
  const id = a.url.split('/').pop() ?? ''
  const avant = bureaux.find((b) => b.id === id) as Bureau
  const apres = corps.nom === undefined ? { ...avant, ferme: corps.fermer === true } : { ...avant, nom: corps.nom }
  bureaux = bureaux.map((b) => (b.id === id ? apres : b))
  return json({ bureau: apres, modifie: true })
}

function simulerFetch(r: (appel: Appel) => Response | Promise<Response> = routeur) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const appel = { url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) : null }
    appels.push(appel)
    return r(appel)
  }))
}

const rappels = { onModifie: vi.fn(async () => {}), onReessayer: vi.fn(), onJournal: vi.fn() }
const rendre = (cabinets: CabinetQr[] = [sansBureau, avecBureaux]) =>
  render(<CabinetsQr cabinets={cabinets} erreur={null} coproprietes={[]} {...rappels} />)
const carte = (nom: string) => screen.getByRole('heading', { name: nom }).closest('section') as HTMLElement
const fenetre = () => screen.getByRole('dialog')
async function ouvrir(nom = 'Cabinet Exemple', n = 0) {
  fireEvent.click(within(carte(nom)).getByRole('button', { name: remplir(B.bouton, { n }) }))
  await waitFor(() => expect(within(fenetre()).queryByText(B.chargement)).toBeNull())
  return fenetre()
}
const ecritures = () => appels.filter((a) => a.methode !== 'GET')
const lectures = () => appels.filter((a) => a.methode === 'GET' && a.url === URL_LISTE)

beforeEach(() => {
  vi.clearAllMocks()
  bureaux = [bureau(B1, 'Nord', false, 2, 3)]
  refus = null
  simulerFetch()
})
afterEach(() => vi.unstubAllGlobals())

describe('bouton « Bureaux (n) » sur la carte d’un cabinet', () => {
  it('cabinet sans bureau (aucune clé nbBureaux) : « Bureaux (0) » ; avec bureaux : leur nombre, fermés compris ; aucune requête avant l’ouverture', () => {
    rendre()
    expect(within(carte('Cabinet Exemple')).getByRole('button', { name: 'Bureaux (0)' })).toBeInTheDocument()
    expect(within(carte('Autre Exemple')).getByRole('button', { name: 'Bureaux (2)' })).toBeInTheDocument()
    expect(appels).toEqual([])
  })

  it('le reste de la carte est inchangé (compteurs, boutons voisins)', () => {
    rendre()
    const c = carte('Cabinet Exemple')
    expect(within(c).getByText(remplir(G.cabinets.compteurs, { copros: 3, gestionnaires: 2 }))).toBeInTheDocument()
    expect(within(c).getByRole('button', { name: G.cabinets.modifier })).toBeInTheDocument()
    expect(within(c).getByRole('button', { name: G.cabinets.logo.bouton })).toBeInTheDocument()
  })

  it('téléphone : « Bureaux (n) » est dans la rangée des boutons de la carte, bornée à la carte et qui passe à la ligne (jamais hors de l’écran)', () => {
    rendre()
    const rangee = within(carte('Cabinet Exemple')).getByRole('button', { name: 'Bureaux (0)' }).parentElement as HTMLElement
    expect(rangee).toContainElement(within(carte('Cabinet Exemple')).getByRole('button', { name: G.cabinets.logo.bouton }))
    expect(rangee).toHaveClass('flex-wrap', 'max-w-full')
  })
})

describe('fenêtre des bureaux : lecture', () => {
  it('titre « Bureaux — Cabinet Exemple » (jamais « Bureaux du cabinet Cabinet Exemple »)', async () => {
    rendre()
    const f = await ouvrir()
    expect(within(f).getByRole('heading', { level: 2 })).toHaveTextContent(/^Bureaux — Cabinet Exemple$/)
  })

  it('téléphone : dans chaque ligne, « Renommer » et « Fermer » passent sous le nom et les compteurs (côte à côte au-delà de sm, motif flex-col sm:flex-row des fenêtres)', async () => {
    bureaux = [bureau(B1, 'Nord', false, 1, 1), bureau(B2, 'Sud', true)]
    rendre()
    const f = await ouvrir()
    for (const ligne of within(within(f).getByRole('list', { name: B.liste })).getAllByRole('listitem')) {
      const nom = within(ligne).getByRole('heading', { level: 3 })
      const disposition = nom.closest('.space-y-1')?.parentElement as HTMLElement
      expect(disposition).toContainElement(within(ligne).getByRole('button', { name: remplir(B.renommerNomme, { nom: nom.textContent ?? '' }) }))
      expect(disposition).toHaveClass('flex', 'flex-col', 'sm:flex-row', 'sm:justify-between')
      expect(disposition).not.toHaveClass('flex-wrap')
    }
  })

  it('titre, intro ; chaque bureau : nom, ouvert ou fermé, gestionnaires actifs et copropriétés actives ; GET de ce cabinet', async () => {
    bureaux = [bureau(B1, 'Nord', false, 2, 3), bureau(B2, 'Sud', true)]
    rendre()
    const f = await ouvrir()
    expect(within(f).getByRole('heading', { name: remplir(B.titre, { cabinet: 'Cabinet Exemple' }) })).toBeInTheDocument()
    expect(within(f).getByText(B.intro)).toBeInTheDocument()
    const liste = within(f).getByRole('list', { name: B.liste })
    const lignes = within(liste).getAllByRole('listitem')
    expect(lignes).toHaveLength(2)
    expect(within(lignes[0]).getByRole('heading', { name: 'Nord' })).toBeInTheDocument()
    expect(within(lignes[0]).getByText(B.ouvert)).toBeInTheDocument()
    expect(within(lignes[0]).getByText(compteursBureauQr({ nbGestionnaires: 2, nbCoproprietes: 3 }))).toBeInTheDocument()
    expect(within(lignes[0]).getByRole('button', { name: remplir(B.fermerNomme, { nom: 'Nord' }) })).toBeInTheDocument()
    expect(within(lignes[1]).getByText(B.ferme)).toBeInTheDocument()
    expect(within(lignes[1]).getByRole('button', { name: remplir(B.rouvrirNomme, { nom: 'Sud' }) })).toBeInTheDocument()
    expect(appels).toEqual([{ url: URL_LISTE, methode: 'GET', corps: null }])
  })

  it('cabinet sans bureau : « aucun bureau » et le formulaire d’ajout', async () => {
    bureaux = []
    rendre()
    const f = await ouvrir()
    expect(within(f).getByText(B.aucun)).toBeInTheDocument()
    expect(within(f).queryByRole('list', { name: B.liste })).toBeNull()
    expect(within(f).getByLabelText(B.nom)).toBeInTheDocument()
    expect(within(f).getByRole('button', { name: B.ajouter })).toBeInTheDocument()
  })

  it('migration absente (503 base_absente) : « fonction pas encore disponible », aucun formulaire ; la vue reste intacte', async () => {
    simulerFetch(() => json({ error: 'base_absente' }, 503))
    rendre()
    const f = await ouvrir()
    expect(within(f).getByText(G.bureaux.indisponible)).toBeInTheDocument()
    expect(within(f).queryByLabelText(B.nom)).toBeNull()
    expect(within(f).queryByRole('button', { name: B.ajouter })).toBeNull()
    expect(within(f).queryByText(/migration|SQL/i)).toBeNull()
    fireEvent.click(within(f).getByRole('button', { name: B.fermerFenetre }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(carte('Cabinet Exemple')).getByRole('button', { name: 'Bureaux (0)' })).toBeInTheDocument()
    expect(rappels.onModifie).not.toHaveBeenCalled()
  })

  it('lecture en échec : message, puis « Réessayer » relit', async () => {
    let premier = true
    simulerFetch((a) => {
      if (premier) { premier = false; return json({ error: 'serveur' }, 500) }
      return routeur(a)
    })
    rendre()
    const f = await ouvrir()
    expect(within(f).getByText(B.erreurLecture)).toBeInTheDocument()
    fireEvent.click(within(f).getByRole('button', { name: G.reessayer }))
    expect(await within(f).findByRole('heading', { name: 'Nord' })).toBeInTheDocument()
    expect(lectures()).toHaveLength(2)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('lecture, réseau coupé : le message et « Réessayer » dans la fenêtre, et un toast (une fois)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    simulerFetch(() => { throw new TypeError('Failed to fetch') })
    rendre()
    const f = await ouvrir()
    expect(within(f).getByText(T.erreurs.reseau)).toBeInTheDocument()
    expect(within(f).getByRole('button', { name: G.reessayer })).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(T.erreurs.reseau)
  })
})

describe('relecture de l’espace en échec après une action', () => {
  /** Espace simulé : la relecture des listes échoue (erreur « serveur ») ; « Réessayer » l'efface et rend la liste. */
  function Hote() {
    const [erreur, setErreur] = React.useState<'serveur' | null>(null)
    return (
      <CabinetsQr
        cabinets={[sansBureau]} erreur={erreur} coproprietes={[]} onJournal={vi.fn()}
        onModifie={async () => { setErreur('serveur') }} onReessayer={() => setErreur(null)}
      />
    )
  }

  it('après un ajout : fenêtre fermée, l’ajout reste annoncé au-dessus de l’erreur, focus sur « Réessayer » ; « Réessayer » ne rouvre pas la fenêtre', async () => {
    render(<Hote />)
    const f = await ouvrir()
    fireEvent.change(within(f).getByLabelText(B.nom), { target: { value: 'Sud' } })
    fireEvent.click(within(f).getByRole('button', { name: B.ajouter }))
    expect(await screen.findByText(remplir(B.ajoute, { nom: 'Sud' }))).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText(T.erreurs.serveur)).toBeInTheDocument()
    const reessayer = screen.getByRole('button', { name: G.reessayer })
    await waitFor(() => expect(document.activeElement).toBe(reessayer))

    fireEvent.click(reessayer)
    expect(within(carte('Cabinet Exemple')).getByRole('button', { name: 'Bureaux (0)' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('ajout d’un bureau', () => {
  it('POST { nom } rogné ; puis liste des bureaux ET des cabinets relues avant l’annonce ; champ vidé ; focus sur le message', async () => {
    rendre()
    const f = await ouvrir()
    fireEvent.change(within(f).getByLabelText(B.nom), { target: { value: '  Sud  ' } })
    fireEvent.click(within(f).getByRole('button', { name: B.ajouter }))
    const annonce = await within(f).findByText(remplir(B.ajoute, { nom: 'Sud' }))
    expect(ecritures()).toEqual([{ url: URL_LISTE, methode: 'POST', corps: { nom: 'Sud' } }])
    expect(lectures()).toHaveLength(2)
    expect(rappels.onModifie).toHaveBeenCalledTimes(1)
    expect(within(f).getByRole('heading', { name: 'Sud' })).toBeInTheDocument()
    expect((within(f).getByLabelText(B.nom) as HTMLInputElement).value).toBe('')
    // Focus posé par un effet, après le rendu qui montre l'annonce : attendu (un rendu hors événement peut le précéder).
    await waitFor(() => expect(document.activeElement).toBe(annonce.closest('[tabindex="-1"]')))
  })

  it('fenêtre occupée (aucun second envoi) jusqu’à la liste des cabinets relue ; puis le message reste dans la vue', async () => {
    let tenir: () => void = () => {}
    rappels.onModifie.mockImplementationOnce(() => new Promise<void>((r) => { tenir = r }))
    rendre()
    const f = await ouvrir()
    fireEvent.change(within(f).getByLabelText(B.nom), { target: { value: 'Sud' } })
    fireEvent.click(within(f).getByRole('button', { name: B.ajouter }))
    await waitFor(() => expect(rappels.onModifie).toHaveBeenCalledTimes(1))
    expect(within(f).queryByText(remplir(B.ajoute, { nom: 'Sud' }))).toBeNull()
    const occupe = within(f).getByRole('button', { name: B.ajout })
    expect(occupe).toBeDisabled()
    fireEvent.click(occupe)
    expect(ecritures()).toHaveLength(1)
    await act(async () => { tenir() })
    expect(await within(f).findByText(remplir(B.ajoute, { nom: 'Sud' }))).toBeInTheDocument()
    fireEvent.click(within(f).getByRole('button', { name: G.fermer }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText(remplir(B.ajoute, { nom: 'Sud' }))).toBeInTheDocument()
  })

  it('nom vide : aucun appel, message', async () => {
    rendre()
    const f = await ouvrir()
    fireEvent.change(within(f).getByLabelText(B.nom), { target: { value: '   ' } })
    fireEvent.click(within(f).getByRole('button', { name: B.ajouter }))
    expect(within(f).getByText(B.nomRequis)).toBeInTheDocument()
    expect(ecritures()).toEqual([])
  })

  it.each(['nom_pris', 'plafond_bureaux'] as const)('refus 409 %s : message en clair, nom gardé, rien de relu', async (code) => {
    rendre()
    const f = await ouvrir()
    refus = { code, status: 409 }
    fireEvent.change(within(f).getByLabelText(B.nom), { target: { value: 'Nord' } })
    fireEvent.click(within(f).getByRole('button', { name: B.ajouter }))
    const message = await within(f).findByText(T.erreurs[code])
    expect(message.closest('[role="alert"]')).not.toBeNull()
    expect((within(f).getByLabelText(B.nom) as HTMLInputElement).value).toBe('Nord')
    expect(rappels.onModifie).not.toHaveBeenCalled()
    expect(lectures()).toHaveLength(1)
  })

  it('réseau coupé : message et toast', async () => {
    rendre()
    const f = await ouvrir()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    simulerFetch(() => { throw new TypeError('Failed to fetch') })
    fireEvent.change(within(f).getByLabelText(B.nom), { target: { value: 'Sud' } })
    fireEvent.click(within(f).getByRole('button', { name: B.ajouter }))
    expect(await within(f).findByText(T.erreurs.reseau)).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith(T.erreurs.reseau)
  })
})

describe('renommer un bureau', () => {
  it('champ prérempli ; PATCH { nom } ; liste relue, annonce, compteur des cabinets relu', async () => {
    rendre()
    const f = await ouvrir()
    fireEvent.click(within(f).getByRole('button', { name: remplir(B.renommerNomme, { nom: 'Nord' }) }))
    const champ = within(f).getByLabelText(remplir(B.nouveauNom, { nom: 'Nord' })) as HTMLInputElement
    expect(champ.value).toBe('Nord')
    expect(document.activeElement).toBe(champ)
    fireEvent.change(champ, { target: { value: 'Nord-Est' } })
    fireEvent.click(within(f).getByRole('button', { name: G.enregistrer }))
    expect(await within(f).findByText(remplir(B.renomme, { nom: 'Nord-Est' }))).toBeInTheDocument()
    expect(ecritures()).toEqual([{ url: `/api/aj-signalement/bureaux/${B1}`, methode: 'PATCH', corps: { nom: 'Nord-Est' } }])
    expect(within(f).getByRole('heading', { name: 'Nord-Est' })).toBeInTheDocument()
    expect(rappels.onModifie).toHaveBeenCalledTimes(1)
  })

  it('même nom : aucun appel ; « Annuler » : retour à la ligne, focus sur « Renommer »', async () => {
    rendre()
    const f = await ouvrir()
    const renommer = () => within(f).getByRole('button', { name: remplir(B.renommerNomme, { nom: 'Nord' }) })
    fireEvent.click(renommer())
    fireEvent.click(within(f).getByRole('button', { name: G.enregistrer }))
    expect(ecritures()).toEqual([])
    expect(document.activeElement).toBe(renommer())
    fireEvent.click(renommer())
    fireEvent.click(within(f).getByRole('button', { name: G.annuler }))
    expect(within(f).queryByLabelText(remplir(B.nouveauNom, { nom: 'Nord' }))).toBeNull()
    expect(document.activeElement).toBe(renommer())
  })

  it('refus 409 nom_pris : message, le champ reste ouvert avec la saisie', async () => {
    rendre()
    const f = await ouvrir()
    refus = { code: 'nom_pris', status: 409 }
    fireEvent.click(within(f).getByRole('button', { name: remplir(B.renommerNomme, { nom: 'Nord' }) }))
    fireEvent.change(within(f).getByLabelText(remplir(B.nouveauNom, { nom: 'Nord' })), { target: { value: 'Sud' } })
    fireEvent.click(within(f).getByRole('button', { name: G.enregistrer }))
    expect(await within(f).findByText(T.erreurs.nom_pris)).toBeInTheDocument()
    expect((within(f).getByLabelText(remplir(B.nouveauNom, { nom: 'Nord' })) as HTMLInputElement).value).toBe('Sud')
    expect(rappels.onModifie).not.toHaveBeenCalled()
  })
})

describe('fermer et rouvrir un bureau', () => {
  it('« Fermer » : PATCH { fermer: true } ; le bureau devient « Fermé », le bouton « Rouvrir » ; puis « Rouvrir » : { fermer: false }', async () => {
    bureaux = [bureau(B1, 'Nord')]
    rendre()
    const f = await ouvrir()
    fireEvent.click(within(f).getByRole('button', { name: remplir(B.fermerNomme, { nom: 'Nord' }) }))
    expect(await within(f).findByText(remplir(B.fermeFait, { nom: 'Nord' }))).toBeInTheDocument()
    expect(within(f).getByText(B.ferme)).toBeInTheDocument()
    fireEvent.click(within(f).getByRole('button', { name: remplir(B.rouvrirNomme, { nom: 'Nord' }) }))
    expect(await within(f).findByText(remplir(B.rouvert, { nom: 'Nord' }))).toBeInTheDocument()
    expect(within(f).getByText(B.ouvert)).toBeInTheDocument()
    expect(ecritures().map((a) => a.corps)).toEqual([{ fermer: true }, { fermer: false }])
    expect(rappels.onModifie).toHaveBeenCalledTimes(2)
  })

  it('refus 409 bureau_utilise (gestionnaire actif ou copropriété active rattaché) : message en clair, le bureau reste ouvert', async () => {
    rendre()
    const f = await ouvrir()
    refus = { code: 'bureau_utilise', status: 409 }
    fireEvent.click(within(f).getByRole('button', { name: remplir(B.fermerNomme, { nom: 'Nord' }) }))
    expect(await within(f).findByText(T.erreurs.bureau_utilise)).toBeInTheDocument()
    expect(within(f).getByText(B.ouvert)).toBeInTheDocument()
    expect(rappels.onModifie).not.toHaveBeenCalled()
  })

  it('refus 409 a_reverifier : la liste des bureaux et celle des cabinets sont relues, puis le message', async () => {
    rendre()
    const f = await ouvrir()
    refus = { code: 'a_reverifier', status: 409 }
    bureaux = [bureau(B1, 'Nord', true)]
    fireEvent.click(within(f).getByRole('button', { name: remplir(B.fermerNomme, { nom: 'Nord' }) }))
    expect(await within(f).findByText(G.bureaux.aReverifier)).toBeInTheDocument()
    expect(lectures()).toHaveLength(2)
    expect(rappels.onModifie).toHaveBeenCalledTimes(1)
    expect(within(f).getByText(B.ferme)).toBeInTheDocument()
  })
})

describe('compteur de la carte', () => {
  it('la liste des cabinets relue après l’action met à jour « Bureaux (n) », fenêtre ouverte', async () => {
    const proprietes = { erreur: null, coproprietes: [], ...rappels }
    const { rerender } = render(<CabinetsQr cabinets={[sansBureau]} {...proprietes} />)
    const f = await ouvrir()
    fireEvent.change(within(f).getByLabelText(B.nom), { target: { value: 'Sud' } })
    fireEvent.click(within(f).getByRole('button', { name: B.ajouter }))
    await within(f).findByText(remplir(B.ajoute, { nom: 'Sud' }))
    rerender(<CabinetsQr cabinets={[{ ...sansBureau, nbBureaux: 2, nbBureauxOuverts: 2 }]} {...proprietes} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(carte('Cabinet Exemple')).getByRole('button', { name: 'Bureaux (2)' })).toBeInTheDocument()
  })
})
