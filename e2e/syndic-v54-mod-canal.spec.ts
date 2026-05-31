import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d52) — navigation shell vers Canal de Comunicações (3 colonnes). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Canal de Comunicações', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Canal (titre + missions + chat)', async ({ page }) => {
    await page.getByRole('button', { name: /Canal de Comunicações/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Canal de Comunicações', level: 1 })).toBeVisible()
    await expect(page.getByText('Condomínio Boavista Center', { exact: true })).toBeVisible()
    await expect(page.getByText('Canal profissional aberto', { exact: true })).toBeVisible()
  })
})
