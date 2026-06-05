import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d20) — navigation shell vers Definições. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Definições', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Definições (titre + perfil)', async ({ page }) => {
    await page.getByRole('button', { name: 'Definições', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Definições', level: 1 })).toBeVisible()
    await expect(page.getByText('Super Admin VitFix', { exact: true })).toBeVisible()
  })
})
