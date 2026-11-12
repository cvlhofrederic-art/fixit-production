// tests/components/aj-signalement-diffusion.test.tsx
//
// AJ Signalement, PR 3 — écrans de la diffusion (brouillons soumis à Frédéric, décision F1).
//   - Lot 6 : PAGE PUBLIQUE de désinscription (vitfix.io/<identifiant>/desinscription/#<jeton>, cahier § 7.5, § 7.6,
//     § 8.1, décisions F1 et F3) ;
//   - Lot 8 (en fin de fichier) : écrans de l'espace — formulaire « Diffuser un message », message d'annonce (H1 = C),
//     historique, point d'entrée (carte, détail d'un signalement, droit « diffuser » H11), activation de la diffusion d'un
//     cabinet (D-R8), fin de mission sur la fiche de la copropriété (H7) ; cahier § 7.1 à 7.4 et § 7.6.
//
// Ce qui est prouvé (lot 6) :
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
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const simul = vi.hoisted(() => ({ cabinet: null as null | { langue: 'fr' | 'pt'; contact: string | null }, lectures: [] as string[] }))
vi.mock('@/lib/aj-signalement/serveur-desinscription', () => ({
  cabinetDuCheminDesinscriptionQr: vi.fn(async (identifiant: string) => {
    simul.lectures.push(identifiant)
    return simul.cabinet
  }),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { default: DesinscriptionDiffusionQr } = await import('@/components/aj-signalement/DesinscriptionDiffusionQr')
const { TEXTES_DESINSCRIPTION_QR } = await import('@/lib/aj-signalement/textes-desinscription')
const T = TEXTES_DESINSCRIPTION_QR.fr
const TP = TEXTES_DESINSCRIPTION_QR.pt

// Lot 8 : écrans de l'espace.
const { default: FenetreDiffusionQr } = await import('@/components/aj-signalement/FenetreDiffusionQr')
const { default: TableauSignalementsQr } = await import('@/components/aj-signalement/TableauSignalementsQr')
const { default: CabinetsQr } = await import('@/components/aj-signalement/CabinetsQr')
const { default: ModaleCoproprieteQr } = await import('@/components/aj-signalement/ModaleCoproprieteQr')
const { TEXTES_ECRAN_DIFFUSION_QR: TD } = await import('@/lib/aj-signalement/affichage-ecran-diffusion')
const { MESSAGES_REFUS_TEXTE_DIFFUSION_QR, NOMS_MODELES_DIFFUSION_QR, TEXTES_MODELES_DIFFUSION_QR, annonceDiffusionQr } = await import('@/lib/aj-signalement/affichage-diffusion')
const { TEXTES_TABLEAU_QR: TT, dateHeureParis } = await import('@/lib/aj-signalement/affichage')
const { TEXTES_ESPACE_CABINET_QR: TEC } = await import('@/lib/aj-signalement/affichage-gestionnaire')
const { remplir } = await import('@/lib/coproprietaire/textes')
const { gestionCoproprieteQrVide } = await import('@/lib/aj-signalement/types')
const { toast } = await import('sonner')
type CoproprieteQr = import('@/lib/aj-signalement/types').CoproprieteQr
type SignalementQr = import('@/lib/aj-signalement/types').SignalementQr
type CabinetQr = import('@/lib/aj-signalement/types').CabinetQr

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

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Lot 8 — écrans de l'espace (BROUILLON pour Frédéric) : « Diffuser un message », message d'annonce, historique, point
// d'entrée, activation du cabinet, fin de mission. Cahier § 7.1 à 7.4, § 7.6, § 10.1 ; droit § 5.6 ; décisions de Hugo
// du 11/11/2026 (aucun plafond et rappel du mois ; H1 = C ; H7 ; H11). Routes simulées par fetch ; aucune base.
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Phrase du droit § 5.6 (« sans risque » 9), À LA LETTRE. */
const PHRASE = 'Ce message est une information de confort. Il ne remplace ni l\'affichage ni la notification que la loi impose.'
const COPRO_D = 'c0000000-0000-4000-8000-0000000000d1'
const COPRO_D2 = 'c0000000-0000-4000-8000-0000000000d2'
const COPRO_D3 = 'c0000000-0000-4000-8000-0000000000d3'
const CAB_D = 'ca000000-0000-4000-8000-0000000000d1'
const SIG_D = 'a1000000-0000-4000-8000-0000000000d1'
const DIFF_D = 'df000000-0000-4000-8000-0000000000d1'
const DIFF_D2 = 'df000000-0000-4000-8000-0000000000d2'
const DIFF_D3 = 'df000000-0000-4000-8000-0000000000d3'
const BASE_D = `/api/aj-signalement/coproprietes/${COPRO_D}/diffusions`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const OBJET_D = 'Coupure d’eau demain matin'
const TEXTE_D = 'L’eau sera coupée demain de 9 h à 10 h pour une réparation.'
const REFERENCE_D = 'Courriel de la gestionnaire du 01/11/2026'

type AppelEspace = { url: string; methode: string; corps: Record<string, unknown> | null }
let appelsEspace: AppelEspace[] = []
function simulerEspace(routeur: (a: AppelEspace) => Response | Promise<Response>) {
  appelsEspace = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const a: AppelEspace = { url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) : null }
    appelsEspace.push(a)
    return routeur(a)
  }))
}
const appelsVers = (url: string, methode?: string) => appelsEspace.filter((a) => a.url === url && (!methode || a.methode === methode))
const reprises = () => appelsEspace.filter((a) => a.url.endsWith('/reprendre'))

function differe<V>() {
  let resoudre!: (v: V) => void
  const promesse = new Promise<V>((r) => { resoudre = r })
  return { promesse, resoudre }
}

const batimentsD = () => [
  { cle: 'a', libelle: 'Bâtiment A', libelleASaisir: false, variantes: ['A', 'Bât. A'], sansEtage: 0, etages: [{ cle: '1', libelle: '1er étage', libelleASaisir: false, variantes: ['1', '1er'] }] },
  { cle: 'b', libelle: 'Bâtiment B', libelleASaisir: false, variantes: ['B'], sansEtage: 1, etages: [{ cle: '3', libelle: '3e étage', libelleASaisir: false, variantes: ['3'] }] },
]
const valeursD = (r: Record<string, unknown> = {}) => ({
  possible: true, raison: null, langue: 'fr', batiments: batimentsD(), sansBatiment: 1, porteeParDefaut: 'batiment',
  ceMois: { nb: 3, dernierLe: '2026-11-08T10:00:00+00:00' }, nbNonAnnonces: 0, finMissionLe: null, ...r,
})
const LIBELLES_D: Record<string, string> = {
  copropriete: 'Toute la copropriété', batiment: 'Bâtiment B', etage: 'Bâtiment B · 3e étage', signalement: 'Déclarants du signalement',
}
const apercuD = (n = 23, r: Record<string, unknown> = {}) => ({
  nbDestinataires: n, nbExclusOpposition: 2, libellePerimetre: 'Bâtiment B · 3e étage', libelleASaisir: false,
  instant: '2026-11-12T10:00:00.123456+00:00', possible: true, raison: null, ...r,
})
const porteeDe = (corps: Record<string, unknown>) => String((corps.perimetre as { portee?: string } | undefined)?.portee ?? '')
const envoiD = (r: Record<string, unknown> = {}) =>
  json({ diffusionId: DIFF_D, nbDestinataires: 23, envoyes: 21, refuses: 2, reste: 0, arret: null, rejeu: false, ...r }, 201)

interface ScenarioD {
  valeurs?: Record<string, unknown> | Response
  apercu?: (corps: Record<string, unknown>) => Record<string, unknown> | Response
  envoi?: (corps: Record<string, unknown>) => Response | Promise<Response>
  reprises?: Array<Record<string, unknown> | Response | Promise<Response>>
  historique?: (url: string) => Record<string, unknown> | Response
  details?: Record<string, Record<string, unknown>>
  /** Réponse de D-R7 (opposition à la demande écrite) ; défaut : enregistrée. */
  opposition?: () => Response
}

/** Routes de la diffusion simulées (D-R1 à D-R7) ; toute autre adresse : 404. */
function routeurD(s: ScenarioD = {}) {
  const suite = [...(s.reprises ?? [])]
  return async (a: AppelEspace): Promise<Response> => {
    if (a.url === `${BASE_D}/valeurs`) return s.valeurs instanceof Response ? s.valeurs : json(s.valeurs ?? valeursD())
    if (a.url === `${BASE_D}/apercu`) {
      const corps = a.corps ?? {}
      const r = s.apercu ? s.apercu(corps) : apercuD(23, { libellePerimetre: LIBELLES_D[porteeDe(corps)] })
      return r instanceof Response ? r : json(r)
    }
    if (a.url === BASE_D && a.methode === 'POST') return s.envoi ? s.envoi(a.corps ?? {}) : envoiD()
    if (a.url.startsWith(BASE_D) && a.methode === 'GET') {
      const r = s.historique ? s.historique(a.url) : { diffusions: [], ceMois: { nb: 0, dernierLe: null }, suivant: null }
      return r instanceof Response ? r : json(r)
    }
    if (/^\/api\/aj-signalement\/diffusions\/[^/]+\/reprendre$/.test(a.url)) {
      const r = await (suite.shift() ?? { envoyes: 0, refuses: 0, reste: 0, arret: null })
      return r instanceof Response ? r : json(r)
    }
    const detail = /^\/api\/aj-signalement\/diffusions\/([^/]+)$/.exec(a.url)
    if (detail) return json({ diffusion: s.details?.[detail[1]] ?? {} })
    if (a.url.endsWith('/opposition') && a.methode === 'POST') return s.opposition ? s.opposition() : json({ enregistree: true })
    return json({ error: 'introuvable' }, 404)
  }
}

const COPRO_ECRAN_D = { id: COPRO_D, nom: 'Résidence Exemple', cabinetNom: 'Cabinet Exemple' }
const rappelsD = { onFermer: vi.fn(), onGarde: vi.fn() }
const titreMessage = () => remplir(TD.titres.message, { copropriete: 'Résidence Exemple' })

function ouvrirDiffusion(props: Partial<React.ComponentProps<typeof FenetreDiffusionQr>> = {}) {
  return render(
    <FenetreDiffusionQr copropriete={COPRO_ECRAN_D} profil="super_admin" contenu="message" delaiRepriseMs={0} {...rappelsD} {...props} />,
  )
}

/** Fenêtre ouverte et valeurs de D-R1 lues (le bouton « Vérifier et envoyer » est affiché). */
async function fenetrePrete(titre = titreMessage()) {
  const dialogue = await screen.findByRole('dialog', { name: titre })
  await screen.findByRole('button', { name: TD.boutons.verifier })
  return dialogue
}

const choisir = (nom: string) => fireEvent.click(screen.getByRole('radio', { name: nom }))
const saisir = (etiquette: string, valeur: string) => fireEvent.change(screen.getByLabelText(etiquette), { target: { value: valeur } })

function saisirMessage(instruction = true) {
  saisir(TD.formulaire.objet, OBJET_D)
  saisir(TD.formulaire.texte, TEXTE_D)
  if (instruction) {
    saisir(TD.instruction.reference, REFERENCE_D)
    saisir(TD.instruction.date, '2026-11-01')
  }
}

/** « Vérifier et envoyer », puis la confirmation (bouton « Envoyer à n personnes »). */
async function verifier(nom = 'Envoyer à 23 personnes') {
  fireEvent.click(screen.getByRole('button', { name: TD.boutons.verifier }))
  return screen.findByRole('button', { name: nom })
}

/** Étage B · 3e (clés b, 3), objet et texte saisis, instruction (super admin), puis la confirmation. */
async function jusquALaConfirmation(instruction = true) {
  choisir(TD.portee.etage)
  choisir('Bâtiment B')
  choisir('3e étage')
  saisirMessage(instruction)
  return verifier()
}

describe('lot 8 — « Diffuser un message » : ouverture, rappel du mois, modèles, portée', () => {
  it('ouverture : D-R1 seul, focus sur le titre, rappel du mois exact, sept modèles (sans l’annonce), « Un bâtiment » présélectionné sans bâtiment choisi : aucun aperçu', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion()
    await fenetrePrete()
    await waitFor(() => expect(screen.getByRole('heading', { name: titreMessage() })).toHaveFocus())
    expect(appelsEspace.map((a) => `${a.methode} ${a.url}`)).toEqual([`GET ${BASE_D}/valeurs`])
    expect(screen.getByText('Ce mois-ci : 3 messages envoyés sur cette copropriété (dernier le 08/11/2026).')).toBeInTheDocument()
    const modeles = within(screen.getByRole('group', { name: TD.formulaire.modele })).getAllByRole('radio')
    expect(modeles.map((m) => m.closest('label')?.textContent)).toEqual([
      'Fuite en cours', 'Coupure d’eau', 'Coupure d’électricité', 'Intervention programmée', 'Ascenseur à l’arrêt', 'Fin d’incident', 'Message libre',
    ])
    expect(screen.queryByRole('radio', { name: NOMS_MODELES_DIFFUSION_QR.annonce })).toBeNull()
    expect(screen.getByRole('group', { name: TD.portee.legende })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: TD.portee.batiment })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Bâtiment A' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Bâtiment B' })).not.toBeChecked()
    expect(screen.getByText(TD.portee.choisirBatiment)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Bâtiment A' })).toHaveAccessibleDescription(remplir(TD.portee.regroupe, { variantes: 'A, Bât. A' }))
    expect(screen.getByText(remplir(TD.portee.sansBatiment, { n: 1 }))).toBeInTheDocument()
  })

  it('moins de deux bâtiments : « Toute la copropriété » présélectionnée, aperçu immédiat ; nombre exact dans une région aria-live polite', async () => {
    simulerEspace(routeurD({ valeurs: valeursD({ porteeParDefaut: 'copropriete', batiments: [batimentsD()[0]] }) }))
    ouvrirDiffusion()
    await fenetrePrete()
    const nombre = await screen.findByText('Ce message partira à 23 personnes — Toute la copropriété.')
    expect(nombre.closest('[aria-live="polite"]')).not.toBeNull()
    expect(screen.getByText('2 personnes ont demandé à ne plus recevoir ces informations.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: TD.portee.copropriete })).toBeChecked()
    expect(appelsVers(`${BASE_D}/apercu`).map((a) => a.corps)).toEqual([{ perimetre: { portee: 'copropriete' } }])
  })

  it('un bâtiment puis un étage : D-R2 à chaque choix complet (des CLÉS), libellé du serveur ; 0 personne → « Vérifier et envoyer » désactivé', async () => {
    simulerEspace(routeurD({ apercu: (c) => apercuD(porteeDe(c) === 'etage' ? 0 : 7, { libellePerimetre: LIBELLES_D[porteeDe(c)] }) }))
    ouvrirDiffusion()
    await fenetrePrete()
    choisir('Bâtiment B')
    expect(await screen.findByText('Ce message partira à 7 personnes — Bâtiment B.')).toBeInTheDocument()
    choisir(TD.portee.etage)
    expect(screen.getByText(TD.portee.choisirEtage)).toBeInTheDocument()
    expect(screen.getByText(remplir(TD.portee.sansEtage, { n: 1 }))).toBeInTheDocument()
    choisir('3e étage')
    expect(await screen.findByText(TD.nombre.personne)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: TD.boutons.verifier })).toBeDisabled()
    expect(appelsVers(`${BASE_D}/apercu`).map((a) => a.corps)).toEqual([
      { perimetre: { portee: 'batiment', batiment: 'b' } },
      { perimetre: { portee: 'etage', batiment: 'b', etage: '3' } },
    ])
  })

  it('aucun bâtiment dans les signalements : seule « Toute la copropriété » est proposée', async () => {
    simulerEspace(routeurD({ valeurs: valeursD({ batiments: [], porteeParDefaut: 'copropriete', sansBatiment: 4 }) }))
    ouvrirDiffusion()
    await fenetrePrete()
    expect(screen.getByRole('radio', { name: TD.portee.copropriete })).toBeChecked()
    expect(screen.queryByRole('radio', { name: TD.portee.batiment })).toBeNull()
    expect(screen.getByText(TD.portee.aucunBatiment)).toBeInTheDocument()
  })

  it('modèle : le choix remplit objet et texte (langue du cabinet) ; après saisie, changer de modèle demande confirmation', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion()
    await fenetrePrete()
    choisir('Coupure d’eau')
    expect(screen.getByLabelText(TD.formulaire.objet)).toHaveValue(TEXTES_MODELES_DIFFUSION_QR.coupure_eau.fr.objet)
    expect(screen.getByLabelText(TD.formulaire.texte)).toHaveValue(TEXTES_MODELES_DIFFUSION_QR.coupure_eau.fr.texte)
    // Modèle non retouché : un autre modèle le remplace sans question.
    choisir('Fuite en cours')
    expect(screen.getByLabelText(TD.formulaire.objet)).toHaveValue(TEXTES_MODELES_DIFFUSION_QR.fuite.fr.objet)
    saisir(TD.formulaire.texte, 'Mon texte à moi, sur la fuite du hall.')
    choisir('Intervention programmée')
    const question = remplir(TD.formulaire.remplacerModele, { modele: 'Intervention programmée' })
    expect(screen.getByText(question)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Fuite en cours' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: TD.formulaire.garder }))
    expect(screen.queryByText(question)).toBeNull()
    expect(screen.getByLabelText(TD.formulaire.texte)).toHaveValue('Mon texte à moi, sur la fuite du hall.')
    choisir('Intervention programmée')
    fireEvent.click(screen.getByRole('button', { name: TD.formulaire.remplacer }))
    expect(screen.getByLabelText(TD.formulaire.texte)).toHaveValue(TEXTES_MODELES_DIFFUSION_QR.intervention.fr.texte)
    expect(screen.getByRole('radio', { name: 'Intervention programmée' })).toBeChecked()
  })

  it('champs : objet 120 et texte 2 000 caractères, compteurs ; aide du texte reliée au champ (aria-describedby)', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion()
    await fenetrePrete()
    const objet = screen.getByLabelText(TD.formulaire.objet)
    const texte = screen.getByLabelText(TD.formulaire.texte)
    expect(objet).toHaveAttribute('maxLength', '120')
    expect(texte).toHaveAttribute('maxLength', '2000')
    expect(texte).toHaveAccessibleDescription(expect.stringContaining(TD.formulaire.aideTexte))
    saisir(TD.formulaire.objet, 'Coupure')
    expect(screen.getByText(remplir(TD.formulaire.compteur, { n: 7, max: 120 }))).toBeInTheDocument()
  })

  it('copropriété qui ne peut pas diffuser : la raison est dite, aucun formulaire ; fin de mission prévue : rappelée', async () => {
    simulerEspace(routeurD({ valeurs: valeursD({ possible: false, raison: 'diffusion_non_activee' }) }))
    const { unmount } = ouvrirDiffusion()
    expect(await screen.findByText(TD.raisons.diffusion_non_activee)).toBeInTheDocument()
    expect(screen.queryByLabelText(TD.formulaire.objet)).toBeNull()
    expect(screen.queryByRole('button', { name: TD.boutons.verifier })).toBeNull()
    unmount()

    simulerEspace(routeurD({ valeurs: valeursD({ finMissionLe: '2026-12-31' }) }))
    ouvrirDiffusion()
    await fenetrePrete()
    expect(screen.getByText(remplir(TD.finMission.info, { date: '31/12/2026' }))).toBeInTheDocument()
  })

  it('fonction pas encore activée (D-R1 503) : « Fonction pas encore activée. » (§ 9), jamais une migration à exécuter ; aucun formulaire', async () => {
    simulerEspace(routeurD({ valeurs: json({ error: 'base_absente' }, 503) }))
    ouvrirDiffusion()
    expect(await screen.findByText(TT.erreurs.configuration_incomplete)).toBeInTheDocument()
    expect(screen.getByRole('dialog').textContent).not.toMatch(/migration|\.sql/)
    expect(screen.queryByLabelText(TD.formulaire.objet)).toBeNull()
  })
})

describe('lot 8 — phrase du droit § 5.6 et confirmation en deux temps', () => {
  it('phrase EXACTE juste au-dessus de « Vérifier et envoyer », après tous les champs, reliée au bouton (aria-describedby)', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion()
    await fenetrePrete()
    const bouton = screen.getByRole('button', { name: TD.boutons.verifier })
    expect(bouton).toHaveAccessibleDescription(PHRASE)
    const phrase = screen.getByText(PHRASE)
    expect(phrase.nextElementSibling?.contains(bouton)).toBe(true)
    expect(avant(screen.getByLabelText(TD.instruction.date), phrase)).toBe(true)
    expect(avant(screen.getByLabelText(TD.formulaire.texte), phrase)).toBe(true)
  })

  it('confirmation : objet, périmètre ÉCRIT PAR LE SERVEUR (aperçu frais), nombre ; la phrase de nouveau juste au-dessus de « Envoyer à 23 personnes », reliée ; « Annuler » revient au formulaire', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion()
    await fenetrePrete()
    const envoyer = await jusquALaConfirmation()
    await waitFor(() => expect(screen.getByRole('heading', { name: TD.confirmation.titre })).toHaveFocus())
    expect(screen.getByText(OBJET_D)).toBeInTheDocument()
    expect(screen.getByText('Bâtiment B · 3e étage')).toBeInTheDocument()
    expect(screen.getByText('23 personnes')).toBeInTheDocument()
    expect(envoyer).toHaveAccessibleDescription(PHRASE)
    const phrases = screen.getAllByText(PHRASE)
    expect(phrases).toHaveLength(1)
    expect(phrases[0].nextElementSibling?.contains(envoyer)).toBe(true)
    // Deux aperçus : celui du choix, puis celui du clic (nombre, libellé et instant de la confirmation).
    expect(appelsVers(`${BASE_D}/apercu`).map((a) => a.corps)).toEqual([
      { perimetre: { portee: 'etage', batiment: 'b', etage: '3' } }, { perimetre: { portee: 'etage', batiment: 'b', etage: '3' } },
    ])
    fireEvent.click(screen.getByRole('button', { name: TD.boutons.annuler }))
    expect(screen.getByLabelText(TD.formulaire.objet)).toHaveValue(OBJET_D)
    expect(screen.getByRole('radio', { name: '3e étage' })).toBeChecked()
    expect(appelsVers(BASE_D, 'POST')).toEqual([])
  })
})

describe('lot 8 — envoi', () => {
  it('D-R3 : corps exact (opération tirée à l’ouverture, libellé confirmé, instant de l’aperçu, nombre attendu, instruction écrite) ; bilan envoyés et refusés', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion()
    await fenetrePrete()
    choisir('Coupure d’eau')
    fireEvent.click(await jusquALaConfirmation())
    expect(await screen.findByText('Message envoyé à 21 personnes ; 2 adresses refusées par le service d’e-mail.')).toBeInTheDocument()
    const envois = appelsVers(BASE_D, 'POST')
    expect(envois).toHaveLength(1)
    expect(envois[0].corps).toEqual({
      operationId: expect.stringMatching(UUID), modele: 'coupure_eau', objet: OBJET_D, texte: TEXTE_D,
      perimetre: { portee: 'etage', batiment: 'b', etage: '3' }, libellePerimetre: 'Bâtiment B · 3e étage',
      perimetreJusquAu: '2026-11-12T10:00:00.123456+00:00', nbDestinatairesAttendu: 23,
      instruction: { reference: REFERENCE_D, recueLe: '2026-11-01' },
    })
    expect(reprises()).toEqual([])
    expect(rappelsD.onFermer).not.toHaveBeenCalled()
  })

  it('aucun modèle choisi : « libre »', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion()
    await fenetrePrete()
    fireEvent.click(await jusquALaConfirmation())
    await screen.findByText(/Message envoyé à 21 personnes/)
    expect(appelsVers(BASE_D, 'POST')[0].corps).toMatchObject({ modele: 'libre' })
  })

  it('gestionnaire : aucun champ d’instruction écrite ; D-R3 sans instruction', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion({ profil: 'gestionnaire' })
    await fenetrePrete()
    expect(screen.queryByLabelText(TD.instruction.reference)).toBeNull()
    expect(screen.queryByRole('group', { name: TD.instruction.legende })).toBeNull()
    fireEvent.click(await jusquALaConfirmation(false))
    await screen.findByText(/Message envoyé à 21 personnes/)
    expect(appelsVers(BASE_D, 'POST')[0].corps).not.toHaveProperty('instruction')
  })

  it('super admin : instruction écrite OBLIGATOIRE (référence sans « @ », date non future), refus sous les champs, sans aperçu ni envoi', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion()
    await fenetrePrete()
    choisir('Bâtiment B')
    await screen.findByText(/Ce message partira à 23 personnes/)
    saisirMessage(false)
    fireEvent.click(screen.getByRole('button', { name: TD.boutons.verifier }))
    expect(screen.getByText(TD.instruction.referenceRequise)).toBeInTheDocument()
    expect(screen.getByText(TD.instruction.dateRequise)).toBeInTheDocument()
    expect(screen.getByLabelText(TD.instruction.reference)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(TD.instruction.reference)).toHaveAccessibleDescription(expect.stringContaining(TD.instruction.referenceRequise))
    saisir(TD.instruction.reference, 'Courriel de gestion@exemple.test')
    saisir(TD.instruction.date, '2999-01-01')
    fireEvent.click(screen.getByRole('button', { name: TD.boutons.verifier }))
    expect(screen.getByText(TD.instruction.referenceRequise)).toBeInTheDocument()
    expect(screen.getByText(TD.instruction.dateRequise)).toBeInTheDocument()
    expect(appelsVers(`${BASE_D}/apercu`)).toHaveLength(1)
    expect(appelsVers(BASE_D, 'POST')).toEqual([])
  })

  it('texte refusé dès l’écran (modèle non complété, crochets) : motif sous le champ (alert), champ invalide ; aucun envoi', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion()
    await fenetrePrete()
    choisir('Bâtiment B')
    choisir('Coupure d’eau')
    saisir(TD.formulaire.objet, OBJET_D)
    saisir(TD.instruction.reference, REFERENCE_D)
    saisir(TD.instruction.date, '2026-11-01')
    fireEvent.click(screen.getByRole('button', { name: TD.boutons.verifier }))
    const motif = screen.getByText(MESSAGES_REFUS_TEXTE_DIFFUSION_QR.a_completer)
    expect(motif.closest('[role="alert"]')).not.toBeNull()
    const texte = screen.getByLabelText(TD.formulaire.texte)
    expect(texte).toHaveAttribute('aria-invalid', 'true')
    expect(texte).toHaveAccessibleDescription(expect.stringContaining(MESSAGES_REFUS_TEXTE_DIFFUSION_QR.a_completer))
    expect(appelsVers(BASE_D, 'POST')).toEqual([])
  })

  it('texte refusé par le serveur (400 texte_refuse, numéro non déclaré) : retour au formulaire, motif sous le texte', async () => {
    simulerEspace(routeurD({ envoi: () => json({ error: 'texte_refuse', champ: 'texte', motif: 'telephone' }, 400) }))
    ouvrirDiffusion()
    await fenetrePrete()
    fireEvent.click(await jusquALaConfirmation())
    expect(await screen.findByText(MESSAGES_REFUS_TEXTE_DIFFUSION_QR.telephone)).toBeInTheDocument()
    expect(screen.getByLabelText(TD.formulaire.texte)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(TD.formulaire.texte)).toHaveValue(TEXTE_D)
  })

  it('409 perimetre_change : nouvel aperçu, nouveau nombre, nouvelle confirmation ; même opération, nouveau nombre attendu', async () => {
    let apercus = 0
    let envois = 0
    simulerEspace(routeurD({
      valeurs: valeursD({ porteeParDefaut: 'copropriete' }),
      apercu: () => {
        apercus += 1
        return apercuD(apercus >= 3 ? 32 : 23, { libellePerimetre: 'Toute la copropriété', instant: `2026-11-12T10:00:0${apercus}+00:00` })
      },
      envoi: () => {
        envois += 1
        return envois === 1 ? json({ error: 'perimetre_change' }, 409) : envoiD({ nbDestinataires: 32, envoyes: 32, refuses: 0 })
      },
    }))
    ouvrirDiffusion()
    await fenetrePrete()
    await screen.findByText(/Ce message partira à 23 personnes/)
    saisirMessage()
    fireEvent.click(await verifier())
    expect(await screen.findByText('Le nombre de destinataires a changé : 32 personnes. Vérifiez puis confirmez.')).toBeInTheDocument()
    const envoyer = screen.getByRole('button', { name: 'Envoyer à 32 personnes' })
    expect(envoyer).toHaveAccessibleDescription(PHRASE)
    fireEvent.click(envoyer)
    expect(await screen.findByText('Message envoyé à 32 personnes.')).toBeInTheDocument()
    const [premier, second] = appelsVers(BASE_D, 'POST').map((a) => a.corps as Record<string, unknown>)
    expect(second.operationId).toBe(premier.operationId)
    expect([premier.nbDestinatairesAttendu, second.nbDestinatairesAttendu]).toEqual([23, 32])
    expect([premier.perimetreJusquAu, second.perimetreJusquAu]).toEqual(['2026-11-12T10:00:02+00:00', '2026-11-12T10:00:03+00:00'])
  })

  it('opposition arrivée depuis l’aperçu : envoi au nombre réel, dit à l’écran', async () => {
    simulerEspace(routeurD({ envoi: () => envoiD({ nbDestinataires: 22, envoyes: 22, refuses: 0 }) }))
    ouvrirDiffusion()
    await fenetrePrete()
    fireEvent.click(await jusquALaConfirmation())
    expect(await screen.findByText('Message envoyé à 22 personnes, 1 ayant demandé entre-temps à ne plus recevoir ces informations.')).toBeInTheDocument()
  })

  it('reprise AUTOMATIQUE tant que reste > 0 : D-R4 enchaînée, progression « 200 / 523 envoyés », puis le bilan', async () => {
    const premiere = differe<Response>()
    simulerEspace(routeurD({
      apercu: () => apercuD(523),
      envoi: () => envoiD({ nbDestinataires: 523, envoyes: 200, refuses: 0, reste: 323 }),
      reprises: [premiere.promesse, { envoyes: 521, refuses: 2, reste: 0, arret: null }],
    }))
    ouvrirDiffusion()
    await fenetrePrete()
    choisir(TD.portee.etage)
    choisir('Bâtiment B')
    choisir('3e étage')
    saisirMessage()
    fireEvent.click(await verifier('Envoyer à 523 personnes'))
    const progression = await screen.findByText('200 / 523 envoyés')
    expect(progression.closest('[aria-live="polite"]')).not.toBeNull()
    expect(screen.getByRole('dialog').querySelector('[aria-busy="true"]')).not.toBeNull()
    await act(async () => { premiere.resoudre(json({ envoyes: 450, refuses: 1, reste: 72, arret: null })) })
    expect(await screen.findByText('Message envoyé à 521 personnes ; 2 adresses refusées par le service d’e-mail.')).toBeInTheDocument()
    expect(reprises().map((a) => [a.url, a.corps])).toEqual([
      [`/api/aj-signalement/diffusions/${DIFF_D}/reprendre`, {}], [`/api/aj-signalement/diffusions/${DIFF_D}/reprendre`, {}],
    ])
  })

  it('envoi arrêté par le service (limite) : aucune reprise immédiate, message, reste en attente', async () => {
    simulerEspace(routeurD({ envoi: () => envoiD({ envoyes: 0, refuses: 0, reste: 23, arret: 'limite_service' }) }))
    ouvrirDiffusion()
    await fenetrePrete()
    fireEvent.click(await jusquALaConfirmation())
    expect(await screen.findByText(remplir(TD.fin.interrompu, { n: 23 }))).toBeInTheDocument()
    expect(screen.getByText(TD.arrets.limite_service)).toBeInTheDocument()
    expect(reprises()).toEqual([])
  })

  it('reprise sans progrès (lot d’une autre requête) : arrêt après un essai, jamais de boucle', async () => {
    simulerEspace(routeurD({
      envoi: () => envoiD({ envoyes: 0, refuses: 0, reste: 23 }),
      reprises: [{ envoyes: 0, refuses: 0, reste: 23, arret: null }, { envoyes: 0, refuses: 0, reste: 23, arret: null }],
    }))
    ouvrirDiffusion()
    await fenetrePrete()
    fireEvent.click(await jusquALaConfirmation())
    expect(await screen.findByText(TD.arrets.sans_progres)).toBeInTheDocument()
    expect(reprises()).toHaveLength(1)
  })

  it('503 configuration_incomplete → « Fonction pas encore activée. » ; réseau coupé → toast et message', async () => {
    let n = 0
    simulerEspace(routeurD({
      envoi: () => {
        n += 1
        if (n === 1) return json({ error: 'configuration_incomplete' }, 503)
        throw new TypeError('Failed to fetch')
      },
    }))
    ouvrirDiffusion()
    await fenetrePrete()
    fireEvent.click(await jusquALaConfirmation())
    expect(await screen.findByText(TT.erreurs.configuration_incomplete)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer à 23 personnes' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(TT.erreurs.reseau))
    expect(screen.getByText(TT.erreurs.reseau)).toBeInTheDocument()
  })
})

describe('lot 8 — fermeture protégée (Échap, clic dehors, bouton Fermer)', () => {
  it('sans saisie : Échap ferme', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion()
    await fenetrePrete()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(rappelsD.onFermer).toHaveBeenCalledTimes(1)
  })

  it('pendant la saisie : Échap, clic dehors et Fermer demandent « Abandonner ce message ? » ; « Continuer la saisie » garde le texte ; « Abandonner » ferme', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion()
    await fenetrePrete()
    saisir(TD.formulaire.objet, 'Coupure')
    await waitFor(() => expect(rappelsD.onGarde).toHaveBeenLastCalledWith('saisie'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByText(TD.fermeture.question)).toBeInTheDocument()
    expect(rappelsD.onFermer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: TD.fermeture.continuer }))
    expect(screen.queryByText(TD.fermeture.question)).toBeNull()
    expect(screen.getByLabelText(TD.formulaire.objet)).toHaveValue('Coupure')
    fireEvent.mouseDown(document.body)
    expect(screen.getByText(TD.fermeture.question)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: TD.fermeture.continuer }))
    fireEvent.click(screen.getByRole('button', { name: TD.fermerFenetre }))
    expect(screen.getByText(TD.fermeture.question)).toBeInTheDocument()
    expect(rappelsD.onFermer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: TD.fermeture.abandonner }))
    expect(rappelsD.onFermer).toHaveBeenCalledTimes(1)
  })

  it('pendant l’envoi : ni Échap ni clic dehors ne ferment, « L’envoi continue » ; à la fin, Échap ferme', async () => {
    const envoi = differe<Response>()
    simulerEspace(routeurD({ envoi: () => envoi.promesse }))
    ouvrirDiffusion()
    await fenetrePrete()
    fireEvent.click(await jusquALaConfirmation())
    await waitFor(() => expect(rappelsD.onGarde).toHaveBeenLastCalledWith('envoi'))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.mouseDown(document.body)
    expect(screen.getByText(TD.fermeture.envoiContinue)).toBeInTheDocument()
    expect(screen.queryByText(TD.fermeture.question)).toBeNull()
    expect(rappelsD.onFermer).not.toHaveBeenCalled()
    await act(async () => { envoi.resoudre(envoiD()) })
    await screen.findByText(/Message envoyé à 21 personnes/)
    await waitFor(() => expect(rappelsD.onGarde).toHaveBeenLastCalledWith('libre'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(rappelsD.onFermer).toHaveBeenCalledTimes(1)
  })
})

describe('lot 8 — message d’annonce (H1 = C), portée « signalement », nom à écrire', () => {
  it('déclarants jamais informés : bouton « Annoncer… (4) » ; texte FIGÉ (non modifiable), aperçu annonce, D-R3 au modèle annonce ; phrase du § 5.6 dans la confirmation', async () => {
    simulerEspace(routeurD({
      valeurs: valeursD({ nbNonAnnonces: 4 }),
      apercu: (c) => apercuD(c.annonce ? 4 : 23, { libellePerimetre: 'Toute la copropriété', nbExclusOpposition: 0 }),
      envoi: () => envoiD({ nbDestinataires: 4, envoyes: 4, refuses: 0 }),
    }))
    ouvrirDiffusion()
    await fenetrePrete()
    expect(screen.getByText(remplir(TD.annonce.encadre, { n: 4 }))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: remplir(TD.annonce.bouton, { n: 4 }) }))
    await fenetrePrete(remplir(TD.titres.annonce, { copropriete: 'Résidence Exemple' }))
    const attendu = annonceDiffusionQr('fr', 'Cabinet Exemple')
    expect(screen.getByText(attendu.objet)).toBeInTheDocument()
    expect(screen.getByText(/Vous avez signalé un problème dans cette copropriété/)).toBeInTheDocument()
    expect(screen.queryByLabelText(TD.formulaire.objet)).toBeNull()
    expect(screen.queryByLabelText(TD.formulaire.texte)).toBeNull()
    expect(screen.queryByRole('group', { name: TD.portee.legende })).toBeNull()
    expect(await screen.findByText('Ce message partira à 4 personnes — Toute la copropriété.')).toBeInTheDocument()
    saisir(TD.instruction.reference, REFERENCE_D)
    saisir(TD.instruction.date, '2026-11-01')
    const envoyer = await verifier('Envoyer à 4 personnes')
    expect(envoyer).toHaveAccessibleDescription(PHRASE)
    fireEvent.click(envoyer)
    await screen.findByText('Message envoyé à 4 personnes.')
    expect(appelsVers(`${BASE_D}/apercu`).every((a) => a.corps?.annonce === true)).toBe(true)
    expect(appelsVers(BASE_D, 'POST')[0].corps).toMatchObject({
      modele: 'annonce', objet: attendu.objet, texte: attendu.texte, perimetre: { portee: 'copropriete' }, libellePerimetre: 'Toute la copropriété',
    })
  })

  it('aucun déclarant à annoncer : pas de bouton d’annonce', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion()
    await fenetrePrete()
    expect(screen.queryByRole('button', { name: /Annoncer la diffusion/ })).toBeNull()
  })

  it('portée « signalement » (depuis le détail) : fixe ; D-R2 et D-R3 avec l’identifiant ; aucun choix de bâtiment ni d’annonce', async () => {
    simulerEspace(routeurD({ valeurs: valeursD({ nbNonAnnonces: 4 }) }))
    ouvrirDiffusion({ signalementId: SIG_D })
    await fenetrePrete(TD.titres.signalement)
    expect(screen.queryByRole('radio', { name: TD.portee.batiment })).toBeNull()
    expect(screen.queryByRole('button', { name: /Annoncer la diffusion/ })).toBeNull()
    expect(screen.getByText(TD.portee.signalement)).toBeInTheDocument()
    expect(await screen.findByText('Ce message partira à 23 personnes — Déclarants du signalement.')).toBeInTheDocument()
    saisirMessage()
    fireEvent.click(await verifier())
    await screen.findByText(/Message envoyé à 21 personnes/)
    expect(appelsVers(`${BASE_D}/apercu`)[0].corps).toEqual({ perimetre: { portee: 'signalement', signalementId: SIG_D } })
    expect(appelsVers(BASE_D, 'POST')[0].corps).toMatchObject({ perimetre: { portee: 'signalement', signalementId: SIG_D }, libellePerimetre: 'Déclarants du signalement' })
  })

  it('nom du bâtiment à écrire (aucune variante affichable) : champ obligatoire, passé à l’aperçu et à l’envoi', async () => {
    const sansNom = { cle: 'x1', libelle: null, libelleASaisir: true, variantes: [], sansEtage: 0, etages: [] }
    simulerEspace(routeurD({
      valeurs: valeursD({ batiments: [sansNom, batimentsD()[1]] }),
      apercu: (c) => apercuD(5, c.libelleBatimentSaisi ? { libellePerimetre: `Bâtiment ${String(c.libelleBatimentSaisi)}` } : { libellePerimetre: null, libelleASaisir: true }),
    }))
    ouvrirDiffusion()
    await fenetrePrete()
    choisir(remplir(TD.portee.sansNom, { n: 1 }))
    expect(await screen.findByText('Ce message partira à 5 personnes.')).toBeInTheDocument()
    saisirMessage()
    fireEvent.click(screen.getByRole('button', { name: TD.boutons.verifier }))
    expect(screen.getByText(TD.portee.nomRequis)).toBeInTheDocument()
    expect(screen.getByLabelText(TD.portee.nomBatiment)).toHaveAttribute('aria-invalid', 'true')
    saisir(TD.portee.nomBatiment, 'C')
    fireEvent.click(await verifier('Envoyer à 5 personnes'))
    await screen.findByText(/Message envoyé/)
    expect(appelsVers(`${BASE_D}/apercu`).at(-1)?.corps).toEqual({ perimetre: { portee: 'batiment', batiment: 'x1' }, libelleBatimentSaisi: 'C' })
    expect(appelsVers(BASE_D, 'POST')[0].corps).toMatchObject({ libelleBatimentSaisi: 'C', libellePerimetre: 'Bâtiment C' })
  })
})

const nombresH = (r: Record<string, number> = {}) => ({ destinataires: 23, exclusOpposition: 0, envoyes: 23, refuses: 0, attente: 0, annules: 0, incertains: 0, ...r })
const ligneH = (id: string, r: Record<string, unknown> = {}) => ({
  id, creeLe: '2026-11-10T09:30:00+00:00', auteur: 'administrateur', modele: 'coupure_eau', objet: 'Coupure d’eau mardi', portee: 'copropriete',
  libellePerimetre: 'Toute la copropriété', nombres: nombresH(), ...r,
})
const historiqueH = (diffusions: unknown[], suivant: string | null = null) => () => ({ diffusions, ceMois: { nb: 2, dernierLe: '2026-11-10T09:30:00+00:00' }, suivant })

describe('lot 8 — historique de la copropriété (§ 7.3)', () => {
  it('liste : date et heure de Paris, objet, périmètre, auteur, états ; « Reprendre l’envoi » seulement si des messages attendent ; aucune adresse', async () => {
    simulerEspace(routeurD({
      historique: historiqueH([
        ligneH(DIFF_D),
        ligneH(DIFF_D2, { objet: 'Fuite au 3e', libellePerimetre: 'Bâtiment B · 3e étage', auteur: 'gestionnaire', nombres: nombresH({ envoyes: 21, refuses: 2 }) }),
        ligneH(DIFF_D3, { objet: 'Intervention ascenseur', nombres: nombresH({ destinataires: 300, envoyes: 0, attente: 300 }) }),
      ]),
    }))
    ouvrirDiffusion({ contenu: 'historique' })
    await screen.findByRole('dialog', { name: remplir(TD.titres.historique, { copropriete: 'Résidence Exemple' }) })
    const lignes = await screen.findAllByRole('listitem')
    expect(lignes).toHaveLength(3)
    expect(within(lignes[0]).getByText('Coupure d’eau mardi')).toBeInTheDocument()
    expect(within(lignes[0]).getByText(new RegExp(dateHeureParis('2026-11-10T09:30:00+00:00')))).toBeInTheDocument()
    expect(within(lignes[0]).getByText(/Toute la copropriété/)).toBeInTheDocument()
    expect(within(lignes[0]).getByText(/Administrateur/)).toBeInTheDocument()
    expect(within(lignes[0]).getByText('Envoyé à 23')).toBeInTheDocument()
    expect(within(lignes[1]).getByText('21 envoyés, 2 refusés')).toBeInTheDocument()
    expect(within(lignes[1]).getByText(/Un gestionnaire/)).toBeInTheDocument()
    expect(within(lignes[2]).getByText('Envoi interrompu : 300 en attente')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: TD.historique.reprendre })).toHaveLength(1)
    expect(within(lignes[2]).getByRole('button', { name: TD.historique.reprendre })).toBeInTheDocument()
    expect(screen.getByText('Ce mois-ci : 2 messages envoyés sur cette copropriété (dernier le 10/11/2026).')).toBeInTheDocument()
    expect(screen.getByRole('dialog').textContent).not.toContain('@')
  })

  it('ouvrir une ligne : texte complet, nombres par état, instruction écrite (D-R6)', async () => {
    simulerEspace(routeurD({
      historique: historiqueH([ligneH(DIFF_D)]),
      details: {
        [DIFF_D]: {
          id: DIFF_D, coproprieteId: COPRO_D, creeLe: '2026-11-10T09:30:00+00:00', auteur: 'administrateur', modele: 'coupure_eau', langue: 'fr',
          objet: 'Coupure d’eau mardi', texte: 'L’eau sera coupée mardi de 9 h à 10 h.\nMerci.', portee: 'copropriete', libellePerimetre: 'Toute la copropriété',
          nbDestinataires: 25, nbExclusOpposition: 2, instruction: { reference: REFERENCE_D, recueLe: '2026-11-01' }, copieCabinetLe: '2026-11-10T09:30:05+00:00',
          nombres: { envoyes: 22, refuses: 1, attente: 0, annules: 2, incertains: 0, opposes: 1, perimes: 1 },
        },
      },
    }))
    ouvrirDiffusion({ contenu: 'historique' })
    fireEvent.click(await screen.findByRole('button', { name: TD.historique.voirDetail }))
    expect(await screen.findByText(/L’eau sera coupée mardi de 9 h à 10 h\./)).toBeInTheDocument()
    expect(appelsVers(`/api/aj-signalement/diffusions/${DIFF_D}`)).toHaveLength(1)
    const detail = screen.getByRole('region', { name: TD.historique.detailTitre })
    expect(within(detail).getByText(TD.historique.detail.envoyes).parentElement).toHaveTextContent('22')
    expect(within(detail).getByText(TD.historique.detail.refuses).parentElement).toHaveTextContent('1')
    expect(within(detail).getByText(TD.historique.detail.annules).parentElement).toHaveTextContent(remplir(TD.historique.detail.annulesDetail, { n: 2, opposes: 1, perimes: 1 }))
    expect(within(detail).getByText(TD.historique.detail.instruction).parentElement).toHaveTextContent(REFERENCE_D)
    expect(screen.getByRole('button', { name: TD.historique.masquerDetail })).toHaveAttribute('aria-expanded', 'true')
  })

  it('« Voir plus » : curseur du serveur passé tel quel', async () => {
    simulerEspace(routeurD({ historique: (url) => (url.includes('avant=') ? historiqueH([ligneH(DIFF_D2)])() : historiqueH([ligneH(DIFF_D)], '2026-11-10T09:30:00+00:00')()) }))
    ouvrirDiffusion({ contenu: 'historique' })
    fireEvent.click(await screen.findByRole('button', { name: TD.historique.voirPlus }))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))
    expect(appelsEspace.map((a) => a.url)).toContain(`${BASE_D}?avant=${encodeURIComponent('2026-11-10T09:30:00+00:00')}`)
  })

  it('reprise d’un envoi interrompu de plus d’une heure : question avec l’heure d’écriture, puis D-R4 confirmé, enchaîné ; liste relue', async () => {
    simulerEspace(routeurD({
      historique: historiqueH([ligneH(DIFF_D3, { nombres: nombresH({ destinataires: 300, envoyes: 0, attente: 300 }) })]),
      reprises: [
        json({ error: 'a_confirmer', creeLe: '2026-11-10T09:30:00+00:00' }, 409),
        { envoyes: 200, refuses: 0, reste: 100, arret: null }, { envoyes: 300, refuses: 0, reste: 0, arret: null },
      ],
    }))
    ouvrirDiffusion({ contenu: 'historique' })
    fireEvent.click(await screen.findByRole('button', { name: TD.historique.reprendre }))
    expect(await screen.findByText(remplir(TD.historique.aConfirmer, { date: dateHeureParis('2026-11-10T09:30:00+00:00') }))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: TD.historique.confirmerReprise }))
    expect(await screen.findByText('Message envoyé à 300 personnes.')).toBeInTheDocument()
    expect(reprises().map((a) => a.corps)).toEqual([{}, { confirmeContenuAJour: true }, { confirmeContenuAJour: true }])
    await waitFor(() => expect(appelsEspace.filter((a) => a.url.startsWith(BASE_D) && a.methode === 'GET')).toHaveLength(2))
  })

  it('message non parti en 24 h (410 perime) : dit, jamais renvoyé', async () => {
    simulerEspace(routeurD({
      historique: historiqueH([ligneH(DIFF_D3, { nombres: nombresH({ destinataires: 300, envoyes: 0, attente: 300 }) })]),
      reprises: [json({ error: 'perime' }, 410)],
    }))
    ouvrirDiffusion({ contenu: 'historique' })
    fireEvent.click(await screen.findByRole('button', { name: TD.historique.reprendre }))
    expect(await screen.findByText(TT.erreurs.perime)).toBeInTheDocument()
    expect(reprises()).toHaveLength(1)
  })

  it('gestionnaire : auteur « Vous », « Un collègue », « Le cabinet » (jamais un nom)', async () => {
    simulerEspace(routeurD({ historique: historiqueH([ligneH(DIFF_D, { auteur: 'vous' }), ligneH(DIFF_D2, { auteur: 'collegue' }), ligneH(DIFF_D3, { auteur: 'cabinet' })]) }))
    ouvrirDiffusion({ contenu: 'historique', profil: 'gestionnaire' })
    const lignes = await screen.findAllByRole('listitem')
    expect(within(lignes[0]).getByText(new RegExp(TD.historique.auteurs.vous))).toBeInTheDocument()
    expect(within(lignes[1]).getByText(new RegExp(TD.historique.auteurs.collegue))).toBeInTheDocument()
    expect(within(lignes[2]).getByText(new RegExp(TD.historique.auteurs.cabinet))).toBeInTheDocument()
  })

  it('aucun message : dit', async () => {
    simulerEspace(routeurD())
    ouvrirDiffusion({ contenu: 'historique' })
    expect(await screen.findByText(TD.historique.aucun)).toBeInTheDocument()
  })
})

// ── Point d'entrée : carte de la copropriété et détail d'un signalement (TableauSignalementsQr) ──

const RESUME_CAB_D = { id: CAB_D, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }
const coproD = (r: Partial<CoproprieteQr> = {}): CoproprieteQr => ({
  id: COPRO_D, nom: 'Résidence Exemple', adresse: '1 rue Exemple', jeton: '0'.repeat(32), emailsDestinataires: [], actif: true,
  creeLe: '2026-11-01T10:00:00.000Z', nbSignalements: 1, nbEnAttente: 1, derniereAdresseProposee: null, ...gestionCoproprieteQrVide(),
  cabinet: RESUME_CAB_D, ...r,
})
const signalementD: SignalementQr = {
  id: SIG_D, coproprieteId: COPRO_D, coproprieteNom: 'Résidence Exemple', prenom: 'Marie', nom: 'Exemple', telephone: '06 00 00 00 00',
  email: 'marie@exemple.test', batiment: 'B', etage: '3', numLot: '12', estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Plomberie',
  description: 'Fuite sous l’évier', priorite: 'normale', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: '2026-11-04T14:05:10.000Z',
  emailErreur: null, confirmationEnvoyeeLe: null, confirmationErreur: null, qualiteDeclarant: null, adresseProposee: '', signalementLieId: null,
  creeLe: '2026-11-04T14:05:00.000Z', misAJourLe: '2026-11-04T14:05:00.000Z',
}

function routeurEspaceD(coproprietes: CoproprieteQr[], s: ScenarioD = {}) {
  const d = routeurD(s)
  return (a: AppelEspace) => (a.url === '/api/aj-signalement/tableau' ? json({ tableau: { coproprietes, signalements: [signalementD] } }) : d(a))
}
type VueD = React.ComponentProps<typeof TableauSignalementsQr>['vue']
async function rendreTableauD(vue: VueD, coproprietes: CoproprieteQr[], s: ScenarioD = {}, gestionnaire = false) {
  simulerEspace(routeurEspaceD(coproprietes, s))
  const props = gestionnaire ? { gestionnaire: { domaines: ['exemple.test'] } } : {}
  const r = render(<TableauSignalementsQr jeton={null} vue={vue} {...props} />)
  await screen.findByRole('button', { name: TT.mettreAJour })
  return { afficher: (autre: VueD) => r.rerender(<TableauSignalementsQr jeton={null} vue={autre} {...props} />) }
}

describe('lot 8 — point d’entrée (§ 7.1) : carte, détail, droit « diffuser » (H11)', () => {
  it('super admin : « Diffuser un message » et « Messages envoyés » sur la carte ; les fenêtres s’ouvrent (D-R1, puis D-R5)', async () => {
    await rendreTableauD('coproprietes', [coproD()])
    fireEvent.click(screen.getByRole('button', { name: TD.carte.diffuser }))
    await fenetrePrete()
    expect(appelsEspace.some((a) => a.url === `${BASE_D}/valeurs`)).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: TD.carte.historique }))
    expect(await screen.findByRole('dialog', { name: remplir(TD.titres.historique, { copropriete: 'Résidence Exemple' }) })).toBeInTheDocument()
  })

  it('gestionnaire : action seulement sur une copropriété attribuée NOMMÉMENT, jamais « à tous » (même attribuée aussi) ; sinon le message lecture seule existant', async () => {
    await rendreTableauD('coproprietes', [
      coproD({ modifiable: true }),
      coproD({ id: COPRO_D2, nom: 'Résidence Commune', modifiable: true, attribueeATous: true }),
      coproD({ id: COPRO_D3, nom: 'Résidence Collègue', modifiable: false }),
    ], {}, true)
    const carte = (nom: string) => screen.getByRole('heading', { name: nom }).closest('section') as HTMLElement
    expect(within(carte('Résidence Exemple')).getByRole('button', { name: TD.carte.diffuser })).toBeInTheDocument()
    expect(within(carte('Résidence Exemple')).getByRole('button', { name: TD.carte.historique })).toBeInTheDocument()
    expect(within(carte('Résidence Commune')).queryByRole('button', { name: TD.carte.diffuser })).toBeNull()
    expect(within(carte('Résidence Commune')).queryByRole('button', { name: TD.carte.historique })).toBeNull()
    expect(within(carte('Résidence Collègue')).queryByRole('button', { name: TD.carte.diffuser })).toBeNull()
    expect(within(carte('Résidence Collègue')).getByText(TEC.copropriete.lectureSeule)).toBeInTheDocument()
  })

  it('détail d’un signalement : « Informer les déclarants de ce signalement » ouvre la portée « signalement »', async () => {
    await rendreTableauD('signalements', [coproD()])
    fireEvent.click(screen.getByRole('button', { name: TT.voirDetail }))
    fireEvent.click(await screen.findByRole('button', { name: TD.detail.informer }))
    await fenetrePrete(TD.titres.signalement)
    await waitFor(() => expect(appelsVers(`${BASE_D}/apercu`)[0]?.corps).toEqual({ perimetre: { portee: 'signalement', signalementId: SIG_D } }))
  })

  it('détail : « Ne plus envoyer d’informations à ce déclarant (à sa demande) » → date de la demande écrite, D-R7, confirmé', async () => {
    await rendreTableauD('signalements', [coproD()])
    fireEvent.click(screen.getByRole('button', { name: TT.voirDetail }))
    fireEvent.click(await screen.findByRole('button', { name: TD.opposition.bouton }))
    expect(screen.getByText(TD.opposition.aide)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: TD.opposition.confirmer }))
    expect(screen.getByText(TD.opposition.dateRequise)).toBeInTheDocument()
    saisir(TD.opposition.date, '2026-11-10')
    fireEvent.click(screen.getByRole('button', { name: TD.opposition.confirmer }))
    expect(await screen.findByText(TD.opposition.fait)).toBeInTheDocument()
    expect(appelsVers(`/api/aj-signalement/coproprietes/${COPRO_D}/signalements/${SIG_D}/opposition`, 'POST').map((a) => a.corps)).toEqual([{ demandeRecueLe: '2026-11-10' }])
  })

  it('gestionnaire sans le droit (copropriété « à tous ») : ni « Informer », ni opposition dans le détail', async () => {
    await rendreTableauD('signalements', [coproD({ modifiable: true, attribueeATous: true })], {}, true)
    fireEvent.click(screen.getByRole('button', { name: TT.voirDetail }))
    await screen.findByRole('dialog')
    expect(screen.queryByRole('button', { name: TD.detail.informer })).toBeNull()
    expect(screen.queryByRole('button', { name: TD.opposition.bouton })).toBeNull()
  })

  it('changement de vue PENDANT LA SAISIE : la fenêtre reste, « Abandonner ce message ? » ; abandon → fermée ; SANS saisie : fermée', async () => {
    const { afficher } = await rendreTableauD('coproprietes', [coproD()])
    fireEvent.click(screen.getByRole('button', { name: TD.carte.diffuser }))
    await fenetrePrete()
    saisir(TD.formulaire.objet, 'Coupure')
    await waitFor(() => expect(screen.getByLabelText(TD.formulaire.objet)).toHaveValue('Coupure'))
    afficher('tableau-de-bord')
    expect(await screen.findByText(TD.fermeture.question)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: titreMessage() })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: TD.fermeture.abandonner }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    afficher('coproprietes')
    fireEvent.click(screen.getByRole('button', { name: TD.carte.diffuser }))
    await fenetrePrete()
    afficher('signalements')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('changement de vue PENDANT L’ENVOI : la fenêtre reste ouverte (« L’envoi continue »), même vers une vue hors du tableau', async () => {
    const envoi = differe<Response>()
    const { afficher } = await rendreTableauD('coproprietes', [coproD()], { envoi: () => envoi.promesse })
    fireEvent.click(screen.getByRole('button', { name: TD.carte.diffuser }))
    await fenetrePrete()
    fireEvent.click(await jusquALaConfirmation())
    await screen.findByText(TD.envoi.enCours)
    afficher('cabinets')
    expect(await screen.findByText(TD.fermeture.envoiContinue)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: titreMessage() })).toBeVisible()
    await act(async () => { envoi.resoudre(envoiD()) })
    expect(await screen.findByText(/Message envoyé à 21 personnes/)).toBeInTheDocument()
  })
})

// ── Activation de la diffusion d'un cabinet (fiche du cabinet, D-R8, § 7.4) ──

const cabinetD = (r: Partial<CabinetQr> = {}): CabinetQr => ({
  id: CAB_D, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', domaines: ['exemple.test'], identifiantFige: true,
  nbCoproprietes: 1, nbGestionnaires: 1, ...r,
})
const reglagesD = (r: Record<string, unknown> = {}) => ({
  contactEmail: null, politiqueUrl: null, politiqueDeclareeLe: null, contratReference: null, contratSigneLe: null, telephones: [],
  activeeLe: null, active: false, langueOuverte: true, manque: ['contact', 'politique', 'declaration_politique', 'contrat_reference', 'contrat_date'], ...r,
})
const reglagesComplets = (r: Record<string, unknown> = {}) => reglagesD({
  contactEmail: 'contact@cabinet-exemple.test', politiqueUrl: 'https://cabinet-exemple.test/confidentialite', politiqueDeclareeLe: '2026-11-01T09:00:00+00:00',
  contratReference: 'Contrat exemple v1', contratSigneLe: '2026-11-01', telephones: ['0612345678'], manque: [], ...r,
})
const URL_CAB_D = `/api/aj-signalement/cabinets/${CAB_D}`

async function ouvrirReglages(lecture: Record<string, unknown> | null, patch?: (corps: Record<string, unknown>) => Response) {
  simulerEspace((a) => {
    if (a.url !== URL_CAB_D) return json({ error: 'introuvable' }, 404)
    if (a.methode === 'PATCH') {
      return patch ? patch(a.corps ?? {}) : json({ cabinet: cabinetD(), diffusion: reglagesComplets({ active: true, activeeLe: '2026-11-12T10:00:00+00:00' }) })
    }
    return json({ cabinet: cabinetD(), diffusion: lecture })
  })
  render(<CabinetsQr cabinets={[cabinetD()]} erreur={null} coproprietes={[]} onModifie={vi.fn()} onReessayer={vi.fn()} onJournal={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: TD.reglages.bouton }))
  return screen.findByRole('dialog', { name: remplir(TD.reglages.titre, { cabinet: 'Cabinet Exemple' }) })
}

describe('lot 8 — activation de la diffusion d’un cabinet (§ 7.4, D-R8)', () => {
  it('réglages vides : « Activer » refusé à l’écran avec la liste de ce qui manque, sans appel', async () => {
    await ouvrirReglages(reglagesD())
    fireEvent.click(await screen.findByRole('button', { name: TD.reglages.activer }))
    const liste = [
      TD.reglages.manques.contact, TD.reglages.manques.politique, TD.reglages.manques.declaration_politique,
      TD.reglages.manques.contrat_reference, TD.reglages.manques.contrat_date,
    ].join(', ')
    expect(screen.getByText(remplir(TD.reglages.manque, { liste }))).toBeInTheDocument()
    expect(appelsVers(URL_CAB_D, 'PATCH')).toEqual([])
  })

  it('tout renseigné : PATCH des réglages seuls (téléphones séparés), activation ; état relu', async () => {
    await ouvrirReglages(reglagesD())
    await screen.findByLabelText(TD.reglages.contact)
    saisir(TD.reglages.contact, 'contact@cabinet-exemple.test')
    saisir(TD.reglages.politique, 'https://cabinet-exemple.test/confidentialite')
    fireEvent.click(screen.getByRole('checkbox', { name: TD.reglages.declaration }))
    saisir(TD.reglages.contratReference, 'Contrat exemple v1')
    saisir(TD.reglages.contratDate, '2026-11-01')
    saisir(TD.reglages.telephones, '06 12 34 56 78, 04 91 00 00 00')
    fireEvent.click(screen.getByRole('button', { name: TD.reglages.activer }))
    expect(await screen.findByText(TD.reglages.activee)).toBeInTheDocument()
    expect(appelsVers(URL_CAB_D, 'PATCH').map((a) => a.corps)).toEqual([{
      diffusionContactEmail: 'contact@cabinet-exemple.test', diffusionPolitiqueUrl: 'https://cabinet-exemple.test/confidentialite',
      politiqueDecritDiffusion: true, contratReference: 'Contrat exemple v1', contratSigneLe: '2026-11-01',
      telephonesAutorises: ['06 12 34 56 78', '04 91 00 00 00'], diffusionActivee: true,
    }])
    expect(screen.getByText(remplir(TD.reglages.activeeLe, { date: '12 novembre 2026' }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: TD.reglages.suspendre })).toBeInTheDocument()
  })

  it('refus du serveur (409 cabinet_incomplet { manque }) : la liste du serveur', async () => {
    await ouvrirReglages(reglagesComplets(), () => json({ error: 'cabinet_incomplet', manque: ['contrat_date'] }, 409))
    fireEvent.click(await screen.findByRole('button', { name: TD.reglages.activer }))
    expect(await screen.findByText(remplir(TD.reglages.manque, { liste: TD.reglages.manques.contrat_date }))).toBeInTheDocument()
    expect(appelsVers(URL_CAB_D, 'PATCH').map((a) => a.corps)).toEqual([{ diffusionActivee: true }])
  })

  it('langue non ouverte (portugais, H9) : activation impossible, dit', async () => {
    await ouvrirReglages(reglagesComplets({ langueOuverte: false }))
    expect(await screen.findByText(TD.reglages.langueNonOuverte)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: TD.reglages.activer })).toBeDisabled()
  })

  it('déclaration de la politique faite : rappelée ; changer l’adresse oblige à la refaire', async () => {
    await ouvrirReglages(reglagesComplets())
    const caseDeclaration = await screen.findByRole('checkbox', { name: TD.reglages.declaration })
    expect(caseDeclaration).toBeChecked()
    expect(caseDeclaration).toBeDisabled()
    expect(screen.getByText(remplir(TD.reglages.declareeLe, { date: '1 novembre 2026' }))).toBeInTheDocument()
    saisir(TD.reglages.politique, 'https://cabinet-exemple.test/confidentialite-v2')
    expect(screen.getByRole('checkbox', { name: TD.reglages.declaration })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: TD.reglages.declaration })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: TD.reglages.activer }))
    expect(screen.getByText(remplir(TD.reglages.manque, { liste: TD.reglages.manques.declaration_politique }))).toBeInTheDocument()
  })

  it('diffusion active : « Suspendre la diffusion » → PATCH { diffusionActivee: false }', async () => {
    await ouvrirReglages(reglagesComplets({ active: true, activeeLe: '2026-11-02T09:00:00+00:00' }), () => json({ cabinet: cabinetD(), diffusion: reglagesComplets() }))
    expect(await screen.findByText(TD.reglages.suspendreAide)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: TD.reglages.suspendre }))
    expect(await screen.findByText(TD.reglages.suspendue)).toBeInTheDocument()
    expect(appelsVers(URL_CAB_D, 'PATCH').map((a) => a.corps)).toEqual([{ diffusionActivee: false }])
  })

  it('migration absente (réglages null) : « Fonction pas encore activée. »', async () => {
    await ouvrirReglages(null)
    expect(await screen.findByText(TD.reglages.indisponible)).toBeInTheDocument()
    expect(screen.queryByLabelText(TD.reglages.contact)).toBeNull()
  })
})

// ── Fin de mission prévue sur la fiche de la copropriété (H7) ──

describe('lot 8 — fin de mission prévue sur la fiche de la copropriété (H7, super admin)', () => {
  const URL_COPRO_D = `/api/aj-signalement/coproprietes/${COPRO_D}`
  function ouvrirFiche(valeurs: Record<string, unknown> | Response, copropriete = coproD()) {
    const onEnregistre = vi.fn()
    simulerEspace((a) => {
      if (a.url === `${BASE_D}/valeurs`) return valeurs instanceof Response ? valeurs : json(valeurs)
      if (a.url === URL_COPRO_D && a.methode === 'PATCH') return json({ copropriete })
      return json({ error: 'introuvable' }, 404)
    })
    render(<ModaleCoproprieteQr copropriete={copropriete} jeton={null} cabinets={[cabinetD()]} gestionnaires={[]} onFermer={vi.fn()} onEnregistre={onEnregistre} />)
    return onEnregistre
  }
  const enregistrer = async (onEnregistre: ReturnType<typeof vi.fn>) => {
    fireEvent.click(screen.getByRole('button', { name: TT.formulaire.enregistrer }))
    await waitFor(() => expect(onEnregistre).toHaveBeenCalled())
    return appelsVers(URL_COPRO_D, 'PATCH')[0].corps as Record<string, unknown>
  }

  it('date relue (D-R1) et affichée ; changée → envoyée (diffusionFinGestionLe)', async () => {
    const onEnregistre = ouvrirFiche(valeursD({ finMissionLe: '2026-12-31' }))
    const champ = await screen.findByLabelText(TD.finMission.champ)
    expect(champ).toHaveValue('2026-12-31')
    expect(champ).toHaveAccessibleDescription(TD.finMission.aide)
    saisir(TD.finMission.champ, '2027-01-15')
    expect(await enregistrer(onEnregistre)).toMatchObject({ diffusionFinGestionLe: '2027-01-15' })
  })

  it('effacée → null', async () => {
    const onEnregistre = ouvrirFiche(valeursD({ finMissionLe: '2026-12-31' }))
    await screen.findByLabelText(TD.finMission.champ)
    saisir(TD.finMission.champ, '')
    expect((await enregistrer(onEnregistre)).diffusionFinGestionLe).toBeNull()
  })

  it('inchangée : absente du corps', async () => {
    const onEnregistre = ouvrirFiche(valeursD({ finMissionLe: '2026-12-31' }))
    await screen.findByLabelText(TD.finMission.champ)
    expect(await enregistrer(onEnregistre)).not.toHaveProperty('diffusionFinGestionLe')
  })

  it('fonction pas encore activée (D-R1 503) : aucun champ, corps d’avant', async () => {
    const onEnregistre = ouvrirFiche(json({ error: 'base_absente' }, 503))
    await waitFor(() => expect(appelsVers(`${BASE_D}/valeurs`)).toHaveLength(1))
    expect(screen.queryByLabelText(TD.finMission.champ)).toBeNull()
    expect(await enregistrer(onEnregistre)).not.toHaveProperty('diffusionFinGestionLe')
  })

  it('copropriété sans cabinet : aucune lecture, aucun champ', async () => {
    ouvrirFiche(valeursD(), coproD({ cabinet: null }))
    expect(screen.queryByLabelText(TD.finMission.champ)).toBeNull()
    expect(appelsVers(`${BASE_D}/valeurs`)).toEqual([])
  })
})

// ── Relecture 3 de la PR 3 : corrections des écrans (tests écrits d'abord, rouges sur 3c6e6580) ──

const BOUTON_ANNONCE_D = remplir(TD.annonce.bouton, { n: 4 })
/** Copropriété entière présélectionnée, 4 déclarants jamais annoncés, 523 destinataires (4 pour l'annonce). */
const routeurAnnonceD = (s: ScenarioD = {}) => routeurD({
  valeurs: valeursD({ porteeParDefaut: 'copropriete', nbNonAnnonces: 4 }),
  apercu: (c) => apercuD(c.annonce ? 4 : 523, { libellePerimetre: 'Toute la copropriété', nbExclusOpposition: 0 }),
  ...s,
})

describe('relecture 3 — rien ne quitte l’envoi, aucune saisie jetée sans question (§ 7.1, § 7.2 point 10)', () => {
  it('confirmation puis envoi : « Annoncer… » n’est plus proposé ; la reprise automatique va au bout, Échap ne ferme pas', async () => {
    const reprise = differe<Response>()
    simulerEspace(routeurAnnonceD({
      envoi: () => envoiD({ nbDestinataires: 523, envoyes: 200, refuses: 0, reste: 323 }),
      reprises: [reprise.promesse, { envoyes: 523, refuses: 0, reste: 0, arret: null }],
    }))
    ouvrirDiffusion()
    await fenetrePrete()
    expect(screen.getByRole('button', { name: BOUTON_ANNONCE_D })).toBeInTheDocument()
    saisirMessage()
    const envoyer = await verifier('Envoyer à 523 personnes')
    expect(screen.queryByRole('button', { name: BOUTON_ANNONCE_D })).toBeNull()
    fireEvent.click(envoyer)
    await screen.findByText('200 / 523 envoyés')
    await waitFor(() => expect(rappelsD.onGarde).toHaveBeenLastCalledWith('envoi'))
    expect(screen.queryByRole('button', { name: BOUTON_ANNONCE_D })).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByText(TD.fermeture.envoiContinue)).toBeInTheDocument()
    await act(async () => { reprise.resoudre(json({ envoyes: 423, refuses: 0, reste: 100, arret: null })) })
    expect(await screen.findByText('Message envoyé à 523 personnes.')).toBeInTheDocument()
    expect(reprises()).toHaveLength(2)
    expect(rappelsD.onFermer).not.toHaveBeenCalled()
  })

  it('saisie en cours, « Annoncer… » : « Abandonner ce message ? » ; « Continuer la saisie » garde le texte ; « Abandonner » ouvre l’annonce', async () => {
    simulerEspace(routeurAnnonceD())
    ouvrirDiffusion()
    await fenetrePrete()
    saisir(TD.formulaire.objet, OBJET_D)
    saisir(TD.formulaire.texte, TEXTE_D)
    await waitFor(() => expect(rappelsD.onGarde).toHaveBeenLastCalledWith('saisie'))
    fireEvent.click(screen.getByRole('button', { name: BOUTON_ANNONCE_D }))
    expect(screen.getByText(TD.fermeture.question)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: titreMessage() })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: TD.fermeture.continuer }))
    expect(screen.queryByText(TD.fermeture.question)).toBeNull()
    expect(screen.getByLabelText(TD.formulaire.objet)).toHaveValue(OBJET_D)
    expect(screen.getByLabelText(TD.formulaire.texte)).toHaveValue(TEXTE_D)
    fireEvent.click(screen.getByRole('button', { name: BOUTON_ANNONCE_D }))
    fireEvent.click(screen.getByRole('button', { name: TD.fermeture.abandonner }))
    await fenetrePrete(remplir(TD.titres.annonce, { copropriete: 'Résidence Exemple' }))
    expect(screen.queryByText(TD.fermeture.question)).toBeNull()
    expect(rappelsD.onFermer).not.toHaveBeenCalled()
  })

  it('sans saisie : « Annoncer… » ouvre l’annonce sans question', async () => {
    simulerEspace(routeurAnnonceD())
    ouvrirDiffusion()
    await fenetrePrete()
    fireEvent.click(screen.getByRole('button', { name: BOUTON_ANNONCE_D }))
    await fenetrePrete(remplir(TD.titres.annonce, { copropriete: 'Résidence Exemple' }))
    expect(screen.queryByText(TD.fermeture.question)).toBeNull()
  })
})

describe('relecture 3 — migration de la diffusion absente (503 base_absente) : « Fonction pas encore activée. » (§ 9)', () => {
  const FONCTION_INACTIVE = TT.erreurs.configuration_incomplete
  const sansMigration = (texte: string | null | undefined) => expect(texte ?? '').not.toMatch(/migration|\.sql/)

  it.each(['super_admin', 'gestionnaire'] as const)('« Diffuser un message » (D-R1), profil %s', async (profil) => {
    simulerEspace(routeurD({ valeurs: json({ error: 'base_absente' }, 503) }))
    ouvrirDiffusion({ profil })
    expect(await screen.findByText(FONCTION_INACTIVE)).toBeInTheDocument()
    sansMigration(screen.getByRole('dialog').textContent)
  })

  it('« Messages envoyés » (D-R5), super admin', async () => {
    simulerEspace(routeurD({ historique: () => json({ error: 'base_absente' }, 503) }))
    ouvrirDiffusion({ contenu: 'historique' })
    expect(await screen.findByText(FONCTION_INACTIVE)).toBeInTheDocument()
    sansMigration(screen.getByRole('dialog').textContent)
  })

  it('« Ne plus envoyer d’informations à ce déclarant » (D-R7), super admin', async () => {
    await rendreTableauD('signalements', [coproD()], { opposition: () => json({ error: 'base_absente' }, 503) })
    fireEvent.click(screen.getByRole('button', { name: TT.voirDetail }))
    fireEvent.click(await screen.findByRole('button', { name: TD.opposition.bouton }))
    saisir(TD.opposition.date, '2026-11-10')
    fireEvent.click(screen.getByRole('button', { name: TD.opposition.confirmer }))
    expect(await screen.findByText(FONCTION_INACTIVE)).toBeInTheDocument()
    sansMigration(screen.getByRole('dialog').textContent)
  })

  it('réglages du cabinet (D-R8) : enregistrement refusé en 503 base_absente', async () => {
    await ouvrirReglages(reglagesComplets(), () => json({ error: 'base_absente' }, 503))
    fireEvent.click(await screen.findByRole('button', { name: TD.reglages.activer }))
    expect(await screen.findByText(FONCTION_INACTIVE)).toBeInTheDocument()
    sansMigration(screen.getByRole('dialog').textContent)
  })

  it('réglages du cabinet : lecture refusée en 503 base_absente', async () => {
    simulerEspace((a) => (a.url === URL_CAB_D ? json({ error: 'base_absente' }, 503) : json({ error: 'introuvable' }, 404)))
    render(<CabinetsQr cabinets={[cabinetD()]} erreur={null} coproprietes={[]} onModifie={vi.fn()} onReessayer={vi.fn()} onJournal={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: TD.reglages.bouton }))
    expect(await screen.findByText(FONCTION_INACTIVE)).toBeInTheDocument()
    sansMigration(screen.getByRole('dialog').textContent)
  })
})
