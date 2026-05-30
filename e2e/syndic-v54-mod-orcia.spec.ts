import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d23) — navigation shell vers Orçamento IA. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Orçamento IA', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Orçamento IA (titre + paramètres)', async ({ page }) => {
    await page.getByRole('button', { name: 'Orçamento IA', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Orçamento Anual com IA', level: 1 })).toBeVisible()
    await expect(page.getByText('Parâmetros de Geração', { exact: true })).toBeVisible()
  })
})
