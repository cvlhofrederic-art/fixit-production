import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d25) — navigation shell vers Integração e-Fatura AT. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — e-Fatura AT', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('e-Fatura AT (titre + nova submissão)', async ({ page }) => {
    await page.getByRole('button', { name: 'e-Fatura AT', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Integração e-Fatura AT', level: 1 })).toBeVisible()
    await expect(page.getByText('Nova Submissão e-Fatura', { exact: true })).toBeVisible()
  })
})
