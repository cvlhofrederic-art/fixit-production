import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d13) — navigation shell vers Multi-Imóveis (ErrorState). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Multi-Imóveis', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Multi-Imóveis (titre + état d’erreur)', async ({ page }) => {
    await page.getByRole('button', { name: 'Multi-Imóveis', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Multi-Imóveis', level: 1 })).toBeVisible()
    await expect(page.getByText('Erro ao carregar imóveis')).toBeVisible()
  })
})
