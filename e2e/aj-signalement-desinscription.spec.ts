// e2e/aj-signalement-desinscription.spec.ts — AJ Signalement, PR 3 (lot 10, cahier § 10.1) : page publique de
// désinscription des messages de diffusion, /<identifiant>/desinscription/#<jeton> (cahier § 7.5, § 7.6, § 8.1).
//
// Build de production (CI : npm run start), SANS AUCUNE BASE de test : la CI de ce dépôt public passe à Playwright les
// clés de la base réelle et publie le rapport en artefact (piège 13 de la PR 2). Donc :
//   - toutes les réponses /api/aj-signalement/** sont simulées par page.route (données fictives @exemple.test) ; toute
//     requête /api/** non prévue est interrompue et notée, toute requête hors du serveur testé aussi (aucune requête
//     tierce : ni mesure d'audience, ni police, ni script externe) ;
//   - ni trace, ni capture, ni vidéo ; aucun compte, aucune session, aucune écriture : l'opposition, la reprise et le
//     repli par l'adresse sont des réponses simulées. Seule lecture réelle : celle du cabinet du chemin par le rendu du
//     serveur (langue, contact de la page « lien non valable ») ; l'identifiant fictif « cabinet-exemple » n'existe pas,
//     la page retombe sur ses textes sans contact (tests/securite/e2e-aj-signalement-garde-fous.test.ts vérifie que ce
//     rendu ne fait qu'un select).
// Ce que la page doit prouver : fragment effacé AVANT tout appel, aucun Referer, ouverture sans effet (lecture seule),
// libellés exacts du cahier (FR et PT), les deux phrases du droit § 5.4 avant chaque bouton d'opposition, aucune date,
// mode réduit du lien un clic, repli d'un lien expiré, servie SANS la coquille de VitFix (ni en-tête ni pied, ni bandeau
// de consentement, ni mesure d'audience, ni données structurées), même pour un visiteur qui a accepté les cookies
// ailleurs sur le site (même origine, même stockage). Un témoin (page d'invitation, coquille gardée) montre que ces
// sélecteurs voient bien la coquille quand elle est là.
// Hors de portée : le build de la CI n'a pas de DSN Sentry ; en production, le Sentry du navigateur (instrumentation-
// client.ts, commun à tout le site) peut joindre son service depuis cette page, jetons effacés avant l'envoi
// (lib/aj-signalement/sentry-desinscription.ts, tests/securite/sentry-navigateur-desinscription.test.tsx).

import { test, expect, type Page, type Route } from '@playwright/test'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })

const IDENTIFIANT = 'cabinet-exemple'
/** Jetons signés fictifs (32 hexadécimaux, un point, 64 hexadécimaux) : ils ne valent rien hors de ces réponses simulées. */
const JETON = `${'a'.repeat(32)}.${'b'.repeat(64)}`
const JETON_UN_CLIC = `${'c'.repeat(32)}.${'d'.repeat(64)}`
const LECTURE = '/api/aj-signalement/desinscription/lecture'
const OPPOSITION = '/api/aj-signalement/desinscription'
const REPRISE = '/api/aj-signalement/desinscription/reprendre'
const REPLI = '/api/aj-signalement/desinscription/adresse'
const CONTACT = 'cabinet@exemple.test'
const ADRESSE_SAISIE = 'marie.exemple@exemple.test'
const POLITIQUE = 'https://cabinet-exemple.test/confidentialite'

// Libellés exacts (cahier § 7.5 ; lib/aj-signalement/textes-desinscription.ts).
const FR = {
  titre: 'Informations sur votre immeuble',
  presentation: 'Résidence Exemple — informations envoyées par Cabinet Exemple à ma***@exemple.test',
  presentationSansEmail: 'Résidence Exemple — informations envoyées par Cabinet Exemple',
  quitter: 'Vous ne recevrez plus les informations sur les incidents de cet immeuble : coupures d’eau, fuites, interventions.',
  garder: 'Vous continuerez à recevoir la confirmation de vos propres signalements.',
  opposer: 'Ne plus recevoir les informations sur cet immeuble',
  opposeFait: 'C’est enregistré : vous ne recevrez plus les informations sur cet immeuble.',
  reprendre: 'Recevoir à nouveau ces informations',
  dejaOppose: 'Vous ne recevez plus les informations sur cet immeuble.',
  reprisFait: 'C’est enregistré : vous recevrez de nouveau les informations sur cet immeuble.',
  expireIntro: 'Ce lien a plus d’un an. Pour ne plus recevoir les informations sur Résidence Exemple, indiquez l’adresse e-mail à laquelle vous les receviez.',
  champEmail: 'Adresse e-mail',
  // Motif ancré (libellé exact) : l'exemple d'adresse du libellé n'est pas une donnée du test (garde-fous : seules les
  // adresses de données sont en @exemple.test).
  emailInvalide: /^Indiquez une adresse e-mail complète \(exemple : nom@domaine\.fr\)\.$/,
  expireFait: 'C’est noté. Si cette adresse est celle à laquelle ce message a été envoyé, elle ne recevra plus les informations sur cet immeuble.',
  ancien: `Ce lien est trop ancien. Pour ne plus recevoir les informations sur cet immeuble, utilisez le bouton d’un message plus récent, ou écrivez à Cabinet Exemple : ${CONTACT}.`,
  inconnu: `Ce lien n’est pas valable. Utilisez le bouton d’un message plus récent, ou écrivez au cabinet : ${CONTACT}.`,
  inconnuSansContact: 'Ce lien n’est pas valable. Utilisez le bouton d’un message plus récent, ou écrivez au cabinet.',
  politique: 'Politique de confidentialité de Cabinet Exemple',
  indisponible: 'Le service est momentanément indisponible. Réessayez dans quelques instants.',
  reessayer: 'Réessayer',
}
const PT = {
  titre: 'Informações sobre o seu prédio',
  quitter: 'Deixará de receber as informações sobre os incidentes deste prédio: cortes de água, fugas, intervenções.',
  garder: 'Continuará a receber a confirmação das suas próprias ocorrências.',
  opposer: 'Deixar de receber as informações sobre este prédio',
}

type ReponsesSimulees = Record<string, { status: number; corps: unknown }>
type Appel = { chemin: string; corps: unknown; referer: string | null }

/**
 * Simule TOUTES les réponses /api/aj-signalement/** (POST prévus seulement). Toute autre requête /api/**, ou vers une
 * autre origine que le serveur testé, est interrompue et notée. Les réponses restent modifiables pendant le test.
 */
async function simulerApi(page: Page, origine: string, reponses: ReponsesSimulees) {
  const imprevues: string[] = []
  const tierces: string[] = []
  const recues: Appel[] = []
  const toutes: string[] = []
  page.on('request', (requete) => { toutes.push(requete.url()) })
  // Filet, enregistré EN PREMIER : Playwright essaie les routes de la dernière enregistrée à la première, celle de
  // l'API AJ Signalement (ci-dessous) passe donc avant lui.
  await page.route('**/*', async (route: Route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origine) {
      tierces.push(url.href)
      await route.abort()
      return
    }
    if (url.pathname.startsWith('/api/')) {
      imprevues.push(`${route.request().method()} ${url.pathname}`)
      await route.abort()
      return
    }
    await route.continue()
  })
  await page.route('**/api/aj-signalement/**', async (route: Route) => {
    const requete = route.request()
    const chemin = new URL(requete.url()).pathname.replace(/\/+$/, '')
    const prevue = requete.method() === 'POST' ? reponses[chemin] : undefined
    if (!prevue) {
      imprevues.push(`${requete.method()} ${chemin}`)
      await route.abort()
      return
    }
    recues.push({ chemin, corps: requete.postDataJSON(), referer: await requete.headerValue('referer') })
    await route.fulfill({ status: prevue.status, contentType: 'application/json', body: JSON.stringify(prevue.corps) })
  })
  return { imprevues, tierces, recues, toutes }
}

/**
 * Choix « tout accepter » posé avant la page, sur l'origine du site : le visiteur a accepté la mesure d'audience
 * ailleurs sur le site. La page de désinscription ne doit RIEN en faire (aucun script ne doit lire le fragment).
 */
async function accepterCookies(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('vitfix_cookie_consent', JSON.stringify({
      performance: true, personalization: true, advertising: true, date: new Date().toISOString(),
    }))
  })
}

/** Note, à chaque appel de fetch, le fragment de l'adresse à cet instant (il doit déjà être effacé). */
async function noterFragmentAuxAppels(page: Page) {
  await page.addInitScript(() => {
    const fenetre = window as unknown as { hashAuxAppels: string[] }
    fenetre.hashAuxAppels = []
    const origineFetch = window.fetch.bind(window)
    window.fetch = (...args: Parameters<typeof fetch>) => {
      fenetre.hashAuxAppels.push(window.location.hash)
      return origineFetch(...args)
    }
  })
}

const hashAuxAppels = (page: Page) => page.evaluate(() => (window as unknown as { hashAuxAppels: string[] }).hashAuxAppels)

/** Texte de la carte de la page, dans l'ordre du document (phrases avant les boutons). */
const texteCarte = (page: Page) => page.locator('main').innerText()

const corpsJeton = (jeton: string) => ({ jeton, identifiant: IDENTIFIANT })

const lectureValide = (surcharge: Record<string, unknown> = {}) => ({
  status: 200,
  corps: {
    etat: 'valide', type: 'page', langue: 'fr', cabinet: 'Cabinet Exemple', copropriete: 'Résidence Exemple',
    emailMasque: 'ma***@exemple.test', oppose: false, levable: false, politiqueUrl: POLITIQUE, ...surcharge,
  },
})

/** Aucune date, aucune année : un message transféré ne doit pas révéler quand la personne s'est opposée (§ 7.5). */
const AUCUNE_DATE = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:19|20)\d{2}\b/

test.describe('AJ Signalement — désinscription des messages de diffusion (/<identifiant>/desinscription/)', () => {
  test.beforeEach(async ({ page }) => {
    await accepterCookies(page)
    await noterFragmentAuxAppels(page)
  })

  test('servie sans session ni coquille : fragment effacé avant tout appel, aucun Referer, aucune requête tierce', async ({ page, baseURL }) => {
    const origine = new URL(baseURL ?? 'http://127.0.0.1:3000').origin
    const api = await simulerApi(page, origine, { [LECTURE]: lectureValide() })
    const reponse = await page.goto(`/${IDENTIFIANT}/desinscription/#${JETON}`)
    // Publique, sans session : ni redirection vers la connexion du cabinet, ni 404 (aucun cookie dans ce contexte).
    expect(reponse?.status()).toBe(200)
    expect(reponse?.url()).toBe(`${origine}/${IDENTIFIANT}/desinscription/`)
    expect(reponse?.headers()['x-robots-tag'] ?? '').toContain('noindex')
    expect(reponse?.headers()['cache-control'] ?? '').toContain('no-store')

    await expect(page.getByText(FR.presentation, { exact: true })).toBeVisible()
    await page.waitForLoadState('networkidle')

    // Fragment : effacé de l'adresse, et déjà absent à CHAQUE appel de fetch (aucun appel avant l'effacement).
    expect(page.url()).toBe(`${origine}/${IDENTIFIANT}/desinscription/`)
    expect(page.url()).not.toContain(JETON)
    const fragments = await hashAuxAppels(page)
    expect(fragments.length).toBeGreaterThan(0)
    expect(fragments.every((f) => f === '')).toBe(true)
    // Ouverture sans effet : la lecture seule ; jeton et identifiant du chemin dans le CORPS, sans Referer.
    expect(api.recues.length).toBeGreaterThan(0)
    for (const r of api.recues) expect(r).toEqual({ chemin: LECTURE, corps: corpsJeton(JETON), referer: null })
    expect(api.toutes.some((u) => u.includes(JETON))).toBe(false)
    await expect(page.locator('meta[name="referrer"][content="no-referrer"]')).toHaveCount(1)
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1)
    await expect(page.getByRole('link', { name: FR.politique })).toHaveAttribute('href', POLITIQUE)
    await expect(page.getByRole('link', { name: FR.politique })).toHaveAttribute('rel', /noreferrer/)

    // Sans la coquille de VitFix : ni en-tête ni pied ni navigation, ni bandeau de consentement, ni mesure d'audience
    // (alors même que le visiteur a « tout accepté »), ni données structurées, aucune mention de VitFix.
    await expect(page.locator('header')).toHaveCount(0)
    await expect(page.locator('footer')).toHaveCount(0)
    await expect(page.locator('nav')).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText(/cookie/i)).toHaveCount(0)
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0)
    await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0)
    await expect(page.locator('script[src*="cloudflareinsights"]')).toHaveCount(0)
    expect(await page.evaluate(() => 'gtag' in window || 'dataLayer' in window)).toBe(false)
    expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/vitfix/i)
    expect(await page.title()).toBe(FR.titre)
    expect(await page.evaluate(async () => (navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0))).toBe(0)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(FR.titre)
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

    expect(api.tierces).toEqual([])
    expect(api.imprevues).toEqual([])
  })

  test('libellés exacts ; les deux phrases avant le bouton ; opposition, puis « Recevoir à nouveau » (même lien, 24 h)', async ({ page, baseURL }) => {
    const origine = new URL(baseURL ?? 'http://127.0.0.1:3000').origin
    const api = await simulerApi(page, origine, {
      [LECTURE]: lectureValide(),
      [OPPOSITION]: { status: 200, corps: { oppose: true, levable: true } },
      [REPRISE]: { status: 200, corps: { oppose: false } },
    })
    await page.goto(`/${IDENTIFIANT}/desinscription/#${JETON}`)
    const opposer = page.getByRole('button', { name: FR.opposer, exact: true })
    await expect(opposer).toBeVisible()
    await expect(page.getByText(FR.presentation, { exact: true })).toBeVisible()
    await expect(page.getByText(FR.quitter, { exact: true })).toBeVisible()
    await expect(page.getByText(FR.garder, { exact: true })).toBeVisible()
    const avant = await texteCarte(page)
    expect(avant.indexOf(FR.quitter)).toBeGreaterThan(avant.indexOf(FR.presentation))
    expect(avant.indexOf(FR.garder)).toBeGreaterThan(avant.indexOf(FR.quitter))
    expect(avant.indexOf(FR.opposer)).toBeGreaterThan(avant.indexOf(FR.garder))
    expect(avant).not.toMatch(AUCUNE_DATE)
    // Ni « êtes-vous sûr ? », ni question, ni case à cocher, ni champ (J19, J20).
    expect(avant).not.toContain('?')
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await expect(page.getByRole('textbox')).toHaveCount(0)
    await expect(page.getByRole('button')).toHaveCount(1)
    // Ouverture sans effet : aucune écriture avant le clic.
    expect(api.recues.every((r) => r.chemin === LECTURE)).toBe(true)

    await opposer.click()
    await expect(page.getByText(FR.opposeFait, { exact: true })).toBeVisible()
    await expect(page.getByText(FR.garder, { exact: true })).toBeVisible()
    // Focus déplacé sur le message de résultat (§ 7.6).
    await expect(page.locator(':focus')).toContainText(FR.opposeFait)
    await expect(opposer).toHaveCount(0)
    const reprendre = page.getByRole('button', { name: FR.reprendre, exact: true })
    await expect(reprendre).toBeVisible()
    expect(await texteCarte(page)).not.toMatch(AUCUNE_DATE)
    expect(api.recues.filter((r) => r.chemin !== LECTURE)).toEqual([{ chemin: OPPOSITION, corps: corpsJeton(JETON), referer: null }])

    await reprendre.click()
    await expect(page.getByText(FR.reprisFait, { exact: true })).toBeVisible()
    await expect(page.locator(':focus')).toContainText(FR.reprisFait)
    await expect(page.getByText(FR.quitter, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: FR.opposer, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: FR.reprendre, exact: true })).toHaveCount(0)
    expect(api.recues.filter((r) => r.chemin !== LECTURE)).toEqual([
      { chemin: OPPOSITION, corps: corpsJeton(JETON), referer: null },
      { chemin: REPRISE, corps: corpsJeton(JETON), referer: null },
    ])
    expect(api.tierces).toEqual([])
    expect(api.imprevues).toEqual([])
  })

  test('déjà désinscrit : aucune date ; « Recevoir à nouveau » seulement si le serveur le permet (levable)', async ({ page, baseURL }) => {
    const origine = new URL(baseURL ?? 'http://127.0.0.1:3000').origin
    const reponses: ReponsesSimulees = { [LECTURE]: lectureValide({ oppose: true, levable: false }) }
    const api = await simulerApi(page, origine, reponses)
    await page.goto(`/${IDENTIFIANT}/desinscription/#${JETON}`)
    await expect(page.getByText(FR.dejaOppose, { exact: true })).toBeVisible()
    await expect(page.getByRole('button')).toHaveCount(0)
    expect(await texteCarte(page)).not.toMatch(AUCUNE_DATE)

    reponses[LECTURE] = lectureValide({ oppose: true, levable: true })
    // Page vierge d'abord : la même adresse avec un fragment serait une navigation dans le document (aucun rechargement).
    await page.goto('about:blank')
    await page.goto(`/${IDENTIFIANT}/desinscription/#${JETON}`)
    await expect(page.getByText(FR.dejaOppose, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: FR.reprendre, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: FR.opposer, exact: true })).toHaveCount(0)
    expect(api.recues.every((r) => r.chemin === LECTURE)).toBe(true)
    expect(api.tierces).toEqual([])
    expect(api.imprevues).toEqual([])
  })

  test('lien un clic ouvert dans un navigateur (D-P5b) : ni adresse masquée, ni « Recevoir à nouveau »', async ({ page, baseURL }) => {
    const origine = new URL(baseURL ?? 'http://127.0.0.1:3000').origin
    const api = await simulerApi(page, origine, {
      [LECTURE]: lectureValide({ type: 'un_clic', emailMasque: null }),
      // Même si le serveur répondait « levable », le jeton un clic ne sert qu'à s'opposer (§ 8.1).
      [OPPOSITION]: { status: 200, corps: { oppose: true, levable: true } },
    })
    await page.goto(`/${IDENTIFIANT}/desinscription/#${JETON_UN_CLIC}`)
    await expect(page.getByText(FR.presentationSansEmail, { exact: true })).toBeVisible()
    expect(await texteCarte(page)).not.toContain('***')
    expect(await texteCarte(page)).not.toContain('@')
    await expect(page.getByText(FR.quitter, { exact: true })).toBeVisible()
    await expect(page.getByText(FR.garder, { exact: true })).toBeVisible()
    expect(page.url()).not.toContain(JETON_UN_CLIC)

    await page.getByRole('button', { name: FR.opposer, exact: true }).click()
    await expect(page.getByText(FR.opposeFait, { exact: true })).toBeVisible()
    await expect(page.getByRole('button')).toHaveCount(0)
    expect(api.recues.filter((r) => r.chemin !== LECTURE)).toEqual([{ chemin: OPPOSITION, corps: corpsJeton(JETON_UN_CLIC), referer: null }])
    expect(api.tierces).toEqual([])
    expect(api.imprevues).toEqual([])
  })

  test('lien expiré : les deux phrases, champ étiqueté, adresse dans le CORPS du repli seulement, réponse toujours la même', async ({ page, baseURL }) => {
    const origine = new URL(baseURL ?? 'http://127.0.0.1:3000').origin
    const api = await simulerApi(page, origine, {
      [LECTURE]: { status: 200, corps: { etat: 'expire', type: 'page', langue: 'fr', cabinet: 'Cabinet Exemple', copropriete: 'Résidence Exemple', politiqueUrl: POLITIQUE } },
      [REPLI]: { status: 200, corps: { ok: true } },
    })
    await page.goto(`/${IDENTIFIANT}/desinscription/#${JETON}`)
    await expect(page.getByText(FR.expireIntro, { exact: true })).toBeVisible()
    const carte = await texteCarte(page)
    expect(carte.indexOf(FR.quitter)).toBeGreaterThan(carte.indexOf(FR.expireIntro))
    expect(carte.indexOf(FR.garder)).toBeGreaterThan(carte.indexOf(FR.quitter))
    expect(carte.indexOf(FR.opposer)).toBeGreaterThan(carte.indexOf(FR.garder))
    const champ = page.getByLabel(FR.champEmail, { exact: true })
    await expect(champ).toBeVisible()

    // Adresse incomplète : refusée dans la page, rien n'est envoyé ; erreur reliée au champ.
    await champ.fill('adresse-incomplete')
    await page.getByRole('button', { name: FR.opposer, exact: true }).click()
    await expect(page.getByText(FR.emailInvalide)).toBeVisible()
    await expect(champ).toHaveAttribute('aria-invalid', 'true')
    await expect(champ).toHaveAccessibleDescription(FR.emailInvalide)
    expect(api.recues.filter((r) => r.chemin !== LECTURE)).toEqual([])

    await champ.fill(ADRESSE_SAISIE)
    await page.getByRole('button', { name: FR.opposer, exact: true }).click()
    await expect(page.getByText(FR.expireFait, { exact: true })).toBeVisible()
    await expect(page.locator(':focus')).toContainText(FR.expireFait)
    expect(api.recues.filter((r) => r.chemin !== LECTURE)).toEqual([
      { chemin: REPLI, corps: { jeton: JETON, identifiant: IDENTIFIANT, email: ADRESSE_SAISIE }, referer: null },
    ])
    // Jamais l'adresse dans une URL (ni celle de la page, ni celle d'une requête).
    expect(page.url()).not.toContain('@')
    expect(api.toutes.some((u) => u.includes('@') || u.includes(encodeURIComponent('@')))).toBe(false)
    expect(api.tierces).toEqual([])
    expect(api.imprevues).toEqual([])
  })

  test('ancien lien et lien non valable : contact du cabinet, aucun bouton ni formulaire', async ({ page, baseURL }) => {
    const origine = new URL(baseURL ?? 'http://127.0.0.1:3000').origin
    const reponses: ReponsesSimulees = {
      [LECTURE]: { status: 200, corps: { etat: 'ancien', langue: 'fr', cabinet: 'Cabinet Exemple', contactCabinet: CONTACT, politiqueUrl: POLITIQUE } },
    }
    const api = await simulerApi(page, origine, reponses)
    await page.goto(`/${IDENTIFIANT}/desinscription/#${JETON}`)
    await expect(page.getByText(FR.ancien, { exact: true })).toBeVisible()
    await expect(page.getByRole('button')).toHaveCount(0)
    await expect(page.getByRole('textbox')).toHaveCount(0)
    await expect(page.getByRole('link', { name: FR.politique })).toHaveAttribute('href', POLITIQUE)

    reponses[LECTURE] = { status: 200, corps: { etat: 'inconnu', langue: 'fr', contactCabinet: CONTACT } }
    await page.goto('about:blank')
    await page.goto(`/${IDENTIFIANT}/desinscription/#${JETON}`)
    await expect(page.getByText(FR.inconnu, { exact: true })).toBeVisible()
    await expect(page.getByRole('button')).toHaveCount(0)
    await expect(page.getByRole('textbox')).toHaveCount(0)
    await expect(page.getByRole('link')).toHaveCount(0)
    expect(api.recues.every((r) => r.chemin === LECTURE)).toBe(true)
    expect(api.tierces).toEqual([])
    expect(api.imprevues).toEqual([])
  })

  test('sans jeton dans l’adresse : « Ce lien n’est pas valable. » sans aucun appel', async ({ page, baseURL }) => {
    const origine = new URL(baseURL ?? 'http://127.0.0.1:3000').origin
    const api = await simulerApi(page, origine, {})
    const reponse = await page.goto(`/${IDENTIFIANT}/desinscription/`)
    expect(reponse?.status()).toBe(200)
    // Cabinet fictif absent de la base (rendu du serveur) : texte sans contact.
    await expect(page.getByText(FR.inconnuSansContact, { exact: true })).toBeVisible()
    await expect(page.getByRole('button')).toHaveCount(0)
    await page.waitForLoadState('networkidle')
    expect(api.recues).toEqual([])
    expect(await hashAuxAppels(page)).toEqual([])
    expect(api.tierces).toEqual([])
    expect(api.imprevues).toEqual([])
  })

  test('service indisponible : message sans détail, « Réessayer » relit le lien (toujours sans effet)', async ({ page, baseURL }) => {
    const origine = new URL(baseURL ?? 'http://127.0.0.1:3000').origin
    const reponses: ReponsesSimulees = { [LECTURE]: { status: 503, corps: { error: 'base_absente' } } }
    const api = await simulerApi(page, origine, reponses)
    await page.goto(`/${IDENTIFIANT}/desinscription/#${JETON}`)
    // Alerte de la carte (l'annonceur de route de Next porte aussi role="alert").
    await expect(page.locator('main').getByRole('alert')).toHaveText(FR.indisponible)
    expect(await texteCarte(page)).not.toContain('base_absente')
    reponses[LECTURE] = lectureValide()
    await page.getByRole('button', { name: FR.reessayer, exact: true }).click()
    await expect(page.getByText(FR.presentation, { exact: true })).toBeVisible()
    expect(api.recues.map((r) => r.chemin)).toEqual([LECTURE, LECTURE])
    expect(api.recues.every((r) => JSON.stringify(r.corps) === JSON.stringify(corpsJeton(JETON)))).toBe(true)
    expect(api.tierces).toEqual([])
    expect(api.imprevues).toEqual([])
  })

  test('langue de la diffusion (PT) : document en « pt », titre et phrases du droit en portugais', async ({ page, baseURL }) => {
    const origine = new URL(baseURL ?? 'http://127.0.0.1:3000').origin
    const api = await simulerApi(page, origine, {
      [LECTURE]: lectureValide({ langue: 'pt', cabinet: 'Gabinete Exemplo', copropriete: 'Condomínio Exemplo', politiqueUrl: null }),
    })
    await page.goto(`/${IDENTIFIANT}/desinscription/#${JETON}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(PT.titre)
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt')
    await expect(page.locator('main')).toHaveAttribute('lang', 'pt')
    await expect(page).toHaveTitle(PT.titre)
    await expect(page.getByText(PT.quitter, { exact: true })).toBeVisible()
    await expect(page.getByText(PT.garder, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: PT.opposer, exact: true })).toBeVisible()
    // Sans politique déclarée : aucun lien.
    await expect(page.getByRole('link')).toHaveCount(0)
    expect(api.tierces).toEqual([])
    expect(api.imprevues).toEqual([])
  })
})

test.describe('témoin : une page AVEC la coquille de VitFix (ouverture de l’accès d’un gestionnaire)', () => {
  test('les mêmes sélecteurs y voient en-tête, pied, bandeau de consentement et, après acceptation, la mesure d’audience', async ({ page, baseURL }) => {
    const origine = new URL(baseURL ?? 'http://127.0.0.1:3000').origin
    const api = await simulerApi(page, origine, {})
    // Sans fragment : la page d'invitation n'appelle aucune route AJ Signalement.
    await page.goto(`/${IDENTIFIANT}/invitation/`)
    await expect(page.getByText('Ce lien n’est pas valable.')).toBeVisible()
    await expect(page.locator('header').first()).toBeVisible()
    await expect(page.locator('footer').first()).toBeAttached()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.evaluate(() => {
      window.localStorage.setItem('vitfix_cookie_consent', JSON.stringify({
        performance: true, personalization: true, advertising: true, date: new Date().toISOString(),
      }))
    })
    await page.reload()
    await expect(page.getByText('Ce lien n’est pas valable.')).toBeVisible()
    // Mesure d'audience demandée (et interrompue par le filet) : le détecteur de requêtes tierces la voit.
    await expect.poll(() => api.tierces.some((u) => u.includes('googletagmanager'))).toBe(true)
    expect(api.recues).toEqual([])
  })
})
