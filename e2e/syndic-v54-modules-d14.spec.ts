import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d14) — navigation shell vers Cobrança Judicial + Carregamento VE. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — modules d14', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Cobrança Judicial (titre + pipeline)', async ({ page }) => {
    await page.getByRole('button', { name: 'Cobrança Judicial', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Cobrança Judicial', level: 1 })).toBeVisible()
    await expect(page.getByText('Pipeline de cobrança')).toBeVisible()
  })

  test('Carregamento VE (titre + pedido)', async ({ page }) => {
    await page.getByRole('button', { name: 'Carregamento VE', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Carregamento de Veículos Elétricos', level: 1 })).toBeVisible()
    await expect(page.getByText('Carlos Ferreira')).toBeVisible()
  })
})
