import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d26) — navigation shell vers Monitorização de Consumos. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Monitorização Consumos', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Monitorização Consumos (titre + alertas)', async ({ page }) => {
    await page.getByRole('button', { name: 'Monitorização Consumos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Monitorização de Consumos', level: 1 })).toBeVisible()
    await expect(page.getByText('Alertas ativos (2)', { exact: true })).toBeVisible()
  })
})
