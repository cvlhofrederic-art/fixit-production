import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d31) — navigation shell vers Tracker de Deliberações. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Tracker Deliberações', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Tracker Deliberações (titre + pipeline IA)', async ({ page }) => {
    await page.getByRole('button', { name: 'Tracker Deliberações', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Tracker de Deliberações', level: 1 })).toBeVisible()
    await expect(page.getByText('Análise semântica', { exact: true })).toBeVisible()
  })
})
