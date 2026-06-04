import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d35) — navigation shell vers Contratos + Mapa Fiscal Anual. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — d35 (Contratos + MapaFiscal)', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Contratos (titre + lifecycle)', async ({ page }) => {
    await page.getByRole('button', { name: 'Contratos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Contratos com Prestadores', level: 1 })).toBeVisible()
    await expect(page.getByText('Alerta J-90', { exact: true })).toBeVisible()
  })

  test('Mapa Fiscal Anual (titre + tableau)', async ({ page }) => {
    await page.getByRole('button', { name: 'Mapa Fiscal Anual', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Mapa Fiscal Anual', level: 1 })).toBeVisible()
    await expect(page.getByText('Manutenção elevadores', { exact: true })).toBeVisible()
  })
})
