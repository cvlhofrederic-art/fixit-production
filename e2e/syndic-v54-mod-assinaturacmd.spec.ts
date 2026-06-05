import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d18) — navigation shell vers Assinatura Digital CMD. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Assinatura CMD', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Assinatura CMD (titre + drop-zone)', async ({ page }) => {
    await page.getByRole('button', { name: 'Assinatura CMD', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Assinatura Digital CMD', level: 1 })).toBeVisible()
    await expect(page.getByText('Clique ou arraste o ficheiro aqui', { exact: true })).toBeVisible()
  })
})
