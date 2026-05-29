import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d15) — navigation shell vers Portal do Condómino. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Portal do Condómino', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Portal do Condómino (titre + ações + avisos)', async ({ page }) => {
    await page.getByRole('button', { name: 'Portal do Condómino', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Portal do Condómino', level: 1 })).toBeVisible()
    await expect(page.getByText('Ações rápidas')).toBeVisible()
    // exact: le titre de l'avis est aussi sous-chaîne d'un autre desc → éviter la collision substring Playwright.
    await expect(page.getByText('Assembleia Geral Ordinária', { exact: true })).toBeVisible()
  })
})
