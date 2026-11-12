// tests/components/aj-signalement-diffusion.test.tsx
//
// AJ Signalement, PR 3 — écrans de la diffusion. Lot 6 : PAGE PUBLIQUE de désinscription seulement
// (vitfix.io/<identifiant>/desinscription/#<jeton>, cahier § 7.5, § 7.6, § 8.1, décisions F1 et F3 ; brouillon soumis à
// Frédéric). Les écrans de l'espace (formulaire, historique, activation) viendront au lot 8, dans ce même fichier.
//
// Ce qui est prouvé :
//   - le jeton est lu dans le fragment, puis EFFACÉ (history.replaceState) AVANT tout appel ; l'ouverture ne fait qu'une
//     lecture sans effet (un antivirus qui ouvre le lien ne désinscrit personne) ; l'effet est au clic ;
//   - les deux phrases du droit § 5.4 (ce qu'on quitte, ce qu'on garde) précèdent CHAQUE bouton d'opposition, page
//     valable comme page « lien expiré » ; libellés exacts ;
//   - « Recevoir à nouveau » seulement si le serveur dit levable (le lien qui a servi, dans les 24 h) ; mode réduit avec
//     un jeton un clic (ni adresse masquée, ni retour en arrière) ; repli par l'adresse ; pages « ancien » et « non
//     valable » avec le contact du cabinet ; aucune date affichée ; langue déclarée (lang) ;
//   - la mise en page racine de la section (sans coquille) ne rend ni script, ni données structurées, ni VitFix.

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const simul = vi.hoisted(() => ({ cabinet: null as null | { langue: 'fr' | 'pt'; contact: string | null }, lectures: [] as string[] }))
vi.mock('@/lib/aj-signalement/serveur-desinscription', () => ({
  cabinetDuCheminDesinscriptionQr: vi.fn(async (identifiant: string) => {
    simul.lectures.push(identifiant)
    return simul.cabinet
  }),
}))

const { default: DesinscriptionDiffusionQr } = await import('@/components/aj-signalement/DesinscriptionDiffusionQr')
const { TEXTES_DESINSCRIPTION_QR } = await import('@/lib/aj-signalement/textes-desinscription')
const T = TEXTES_DESINSCRIPTION_QR.fr
const TP = TEXTES_DESINSCRIPTION_QR.pt

// Phrases exactes du droit § 5.4 (page de confirmation, avant le clic) et libellés du cahier § 7.5.
const QUITTER = 'Vous ne recevrez plus les informations sur les incidents de cet immeuble : coupures d’eau, fuites, interventions.'
const GARDER = 'Vous continuerez à recevoir la confirmation de vos propres signalements.'
const BOUTON = 'Ne plus recevoir les informations sur cet immeuble'
const RECEVOIR = 'Recevoir à nouveau ces informations'
const QUITTER_PT = 'Deixará de receber as informações sobre os incidentes deste prédio: cortes de água, fugas, intervenções.'
const GARDER_PT = 'Continuará a receber a confirmação das suas próprias ocorrências.'

const JETON = `${'a'.repeat(32)}.${'b'.repeat(64)}`
const ID = 'cabinet-exemple'
const UNE_DATE = /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i

type Appel = { url: string; corps: unknown; ancre: string; ordre: number }
let appels: Appel[] = []
let ordre = 0
const remplacements: number[] = []

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

function simulerFetch(routeur: (url: string, corps: unknown) => Response | Promise<Response>) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const corps = init?.body ? JSON.parse(String(init.body)) : null
    appels.push({ url, corps, ancre: window.location.hash, ordre: ordre++ })
    return routeur(url, corps)
  }))
}

const valide = (reglages: Record<string, unknown> = {}) => ({
  etat: 'valide', type: 'page', langue: 'fr', cabinet: 'Cabinet Exemple', copropriete: 'Résidence Exemple',
  emailMasque: 'ma***@exemple.test', oppose: false, levable: false, politiqueUrl: 'https://cabinet-exemple.test/confidentialite',
  ...reglages,
})

const ouvrir = (cabinet: { langue: 'fr' | 'pt'; contact: string | null } | null = { langue: 'fr', contact: 'contact@cabinet-exemple.test' }) =>
  render(<DesinscriptionDiffusionQr identifiant={ID} cabinet={cabinet} />)

/** Position d'un texte dans la page (ordre du document). */
function avant(premier: HTMLElement, second: HTMLElement): boolean {
  return Boolean(premier.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
}

beforeEach(() => {
  vi.clearAllMocks()
  simul.cabinet = null
  simul.lectures = []
  ordre = 0
  remplacements.length = 0
  window.history.replaceState(null, '', `/${ID}/desinscription/#${JETON}`)
  const original = window.history.replaceState.bind(window.history)
  vi.spyOn(window.history, 'replaceState').mockImplementation((...args: Parameters<History['replaceState']>) => {
    remplacements.push(ordre++)
    original(...args)
  })
  document.documentElement.lang = 'fr'
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ouverture du lien : fragment effacé avant tout appel, lecture sans effet', () => {
  it('replaceState AVANT tout fetch ; la seule requête est la lecture, avec le jeton et le cabinet du chemin', async () => {
    simulerFetch(() => json(valide()))
    ouvrir()
    expect(await screen.findByRole('button', { name: BOUTON })).toBeInTheDocument()
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe(`/${ID}/desinscription/`)
    expect(appels).toHaveLength(1)
    expect(appels[0].url).toBe('/api/aj-signalement/desinscription/lecture')
    expect(appels[0].corps).toEqual({ jeton: JETON, identifiant: ID })
    expect(appels[0].ancre).toBe('')
    expect(remplacements.length).toBeGreaterThan(0)
    expect(remplacements[0]).toBeLessThan(appels[0].ordre)
  })

  it('lien valable : un seul titre, la copropriété, le cabinet, l’adresse masquée, les deux phrases AVANT le bouton', async () => {
    simulerFetch(() => json(valide()))
    const { container } = ouvrir()
    const bouton = await screen.findByRole('button', { name: BOUTON })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Informations sur votre immeuble')
    expect(screen.getByText('Résidence Exemple — informations envoyées par Cabinet Exemple à ma***@exemple.test')).toBeInTheDocument()
    expect(avant(screen.getByText(QUITTER), bouton)).toBe(true)
    expect(avant(screen.getByText(GARDER), bouton)).toBe(true)
    // Aucun « êtes-vous sûr ? », aucune question, aucune date.
    expect(container.textContent).not.toMatch(/sûr|\?/)
    expect(container.textContent).not.toMatch(UNE_DATE)
    // Pied : politique du cabinet (adresse https seulement), sans référent.
    const lien = screen.getByRole('link', { name: 'Politique de confidentialité de Cabinet Exemple' })
    expect(lien).toHaveAttribute('href', 'https://cabinet-exemple.test/confidentialite')
    expect(lien.getAttribute('rel')).toContain('noreferrer')
    expect(container.querySelector('[lang="fr"]')).not.toBeNull()
    expect(document.documentElement.lang).toBe('fr')
  })

  it('l’ouverture n’a aucun effet : aucun appel d’opposition sans clic', async () => {
    simulerFetch(() => json(valide()))
    ouvrir()
    await screen.findByRole('button', { name: BOUTON })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(appels.map((a) => a.url)).toEqual(['/api/aj-signalement/desinscription/lecture'])
  })

  it('sans fragment (ou hors format) : « Ce lien n’est pas valable » avec le contact du cabinet du chemin, aucun appel', async () => {
    simulerFetch(() => json(valide()))
    window.history.replaceState(null, '', `/${ID}/desinscription/#pas-un-jeton`)
    ouvrir()
    expect(await screen.findByText('Ce lien n’est pas valable. Utilisez le bouton d’un message plus récent, ou écrivez au cabinet : contact@cabinet-exemple.test.')).toBeInTheDocument()
    expect(window.location.hash).toBe('')
    expect(appels).toEqual([])
    expect(screen.queryByRole('button', { name: BOUTON })).toBeNull()
  })

  it('identifiant du chemin hors format : page « non valable » sans contact, aucun appel', async () => {
    simulerFetch(() => json(valide()))
    render(<DesinscriptionDiffusionQr identifiant={null} cabinet={null} />)
    expect(await screen.findByText('Ce lien n’est pas valable. Utilisez le bouton d’un message plus récent, ou écrivez au cabinet.')).toBeInTheDocument()
    expect(appels).toEqual([])
  })
})

describe('effet au clic', () => {
  it('« Ne plus recevoir » : opposition, message, ce qu’on garde, « Recevoir à nouveau » (levable), focus sur le résultat', async () => {
    simulerFetch((url) => (url.endsWith('/lecture') ? json(valide()) : json({ oppose: true, levable: true })))
    ouvrir()
    fireEvent.click(await screen.findByRole('button', { name: BOUTON }))
    const resultat = await screen.findByText('C’est enregistré : vous ne recevrez plus les informations sur cet immeuble.')
    expect(appels[1]).toMatchObject({ url: '/api/aj-signalement/desinscription', corps: { jeton: JETON, identifiant: ID } })
    expect(screen.getByText(GARDER)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: RECEVOIR })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: BOUTON })).toBeNull()
    await waitFor(() => expect(resultat.closest('[tabindex="-1"]')).toHaveFocus())
  })

  it('opposition faite mais non levable par ce lien : aucun « Recevoir à nouveau »', async () => {
    simulerFetch((url) => (url.endsWith('/lecture') ? json(valide()) : json({ oppose: true, levable: false })))
    ouvrir()
    fireEvent.click(await screen.findByRole('button', { name: BOUTON }))
    await screen.findByText('C’est enregistré : vous ne recevrez plus les informations sur cet immeuble.')
    expect(screen.queryByRole('button', { name: RECEVOIR })).toBeNull()
  })

  it('« Recevoir à nouveau » : levée, message, puis les deux phrases AVANT le bouton d’opposition qui revient', async () => {
    simulerFetch((url) => {
      if (url.endsWith('/lecture')) return json(valide())
      if (url.endsWith('/reprendre')) return json({ oppose: false })
      return json({ oppose: true, levable: true })
    })
    ouvrir()
    fireEvent.click(await screen.findByRole('button', { name: BOUTON }))
    fireEvent.click(await screen.findByRole('button', { name: RECEVOIR }))
    expect(await screen.findByText('C’est enregistré : vous recevrez de nouveau les informations sur cet immeuble.')).toBeInTheDocument()
    expect(appels[2]).toMatchObject({ url: '/api/aj-signalement/desinscription/reprendre', corps: { jeton: JETON, identifiant: ID } })
    const bouton = screen.getByRole('button', { name: BOUTON })
    expect(avant(screen.getByText(QUITTER), bouton)).toBe(true)
    expect(avant(screen.getByText(GARDER), bouton)).toBe(true)
  })

  it('« Recevoir à nouveau » refusé (autre lien, plus de 24 h) : message, le bouton disparaît', async () => {
    simulerFetch((url) => (url.endsWith('/lecture') ? json(valide({ oppose: true, levable: true })) : json({ error: 'non_levable' }, 409)))
    ouvrir()
    fireEvent.click(await screen.findByRole('button', { name: RECEVOIR }))
    expect(await screen.findByText(T.nonLevable)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: RECEVOIR })).toBeNull()
  })

  it('lien devenu expiré au clic (410) : repli par l’adresse', async () => {
    simulerFetch((url) => (url.endsWith('/lecture') ? json(valide()) : json({ error: 'lien_expire' }, 410)))
    ouvrir()
    fireEvent.click(await screen.findByRole('button', { name: BOUTON }))
    expect(await screen.findByLabelText(T.champEmail)).toBeInTheDocument()
  })

  it('limite atteinte (429) ou réseau coupé : message traduit, le bouton reste', async () => {
    let n = 0
    simulerFetch((url) => {
      if (url.endsWith('/lecture')) return json(valide())
      n += 1
      if (n === 1) return json({ error: 'limite' }, 429)
      throw new TypeError('Failed to fetch')
    })
    ouvrir()
    fireEvent.click(await screen.findByRole('button', { name: BOUTON }))
    expect(await screen.findByText(T.limite)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: BOUTON }))
    expect(await screen.findByText(T.reseau)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: BOUTON })).toBeInTheDocument()
  })
})

describe('déjà désinscrit, mode réduit (jeton un clic)', () => {
  it('déjà désinscrit et levable : « Vous ne recevez plus… » et « Recevoir à nouveau », aucune date', async () => {
    simulerFetch(() => json(valide({ oppose: true, levable: true })))
    const { container } = ouvrir()
    expect(await screen.findByText('Vous ne recevez plus les informations sur cet immeuble.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: RECEVOIR })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: BOUTON })).toBeNull()
    expect(container.textContent).not.toMatch(UNE_DATE)
  })

  it('déjà désinscrit, non levable : aucun bouton', async () => {
    simulerFetch(() => json(valide({ oppose: true, levable: false })))
    ouvrir()
    await screen.findByText('Vous ne recevez plus les informations sur cet immeuble.')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('jeton un clic : sans l’adresse masquée ni état d’opposition (le bouton est toujours là) ; après le clic, jamais « Recevoir à nouveau » (même si une réponse le disait)', async () => {
    simulerFetch((url) => (url.endsWith('/lecture')
      ? json(valide({ type: 'un_clic', emailMasque: undefined, oppose: undefined, levable: undefined }))
      : json({ oppose: true, levable: true })))
    ouvrir()
    expect(await screen.findByText('Résidence Exemple — informations envoyées par Cabinet Exemple')).toBeInTheDocument()
    expect(screen.queryByText(/ma\*\*\*/)).toBeNull()
    expect(screen.getByText(QUITTER)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: BOUTON }))
    await screen.findByText('C’est enregistré : vous ne recevrez plus les informations sur cet immeuble.')
    expect(screen.queryByRole('button', { name: RECEVOIR })).toBeNull()
  })
})

describe('repli « lien expiré », pages « ancien » et « non valable »', () => {
  const expire = { etat: 'expire', type: 'page', langue: 'fr', cabinet: 'Cabinet Exemple', copropriete: 'Résidence Exemple', politiqueUrl: 'https://cabinet-exemple.test/confidentialite' }

  it('lien expiré : texte, les deux phrases AVANT le bouton, champ d’adresse ; réponse toujours la même', async () => {
    simulerFetch((url) => (url.endsWith('/lecture') ? json(expire) : json({ ok: true })))
    const { container } = ouvrir()
    expect(await screen.findByText('Ce lien a plus d’un an. Pour ne plus recevoir les informations sur Résidence Exemple, indiquez l’adresse e-mail à laquelle vous les receviez.')).toBeInTheDocument()
    const bouton = screen.getByRole('button', { name: BOUTON })
    expect(avant(screen.getByText(QUITTER), bouton)).toBe(true)
    expect(avant(screen.getByText(GARDER), bouton)).toBe(true)
    const champ = screen.getByLabelText(T.champEmail)
    expect(champ).toHaveAttribute('type', 'email')
    expect(container.textContent).not.toMatch(/ma\*\*\*/)
    fireEvent.change(champ, { target: { value: 'marie.dupont@exemple.test' } })
    fireEvent.click(bouton)
    expect(await screen.findByText('C’est noté. Si cette adresse est celle à laquelle ce message a été envoyé, elle ne recevra plus les informations sur cet immeuble.')).toBeInTheDocument()
    expect(appels[1]).toMatchObject({ url: '/api/aj-signalement/desinscription/adresse', corps: { jeton: JETON, identifiant: ID, email: 'marie.dupont@exemple.test' } })
    expect(screen.getByRole('link', { name: 'Politique de confidentialité de Cabinet Exemple' })).toBeInTheDocument()
  })

  it('adresse vide ou hors format : message relié au champ, aucun appel', async () => {
    simulerFetch((url) => (url.endsWith('/lecture') ? json(expire) : json({ ok: true })))
    ouvrir()
    const champ = await screen.findByLabelText(T.champEmail)
    fireEvent.change(champ, { target: { value: 'pas-une-adresse' } })
    fireEvent.click(screen.getByRole('button', { name: BOUTON }))
    expect(await screen.findByText(T.emailInvalide)).toBeInTheDocument()
    expect(champ).toHaveAttribute('aria-invalid', 'true')
    expect(appels).toHaveLength(1)
  })

  it('limite atteinte sur le repli (429) : message traduit, jamais « C’est noté »', async () => {
    simulerFetch((url) => (url.endsWith('/lecture') ? json(expire) : json({ error: 'limite' }, 429)))
    ouvrir()
    fireEvent.change(await screen.findByLabelText(T.champEmail), { target: { value: 'marie.dupont@exemple.test' } })
    fireEvent.click(screen.getByRole('button', { name: BOUTON }))
    expect(await screen.findByText(T.limite)).toBeInTheDocument()
    expect(screen.queryByText(/C’est noté/)).toBeNull()
  })

  it('ancien lien (diffusion purgée) : contact du cabinet du chemin, politique ; ni formulaire ni bouton', async () => {
    simulerFetch(() => json({ etat: 'ancien', langue: 'fr', cabinet: 'Cabinet Exemple', contactCabinet: 'contact@cabinet-exemple.test', politiqueUrl: 'https://cabinet-exemple.test/confidentialite' }))
    ouvrir()
    expect(await screen.findByText('Ce lien est trop ancien. Pour ne plus recevoir les informations sur cet immeuble, utilisez le bouton d’un message plus récent, ou écrivez à Cabinet Exemple : contact@cabinet-exemple.test.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('link', { name: 'Politique de confidentialité de Cabinet Exemple' })).toBeInTheDocument()
  })

  it('lien non valable : contact du cabinet du chemin s’il en a un ; aucun formulaire, aucune politique', async () => {
    simulerFetch(() => json({ etat: 'inconnu', langue: 'fr', contactCabinet: 'contact@cabinet-exemple.test' }))
    ouvrir()
    expect(await screen.findByText('Ce lien n’est pas valable. Utilisez le bouton d’un message plus récent, ou écrivez au cabinet : contact@cabinet-exemple.test.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('politique hors https (jamais une adresse javascript:) : aucun lien', async () => {
    simulerFetch(() => json(valide({ politiqueUrl: 'javascript:alert(1)' })))
    ouvrir()
    await screen.findByRole('button', { name: BOUTON })
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('langue, erreurs de lecture', () => {
  it('diffusion en portugais : textes PT, lang="pt" sur la page et sur le document', async () => {
    simulerFetch(() => json(valide({ langue: 'pt' })))
    const { container } = ouvrir()
    expect(await screen.findByRole('button', { name: TP.boutonOpposer })).toBeInTheDocument()
    expect(screen.getByText(QUITTER_PT)).toBeInTheDocument()
    expect(screen.getByText(GARDER_PT)).toBeInTheDocument()
    expect(container.querySelector('[lang="pt"]')).not.toBeNull()
    expect(document.documentElement.lang).toBe('pt')
    expect(document.title).toBe(TP.titre)
  })

  it('lecture refusée par la limite (429) puis réseau : message et « Réessayer » ; le jeton reste en mémoire', async () => {
    let n = 0
    simulerFetch(() => {
      n += 1
      if (n === 1) return json({ error: 'limite' }, 429)
      return json(valide())
    })
    ouvrir()
    expect(await screen.findByText(T.limite)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: T.reessayer }))
    expect(await screen.findByRole('button', { name: BOUTON })).toBeInTheDocument()
    expect(appels.map((a) => a.corps)).toEqual([{ jeton: JETON, identifiant: ID }, { jeton: JETON, identifiant: ID }])
  })

  it('réponse de lecture illisible (500) : service indisponible, « Réessayer »', async () => {
    simulerFetch(() => json({ error: 'serveur' }, 500))
    ouvrir()
    expect(await screen.findByText(T.indisponible)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: T.reessayer })).toBeInTheDocument()
  })
})

describe('page et mise en page racine (sans coquille)', () => {
  it('mise en page racine : <html lang="fr">, aucun script, aucune donnée structurée, ni VitFix ni mesure d’audience', async () => {
    const { default: LayoutSansCoquille, metadata } = await import('@/app/(sans-coquille)/layout')
    const html = renderToStaticMarkup(<LayoutSansCoquille><p>contenu</p></LayoutSansCoquille>)
    expect(html).toMatch(/^<html lang="fr"/)
    expect(html).not.toMatch(/<script|ld\+json|googletagmanager|cloudflareinsights|vitfix/i)
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    expect(metadata.referrer).toBe('no-referrer')
  })

  it('page : métadonnées noindex et no-referrer, titre sans VitFix', async () => {
    const { metadata, dynamic } = await import('@/app/(sans-coquille)/cabinet/[identifiant]/desinscription/page')
    expect(dynamic).toBe('force-dynamic')
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    expect(metadata.referrer).toBe('no-referrer')
    expect(String(metadata.title)).not.toMatch(/vitfix|aj signalement/i)
  })

  it('page : identifiant hors format → aucune lecture, composant sans identifiant ; sinon langue et contact du cabinet du chemin', async () => {
    const { default: Page } = await import('@/app/(sans-coquille)/cabinet/[identifiant]/desinscription/page')
    const horsFormat = await Page({ params: Promise.resolve({ identifiant: 'Pas_Valable' }) })
    expect(horsFormat.props).toEqual({ identifiant: null, cabinet: null })
    expect(simul.lectures).toEqual([])
    simul.cabinet = { langue: 'pt', contact: 'contact@cabinet-exemple.test' }
    const element = await Page({ params: Promise.resolve({ identifiant: ID }) })
    expect(element.props).toEqual({ identifiant: ID, cabinet: { langue: 'pt', contact: 'contact@cabinet-exemple.test' } })
    expect(simul.lectures).toEqual([ID])
  })
})
