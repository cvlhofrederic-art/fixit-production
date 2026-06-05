import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d21) — navigation shell vers Comunicação Digital. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Comunicação Digital', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Comunicação digital (titre + table)', async ({ page }) => {
    await page.getByRole('button', { name: 'Comunicação digital', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Comunicação Digital', level: 1 })).toBeVisible()
    await expect(page.getByText('Ana Silva', { exact: true })).toBeVisible()
  })
})
