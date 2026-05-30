import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d28) — navigation shell vers Orçamentos & Obras (3 orçamentos). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — 3 Orçamentos', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('3 Orçamentos (titre + kanban obras)', async ({ page }) => {
    await page.getByRole('button', { name: '3 Orçamentos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Orçamentos & Obras', level: 1 })).toBeVisible()
    await expect(page.getByText('Impermeabilização da cobertura', { exact: true })).toBeVisible()
  })
})
