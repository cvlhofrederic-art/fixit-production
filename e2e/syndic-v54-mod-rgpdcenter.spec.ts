import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d38) — navigation shell vers RGPD Compliance Center. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — RGPD Center', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('RGPD Center (titre + direitos)', async ({ page }) => {
    await page.getByRole('button', { name: 'RGPD Center', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'RGPD Compliance Center', level: 1 })).toBeVisible()
    await expect(page.getByText('Direito de esquecimento', { exact: true })).toBeVisible()
  })
})
