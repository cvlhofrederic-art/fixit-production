// tests/components/coproprietaire/assemblees.test.tsx
//
// Écran « Assemblées & votes » du portail copropriétaire (EcranAssemblees) :
// - carte « prochaine assemblée » : date, date limite de vote, ordre du jour, résolutions avec
//   la majorité en mots, trois boutons égaux, aucun compteur avant la séance ;
// - vote simulé localement en démonstration (jeton null), vote réel par
//   POST /api/coproprietaire/assemblees/vote puis rafraîchissement, erreur persistante ;
// - vote clos après la date limite (boutons remplacés) ;
// - assemblées clôturées : résultats, procès-verbal, encart de contestation + modèle de lettre ;
// - état vide.
// La date du jour est figée au 17 octobre 2026 (vote ouvert jusqu'au 16 novembre 2026).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { toast } from 'sonner'
import EcranAssemblees from '@/components/coproprietaire-dashboard/ecrans/EcranAssemblees'
import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { espaceDemo } from '@/lib/coproprietaire/demo'
import { remplir, textesCopro } from '@/lib/coproprietaire/textes'
import type { EspaceCopro } from '@/lib/coproprietaire/types'

const t = textesCopro('fr')
const DATE_LIMITE = '16 novembre 2026'

function reponseJson(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })
}

function rendre(surcharges: Partial<PropsEcran> = {}) {
  const props: PropsEcran = {
    espace: espaceDemo(),
    t,
    langue: 'fr',
    jeton: null,
    allerA: vi.fn(),
    rafraichir: vi.fn(async () => {}),
    miseAJourLe: new Date('2026-10-17T09:00:00+02:00'),
    ...surcharges,
  }
  const rendu = render(<EcranAssemblees {...props} />)
  return { ...rendu, props }
}

/** Espace « réel » (source 'reel') pour les votes avec jeton. */
function espaceReel(): EspaceCopro {
  return { ...espaceDemo(), source: 'reel' }
}

function carteProchaine(): HTMLElement {
  const carte = screen.getByRole('heading', { name: t.assemblees.prochaine }).closest('section')
  if (!carte) throw new Error('carte « prochaine assemblée » introuvable')
  return carte
}

function boutons(carte: HTMLElement, nom: string): HTMLElement[] {
  return within(carte).getAllByRole('button', { name: nom })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-17T10:00:00+02:00'))
  vi.stubGlobal('fetch', vi.fn(async () => reponseJson({ error: 'serveur' }, 500)))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  delete (navigator as { clipboard?: unknown }).clipboard
})

describe('EcranAssemblees — prochaine assemblée (données de démonstration)', () => {
  it('affiche la séance, la date limite de vote, l’ordre du jour et la mention « pour information »', () => {
    rendre()
    const carte = carteProchaine()
    expect(within(carte).getByText(/19 novembre 2026/)).toBeInTheDocument()
    expect(within(carte).getByText('Salle polyvalente, 182 avenue du Prado, 13008 Marseille')).toBeInTheDocument()
    expect(within(carte).getByText(remplir(t.assemblees.resolutionsAttendent, { n: 3, total: 3 }))).toBeInTheDocument()
    expect(within(carte).getByText(remplir(t.assemblees.voterJusquAu, { date: DATE_LIMITE }))).toBeInTheDocument()
    expect(within(carte).getByText(remplir(t.assemblees.convocationEnvoyee, { date: '5 octobre 2026' }))).toBeInTheDocument()
    expect(within(carte).getByText(t.assemblees.ordreDuJour)).toBeInTheDocument()
    expect(within(carte).getByText('Réalisation du diagnostic de performance énergétique (DPE) collectif')).toBeInTheDocument()
    expect(within(carte).getByText(/la convocation officielle vous est adressée séparément/)).toBeInTheDocument()
    expect(within(carte).getByText(t.assemblees.statuts.convoquee)).toBeInTheDocument()
  })

  it('liste les trois résolutions avec la majorité en mots et trois boutons égaux, sans compteur', () => {
    rendre()
    const carte = carteProchaine()
    expect(within(carte).getByText('1. Remplacement de la chaudière collective')).toBeInTheDocument()
    expect(within(carte).getByText('2. Financement de la chaudière')).toBeInTheDocument()
    expect(within(carte).getByText('3. DPE collectif')).toBeInTheDocument()
    expect(within(carte).getAllByText(remplir(t.assemblees.majoriteRequise, { majorite: t.assemblees.majorites.art25 }))).toHaveLength(1)
    expect(within(carte).getAllByText(remplir(t.assemblees.majoriteRequise, { majorite: t.assemblees.majorites.art24 }))).toHaveLength(2)
    expect(within(carte).queryByText(/art25|art24/)).toBeNull()

    for (const nom of [t.assemblees.pour, t.assemblees.contre, t.assemblees.abstention]) {
      const liste = boutons(carte, nom)
      expect(liste).toHaveLength(3)
      liste.forEach(b => expect(b).toHaveAttribute('aria-pressed', 'false'))
    }

    expect(within(carte).queryByText(t.assemblees.resultats)).toBeNull()
    expect(within(carte).queryByText(new RegExp(`${t.assemblees.tantiemes} · `))).toBeNull()
    expect(within(carte).queryByText(t.assemblees.adoptee)).toBeNull()
    expect(within(carte).queryByText(t.assemblees.enCours)).toBeNull()
  })
})

describe('EcranAssemblees — vote', () => {
  it('en démonstration, le vote est confirmé dans une fenêtre puis simulé localement, sans appel réseau', async () => {
    rendre()
    const carte = carteProchaine()
    fireEvent.click(boutons(carte, t.assemblees.pour)[0])

    const dialogue = screen.getByRole('dialog', { name: remplir(t.assemblees.confirmationTitre, { choix: t.assemblees.choix.pour, numero: 1 }) })
    expect(within(dialogue).getByText(remplir(t.assemblees.confirmationTexte, { date: DATE_LIMITE }))).toBeInTheDocument()
    expect(within(dialogue).getByText(t.assemblees.confirmationNote)).toBeInTheDocument()
    expect(within(dialogue).getByRole('button', { name: t.commun.annuler })).toBeInTheDocument()
    fireEvent.click(within(dialogue).getByRole('button', { name: t.assemblees.confirmerVote }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(within(carte).getByText(remplir(t.assemblees.votreVote, { choix: t.assemblees.choix.pour }))).toBeInTheDocument()
    expect(within(carte).getByText(remplir(t.assemblees.enregistreLe, { date: '17 octobre 2026' }))).toBeInTheDocument()
    expect(within(carte).getByText(remplir(t.assemblees.resolutionsAttendent, { n: 2, total: 3 }))).toBeInTheDocument()
    expect(within(carte).getByText(/Démonstration/)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    // La résolution votée n'a plus de boutons ; les deux autres en ont encore.
    expect(boutons(carte, t.assemblees.pour)).toHaveLength(2)

    // « Modifier » rend les boutons, avec mon vote marqué.
    fireEvent.click(within(carte).getByRole('button', { name: t.assemblees.modifier }))
    expect(boutons(carte, t.assemblees.pour)[0]).toHaveAttribute('aria-pressed', 'true')
    expect(boutons(carte, t.assemblees.contre)[0]).toHaveAttribute('aria-pressed', 'false')
  })

  it('« Annuler » referme la fenêtre sans enregistrer', () => {
    rendre()
    const carte = carteProchaine()
    fireEvent.click(boutons(carte, t.assemblees.contre)[2])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t.commun.annuler }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(carte).queryByText(remplir(t.assemblees.votreVote, { choix: t.assemblees.choix.contre }))).toBeNull()
    expect(within(carte).getByText(remplir(t.assemblees.resolutionsAttendent, { n: 3, total: 3 }))).toBeInTheDocument()
  })

  it('avec un jeton, envoie le vote à /api/coproprietaire/assemblees/vote puis rafraîchit l’espace', async () => {
    const fetchMock = vi.fn(async () => reponseJson({ vote: { vote: 'contre', enregistreLe: '2026-10-17T10:05:00+02:00' } }))
    vi.stubGlobal('fetch', fetchMock)
    const { props } = rendre({ espace: espaceReel(), jeton: 'jeton-test' })
    const carte = carteProchaine()

    fireEvent.click(boutons(carte, t.assemblees.contre)[1])
    fireEvent.click(screen.getByRole('button', { name: t.assemblees.confirmerVote }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/coproprietaire/assemblees/vote')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jeton-test', 'Content-Type': 'application/json' })
    expect(JSON.parse(String(init.body))).toEqual({ resolutionId: 'demo-res-r2', vote: 'contre' })

    await waitFor(() => expect(props.rafraichir).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(carte).getByText(remplir(t.assemblees.votreVote, { choix: t.assemblees.choix.contre }))).toBeInTheDocument()
    expect(within(carte).getByText(remplir(t.assemblees.enregistreLe, { date: '17 octobre 2026' }))).toBeInTheDocument()
    expect(within(carte).queryByRole('alert')).toBeNull()
    expect(within(carte).queryByText(/Démonstration/)).toBeNull()
    expect(toast.success).toHaveBeenCalledWith(t.assemblees.voteEnregistre)
  })

  it('affiche une erreur persistante sous la résolution si le vote échoue, et garde les boutons', async () => {
    const { props } = rendre({ espace: espaceReel(), jeton: 'jeton-test' })
    const carte = carteProchaine()

    fireEvent.click(boutons(carte, t.assemblees.abstention)[0])
    fireEvent.click(screen.getByRole('button', { name: t.assemblees.confirmerVote }))

    const alerte = await within(carte).findByRole('alert')
    expect(alerte).toHaveTextContent(t.assemblees.voteErreur)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(props.rafraichir).not.toHaveBeenCalled()
    expect(within(carte).queryByText(remplir(t.assemblees.votreVote, { choix: t.assemblees.choix.abstention }))).toBeNull()
    expect(within(carte).getByText(remplir(t.assemblees.resolutionsAttendent, { n: 3, total: 3 }))).toBeInTheDocument()
    expect(boutons(carte, t.assemblees.pour)).toHaveLength(3)

    // Le message reste tant qu'un nouveau vote n'a pas réussi (pas de minuterie).
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(within(carte).getByRole('alert')).toHaveTextContent(t.assemblees.voteErreur)
  })

  it('après la date limite, les boutons sont remplacés par la mention « vote clos »', () => {
    vi.setSystemTime(new Date('2026-11-18T10:00:00+01:00'))
    rendre()
    const carte = carteProchaine()
    const mentions = within(carte).getAllByText(remplir(t.assemblees.voteClos, { date: DATE_LIMITE }))
    // Une fois dans l'en-tête de la carte, une fois sous chaque résolution.
    expect(mentions).toHaveLength(4)
    expect(within(carte).queryByText(remplir(t.assemblees.voterJusquAu, { date: DATE_LIMITE }))).toBeNull()
    expect(within(carte).queryByRole('button', { name: t.assemblees.pour })).toBeNull()
    expect(within(carte).queryByRole('button', { name: t.assemblees.contre })).toBeNull()
    expect(within(carte).queryByRole('button', { name: t.assemblees.abstention })).toBeNull()
    expect(within(carte).queryByRole('button', { name: t.assemblees.modifier })).toBeNull()
  })
})

describe('EcranAssemblees — assemblées précédentes', () => {
  it('montre les résultats en tantièmes, le procès-verbal et mes votes passés', () => {
    rendre()
    expect(screen.getByRole('heading', { name: t.assemblees.precedentes })).toBeInTheDocument()
    expect(screen.getByText('AG Ordinaire 2026')).toBeInTheDocument()
    expect(screen.getByText('AG Extraordinaire — Toiture')).toBeInTheDocument()
    expect(screen.getAllByText(t.assemblees.statuts.cloturee)).toHaveLength(2)
    expect(screen.getAllByText(t.assemblees.resultats)).toHaveLength(2)
    expect(screen.getAllByText(t.assemblees.adoptee)).toHaveLength(5)
    expect(screen.getAllByText(t.assemblees.rejetee)).toHaveLength(1)
    expect(screen.getByText('2. Emprunt collectif')).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(`^7.150 ${t.assemblees.tantiemes} · 71,5 %$`))).toHaveLength(1)
    expect(screen.getAllByText(remplir(t.assemblees.votreVote, { choix: t.assemblees.choix.contre }))).toHaveLength(1)
    expect(screen.getAllByText(t.assemblees.pvTitre)).toHaveLength(2)
    expect(screen.getByText(/Procès-verbal de l'assemblée générale ordinaire du 11 juin 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Procès-verbal de l'assemblée générale extraordinaire du 20 septembre 2025/)).toBeInTheDocument()
  })

  it('affiche l’encart de contestation à texte fixe et copie un modèle de lettre', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    rendre()

    expect(screen.getByText(/deux mois à compter de la notification du procès-verbal/)).toBeInTheDocument()
    expect(screen.getByText(/art\. 42 de la loi du 10 juillet 1965/)).toBeInTheDocument()
    // Pas de date calculée : ni « jusqu'au … », ni délai écoulé.
    expect(screen.queryByText(/Vous avez jusqu’au/)).toBeNull()
    expect(screen.queryByText(t.assemblees.contestationEcoulee)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: t.assemblees.copierModele }))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const lettre = String((writeText.mock.calls[0] as unknown as [string])[0])
    expect(lettre).toContain('article 42 de la loi n° 65-557 du 10 juillet 1965')
    expect(lettre).toContain('Lot n° 12 — Résidence Le Prado')
    expect(lettre).toContain('Cabinet Dupont')
    expect(toast.success).toHaveBeenCalledWith(t.assemblees.modeleCopie)
    expect(await screen.findByText(t.assemblees.modeleCopie)).toBeInTheDocument()
  })

  it('signale visiblement une copie impossible', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => { throw new Error('refus') }) }, configurable: true })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    rendre()
    fireEvent.click(screen.getByRole('button', { name: t.assemblees.copierModele }))
    expect(await screen.findByText(/La copie n’a pas fonctionné/)).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalled()
    expect(screen.queryByText(t.assemblees.modeleCopie)).toBeNull()
  })
})

describe('EcranAssemblees — états vides', () => {
  it('sans aucune assemblée, affiche l’état vide seul', () => {
    rendre({ espace: { ...espaceDemo(), assemblees: [] } })
    expect(screen.getByText(t.assemblees.aucune)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: t.assemblees.prochaine })).toBeNull()
    expect(screen.queryByRole('heading', { name: t.assemblees.precedentes })).toBeNull()
    expect(screen.queryByText(/contester/)).toBeNull()
  })

  it('sans assemblée convoquée, affiche l’état vide au-dessus des assemblées précédentes', () => {
    const espace = espaceDemo()
    rendre({ espace: { ...espace, assemblees: espace.assemblees.filter(a => a.statut !== 'convoquee') } })
    expect(screen.getByText(t.assemblees.aucune)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: t.assemblees.prochaine })).toBeNull()
    expect(screen.getByRole('heading', { name: t.assemblees.precedentes })).toBeInTheDocument()
    expect(screen.getAllByText(t.assemblees.adoptee)).toHaveLength(5)
  })
})
