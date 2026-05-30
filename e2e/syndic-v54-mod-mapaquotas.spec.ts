import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d27) — navigation shell vers Mapa de Quotas. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Mapa de Quotas', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Mapa de Quotas (titre + tableau frações)', async ({ page }) => {
    await page.getByRole('button', { name: 'Mapa de Quotas', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Mapa de Quotas', level: 1 })).toBeVisible()
    await expect(page.getByText('Ana Silva', { exact: true })).toBeVisible()
  })
})
