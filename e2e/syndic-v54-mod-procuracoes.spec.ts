import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d32) — navigation shell vers Procurações & Lista de Presenças. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Procurações', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Procurações (titre + pipeline OCR)', async ({ page }) => {
    await page.getByRole('button', { name: 'Procurações & Presenças', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Procurações & Lista de Presenças', level: 1 })).toBeVisible()
    await expect(page.getByText('Pipeline OCR Léa', { exact: true })).toBeVisible()
  })
})
