import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d40) — navigation shell vers Pontuação de Saúde. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Pontuação Saúde', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Pontuação Saúde (titre + jauge)', async ({ page }) => {
    await page.getByRole('button', { name: 'Pontuação Saúde', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Pontuação de Saúde dos Edifícios', level: 1 })).toBeVisible()
    await expect(page.getByText('Pontuação Média', { exact: true })).toBeVisible()
  })
})
