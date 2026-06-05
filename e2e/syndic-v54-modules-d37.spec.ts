import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d37) — navigation shell vers Open Banking + Reembolsos. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — d37 (OpenBanking + Reembolsos)', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Open Banking (titre + bancos)', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Banking', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Open Banking — Reconciliação Automática', level: 1 })).toBeVisible()
    await expect(page.getByText('Caixa Geral', { exact: true })).toBeVisible()
  })

  test('Reembolsos (titre + pipeline)', async ({ page }) => {
    await page.getByRole('button', { name: 'Reembolsos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Reembolsos Automáticos', level: 1 })).toBeVisible()
    await expect(page.getByText('Declaração venda fração', { exact: true })).toBeVisible()
  })
})
