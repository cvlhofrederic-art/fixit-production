import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d16) — navigation shell vers Comparador de Energia. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Comparador Energia', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Comparador Energia (titre + profil + édifice)', async ({ page }) => {
    await page.getByRole('button', { name: 'Comparador Energia', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Comparador de Tarifas de Energia Coletiva', level: 1 })).toBeVisible()
    await expect(page.getByText('Perfil Energético por Edifício', { exact: true })).toBeVisible()
    await expect(page.getByText('Edifício Aurora', { exact: true })).toBeVisible()
  })
})
