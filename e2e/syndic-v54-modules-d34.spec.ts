import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d34) — navigation shell vers Elevadores + Segurança Edifício. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — d34 (Elevadores + SegEdifício)', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Elevadores (titre + workflow risco)', async ({ page }) => {
    await page.getByRole('button', { name: 'Elevadores', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Gestão de Elevadores', level: 1 })).toBeVisible()
    await expect(page.getByText('EMA deteta risco grave', { exact: true })).toBeVisible()
  })

  test('Segurança Edifício (titre + catégories)', async ({ page }) => {
    await page.getByRole('button', { name: 'Segurança Edifício', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Segurança Contra Incêndio', level: 1 })).toBeVisible()
    await expect(page.getByText('Categoria 1 — Reduzido', { exact: true })).toBeVisible()
  })
})
