// e2e/simulateur-v2.spec.ts
//
// Playwright E2E pour le simulateur V2 — utilise Groq RÉEL (pas de mock).
// Nécessite : npm run dev en local OU déploiement test, + cookie override admin
// pour forcer V2.
//
// Skip si SIMULATEUR_E2E_SKIP=true (cas CI sans GROQ_API_KEY) ou si le
// serveur n'est pas joignable.
//
// URL : utilise la baseURL de playwright.config.ts + /simulateur
// ou SIMULATEUR_E2E_URL pour un override complet.

import { test, expect } from '@playwright/test'

const SIMULATEUR_PATH = '/simulateur'
const SIMULATEUR_URL =
  process.env.SIMULATEUR_E2E_URL ||
  `${process.env.BASE_URL || 'http://127.0.0.1:3000'}${SIMULATEUR_PATH}`

const SHOULD_SKIP = process.env.SIMULATEUR_E2E_SKIP === 'true'

test.describe('Simulateur V2 — parcours réels (Groq live)', () => {
  test.skip(SHOULD_SKIP, 'SIMULATEUR_E2E_SKIP=true (CI sans GROQ)')

  test.beforeEach(async ({ page }) => {
    // Force V2 via cookie override admin
    const u = new URL(SIMULATEUR_URL)
    await page.context().addCookies([
      {
        name: 'vitfix_sim_v2',
        value: 'on',
        domain: u.hostname,
        path: '/',
      },
    ])
  })

  test('peinture salon 25 m² Marseille — in-catalog', async ({ page }) => {
    await page.goto(SIMULATEUR_URL)

    // Le composant SimulateurChat a un input sans placeholder fixe —
    // on cible l'input visible dans la zone de saisie
    const input = page.locator('input').filter({ hasText: '' }).first()
    await input.fill(
      'Refaire la peinture du salon 25 m² à Marseille en gamme standard'
    )
    await page.locator('button[type="submit"]').click()

    // Attendre la fin du streaming : le CTA "Publier dans la Bourse" apparaît
    await expect(
      page.locator('text=/Publier dans la Bourse|Bourse aux Marchés/').first()
    ).toBeVisible({ timeout: 30_000 })

    const body = await page.content()

    // Au moins un montant en euros affiché (pas de placeholder brut)
    expect(body).toMatch(/\d[\d\s]*\s*€/)

    // Aucun placeholder token non substitué visible dans le DOM
    expect(body).not.toMatch(/\{TOTAL_MIN\}|\{LINE_|\{UNIT_/)
  })

  test('panneaux solaires — out-of-catalog', async ({ page }) => {
    await page.goto(SIMULATEUR_URL)

    const input = page.locator('input').filter({ hasText: '' }).first()
    await input.fill('installer des panneaux solaires sur le toit')
    await page.locator('button[type="submit"]').click()

    await expect(
      page.locator('text=/Publier dans la Bourse|Bourse aux Marchés/').first()
    ).toBeVisible({ timeout: 30_000 })

    const body = await page.content()

    // En mode out-of-catalog, la réponse doit guider vers un artisan ou
    // mentionner le tarif horaire / catalogue non disponible
    expect(body).toMatch(/tarif|horaire|catalog|publier|artisan/i)

    // Aucun placeholder non substitué
    expect(body).not.toMatch(/\{TOTAL_MIN\}|\{LINE_|\{UNIT_/)
  })

  test('V1 témoin (cookie override off)', async ({ page }) => {
    // Remplace le cookie V2=on par V2=off pour tester la branche V1
    await page.context().clearCookies()
    const u = new URL(SIMULATEUR_URL)
    await page.context().addCookies([
      {
        name: 'vitfix_sim_v2',
        value: 'off',
        domain: u.hostname,
        path: '/',
      },
    ])

    await page.goto(SIMULATEUR_URL)

    const input = page.locator('input').filter({ hasText: '' }).first()
    await input.fill('peinture salon 25 m² Marseille')
    await page.locator('button[type="submit"]').click()

    await expect(
      page.locator('text=/Publier dans la Bourse|Bourse aux Marchés/').first()
    ).toBeVisible({ timeout: 30_000 })

    const body = await page.content()

    // V1 ne devrait pas émettre le bloc ESTIMATION_DATA propre au V2
    expect(body).not.toContain('[ESTIMATION_DATA]')
  })
})
