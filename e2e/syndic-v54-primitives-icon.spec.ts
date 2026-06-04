import { test, expect, type Page } from '@playwright/test'

/**
 * Showcase Icon (batch 1 étape b) — grille des 103 icônes.
 *
 * Même contrat de navigation que le spec tokens : /fr/ explicite (le rewrite
 * locale n'existe que pour fr), domcontentloaded + timeout large (compile
 * Turbopack dev ~30s), waitFor explicite. Sandbox gated localhost-only.
 */

test.describe.configure({ timeout: 120_000 })

async function gotoIconShowcase(page: Page) {
  await page.goto('/fr/syndic/dev/primitives/icon/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
}

test.describe('Syndic v54 — Icon showcase', () => {
  test.beforeEach(async ({ page }) => {
    await gotoIconShowcase(page)
  })

  test('renders the full 103-icon grid', async ({ page }) => {
    const grid = page.getByTestId('icon-grid')
    await expect(grid).toBeVisible()
    const cells = grid.locator('> div')
    await expect(cells).toHaveCount(103)
  })

  test('every grid cell contains a rendered svg', async ({ page }) => {
    const svgCount = await page.getByTestId('icon-grid').locator('> div > svg').count()
    expect(svgCount).toBe(103)
  })

  test('no icon silently renders an empty svg (broken path)', async ({ page }) => {
    // Chaque <svg> doit avoir au moins un enfant (path/rect/circle). Un svg
    // vide trahirait un path manquant dans le registre.
    const emptyCount = await page.getByTestId('icon-grid').locator('> div > svg:empty').count()
    expect(emptyCount).toBe(0)
  })

  test('icon grid screenshot is archived as artifact', async ({ page }, testInfo) => {
    const buf = await page.getByTestId('icon-grid').screenshot()
    await testInfo.attach('icon-grid-103', { body: buf, contentType: 'image/png' })
  })

  test('public marketing Header is NOT rendered', async ({ page }) => {
    await expect(page.locator('header')).toHaveCount(0)
  })
})
