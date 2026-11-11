// e2e/aj-signalement-gestionnaire.spec.ts — AJ Signalement, PR 2 (accès des gestionnaires) : pages PUBLIQUES seulement.
//
// Build de production (CI : npm run start), SANS AUCUNE BASE : la CI de ce dépôt public passe à Playwright les clés de la
// base réelle et publie le rapport en artefact (piège 13 de la PR 2). Donc :
//   - toutes les réponses /api/aj-signalement/** sont simulées par page.route (données fictives @exemple.test) ; toute
//     requête /api/aj-signalement/** non prévue est interrompue et fait échouer le test ;
//   - ni trace, ni capture, ni vidéo ; aucun compte, aucune connexion, aucune écriture en base.
// Pages parcourues : l'ouverture de l'accès d'un gestionnaire (/<identifiant>/invitation/#<jeton> : page cliente, aucune
// lecture serveur) et la connexion professionnelle de l'espace (/fr/aj-signalement/connexion/, statique). La connexion
// d'un cabinet (/<identifiant>/connexion/, qui lit le cabinet côté serveur) et l'espace connecté sont couverts par les
// tests de composants et la recette manuelle (tests/securite/e2e-aj-signalement-garde-fous.test.ts garde ces règles).

import { test, expect, type Page, type Route } from '@playwright/test'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })

const IDENTIFIANT = 'cabinet-exemple'
/** Jeton signé fictif (48 hexadécimaux, un point, 64 hexadécimaux) : il ne vaut rien hors de ces réponses simulées. */
const JETON = `${'a'.repeat(48)}.${'b'.repeat(64)}`
const ADRESSE = 'marie.exemple@exemple.test'
const MOT_DE_PASSE = 'MotDePasse2026'
const LECTURE = '/api/aj-signalement/invitation/lecture'
const ACCEPTATION = '/api/aj-signalement/invitation'
const REFUS = '/api/aj-signalement/invitation/refus'

type ReponsesSimulees = Record<string, { status: number; corps: unknown }>

/** Simule TOUTES les réponses /api/aj-signalement/** (POST prévus seulement) ; toute autre requête est interrompue et notée. */
async function simulerApi(page: Page, reponses: ReponsesSimulees) {
  const imprevues: string[] = []
  const recues: Array<{ chemin: string; corps: unknown }> = []
  await page.route('**/api/aj-signalement/**', async (route: Route) => {
    const requete = route.request()
    const chemin = new URL(requete.url()).pathname.replace(/\/+$/, '')
    const prevue = requete.method() === 'POST' ? reponses[chemin] : undefined
    if (!prevue) {
      imprevues.push(`${requete.method()} ${chemin}`)
      await route.abort()
      return
    }
    recues.push({ chemin, corps: requete.postDataJSON() })
    await route.fulfill({ status: prevue.status, contentType: 'application/json', body: JSON.stringify(prevue.corps) })
  })
  return { imprevues, recues }
}

/** Choix « cookies refusés » posé avant la page : le bandeau ne couvre aucun bouton (choix le plus protecteur). */
async function refuserCookies(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('vitfix_cookie_consent', JSON.stringify({
      performance: false, personalization: false, advertising: false, date: new Date().toISOString(),
    }))
  })
}

const LECTURE_OK = { status: 200, corps: { nomCourt: 'Marie E.', cabinet: 'Cabinet Exemple', email: ADRESSE } }

test.describe('AJ Signalement — ouverture de l’accès d’un gestionnaire (/<identifiant>/invitation/)', () => {
  test.beforeEach(async ({ page }) => { await refuserCookies(page) })

  test('le jeton est effacé de l’adresse, lu sans effet, puis le mot de passe ouvre l’accès', async ({ page }) => {
    const api = await simulerApi(page, { [LECTURE]: LECTURE_OK, [ACCEPTATION]: { status: 200, corps: { acces: 'ouvert' } } })
    const reponse = await page.goto(`/${IDENTIFIANT}/invitation/#${JETON}`)
    expect(reponse?.status()).toBe(200)
    expect(reponse?.headers()['x-robots-tag'] ?? '').toContain('noindex')

    await expect(page.getByText(`Marie E., gestionnaire chez Cabinet Exemple — adresse ${ADRESSE}`)).toBeVisible()
    expect(page.url()).not.toContain('#')
    expect(page.url()).not.toContain(JETON)
    // Lecture sans effet : seul appel avant toute saisie (jeton et identifiant du chemin dans le CORPS, jamais l'adresse).
    expect(api.recues.length).toBeGreaterThan(0)
    for (const r of api.recues) expect(r).toEqual({ chemin: LECTURE, corps: { token: JETON, cabinet: IDENTIFIANT } })
    await expect(page.locator('meta[name="referrer"][content="no-referrer"]')).toHaveCount(1)

    await page.getByLabel('Mot de passe', { exact: true }).fill(MOT_DE_PASSE)
    await page.getByLabel('Confirmez le mot de passe').fill(MOT_DE_PASSE)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Ouvrir mon accès' }).click()

    await expect(page.getByText('Accès ouvert. Connectez-vous.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', `/${IDENTIFIANT}/connexion/`)
    expect(api.recues.filter((r) => r.chemin === ACCEPTATION)).toEqual([
      { chemin: ACCEPTATION, corps: { token: JETON, cabinet: IDENTIFIANT, password: MOT_DE_PASSE, politiqueLue: true } },
    ])
    expect(api.imprevues).toEqual([])
  })

  test('mot de passe hors règle ou case non cochée : refusé dans la page, rien n’est envoyé', async ({ page }) => {
    const api = await simulerApi(page, { [LECTURE]: LECTURE_OK })
    await page.goto(`/${IDENTIFIANT}/invitation/#${JETON}`)
    await expect(page.getByRole('button', { name: 'Ouvrir mon accès' })).toBeVisible()
    await page.getByLabel('Mot de passe', { exact: true }).fill('court')
    await page.getByRole('button', { name: 'Ouvrir mon accès' }).click()
    await expect(page.getByText('Le mot de passe doit compter 8 caractères au moins, dont une majuscule, une minuscule et un chiffre.')).toBeVisible()
    await expect(page.getByText('Cochez la case pour continuer.')).toBeVisible()
    expect(api.recues.filter((r) => r.chemin !== LECTURE)).toEqual([])
    expect(api.imprevues).toEqual([])
  })

  test('« Ce n’est pas moi » : confirmation, puis contestation (aucun compte créé)', async ({ page }) => {
    const api = await simulerApi(page, { [LECTURE]: LECTURE_OK, [REFUS]: { status: 200, corps: { contestee: true } } })
    await page.goto(`/${IDENTIFIANT}/invitation/#${JETON}`)
    await page.getByRole('button', { name: 'Ce n’est pas moi' }).click()
    await expect(page.getByText('Aucun compte ne sera créé et le cabinet sera prévenu.')).toBeVisible()
    await page.getByRole('button', { name: 'Confirmer : ce n’est pas moi' }).click()
    await expect(page.getByText('C’est noté : aucun compte n’a été créé, le cabinet est prévenu.')).toBeVisible()
    expect(api.recues.filter((r) => r.chemin !== LECTURE)).toEqual([{ chemin: REFUS, corps: { token: JETON, cabinet: IDENTIFIANT } }])
    expect(api.imprevues).toEqual([])
  })

  test('lien refusé par le serveur (404) : « Ce lien n’est pas valable. », aucun formulaire', async ({ page }) => {
    const api = await simulerApi(page, { [LECTURE]: { status: 404, corps: { error: 'introuvable' } } })
    await page.goto(`/${IDENTIFIANT}/invitation/#${JETON}`)
    await expect(page.getByText('Ce lien n’est pas valable.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ouvrir mon accès' })).toHaveCount(0)
    expect(api.imprevues).toEqual([])
  })

  test('sans jeton dans l’adresse : « Ce lien n’est pas valable. » sans aucun appel', async ({ page }) => {
    const api = await simulerApi(page, {})
    await page.goto(`/${IDENTIFIANT}/invitation/`)
    await expect(page.getByText('Ce lien n’est pas valable.')).toBeVisible()
    expect(api.recues).toEqual([])
    expect(api.imprevues).toEqual([])
  })
})

test.describe('AJ Signalement — connexion professionnelle de l’espace (/fr/aj-signalement/connexion/)', () => {
  test('e-mail et mot de passe, « Mot de passe oublié ? », sans choix Particulier / Artisan / Pro ni Google ; aucun appel', async ({ page }) => {
    await refuserCookies(page)
    const api = await simulerApi(page, {})
    const reponse = await page.goto('/fr/aj-signalement/connexion/')
    expect(reponse?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Connexion professionnelle' })).toBeVisible()
    await expect(page.getByLabel('Adresse e-mail professionnelle')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mot de passe oublié ?' })).toBeVisible()
    await expect(page.getByText(/Particulier/)).toHaveCount(0)
    await expect(page.getByText(/Google/)).toHaveCount(0)

    await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click()
    await expect(page.getByRole('button', { name: 'Envoyer le lien' })).toBeVisible()
    expect(api.recues).toEqual([])
    expect(api.imprevues).toEqual([])
  })
})
