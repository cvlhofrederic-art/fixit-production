import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d29) — navigation shell vers Prazos Legais. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Prazos Legais', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Prazos Legais (titre + liste obrigações)', async ({ page }) => {
    await page.getByRole('button', { name: 'Prazos legais', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Prazos Legais', level: 1 })).toBeVisible()
    await expect(page.getByText('Verificação de extintores', { exact: true })).toBeVisible()
  })
})
