import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d39) — navigation shell vers Os Meus Módulos. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Os Meus Módulos', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Os Meus Módulos (titre + ordem do menu)', async ({ page }) => {
    await page.getByRole('button', { name: 'Os Meus Módulos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Os meus módulos', level: 1 })).toBeVisible()
    await expect(page.getByText('Ordem do menu', { exact: true })).toBeVisible()
  })
})
