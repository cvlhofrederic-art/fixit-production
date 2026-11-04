import { test, expect, type Page } from '@playwright/test'

// Lot 5 de l'analyse Sentry du 28/10/2026 (issues T, G, S, F) : visiteurs dont le navigateur bloque cookies et
// données de site (réglage Chrome, navigation privée stricte sur iOS). On reproduit le blocage avant tout script :
// la lecture de localStorage / sessionStorage lève une SecurityError, et navigator.locks.request est refusé.
// Critère d'acceptation : aucune erreur de page, le bandeau cookies se ferme au clic, la page reste utilisable.

async function bloquerStockage(page: Page) {
  await page.addInitScript(() => {
    const refus = (nom: string) =>
      new DOMException(`Failed to read the '${nom}' property from 'Window': Access is denied for this document.`, 'SecurityError')
    for (const nom of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, nom, {
        configurable: true,
        get() {
          throw refus(nom)
        },
      })
    }
    if (navigator.locks) {
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: {
          request: () => Promise.reject(new DOMException('The request was denied.', 'SecurityError')),
          query: () => Promise.resolve({ held: [], pending: [] }),
        },
      })
    }
  })
}

test.describe('Stockage du navigateur bloqué', () => {
  test('page SEO publique : aucune erreur, le bandeau cookies se ferme au clic, la page reste utilisable', async ({ page }) => {
    const erreursPage: string[] = []
    const erreursConsole: string[] = []
    page.on('pageerror', (erreur) => erreursPage.push(String(erreur)))
    page.on('console', (message) => {
      if (message.type() === 'error') erreursConsole.push(message.text())
    })

    await bloquerStockage(page)
    const reponse = await page.goto('/pt/precos/eletricista/', { waitUntil: 'networkidle' })
    expect(reponse?.status()).toBe(200)

    // Le stockage est bien bloqué dans la page.
    const bloque = await page.evaluate(() => {
      try {
        void window.localStorage
        return false
      } catch {
        return true
      }
    })
    expect(bloque).toBe(true)

    const bandeau = page.getByRole('dialog', { name: /cookie/i })
    await expect(bandeau).toBeVisible({ timeout: 5000 })
    await bandeau.getByRole('button', { name: /Aceitar todos|Tout accepter|Accept all/i }).click()
    await expect(bandeau).toBeHidden({ timeout: 5000 })

    // La page reste utilisable : titre présent, navigation interne possible.
    await expect(page.locator('h1')).toBeVisible()
    await page.waitForTimeout(1500)

    expect(erreursPage).toEqual([])
    const erreursHorsReseau = erreursConsole.filter((e) => !/Failed to load resource|net::ERR|404/.test(e))
    expect(erreursHorsReseau).toEqual([])
  })
})
