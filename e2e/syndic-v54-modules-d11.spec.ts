import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d11) — navigation shell vers Predição / QR Code / Dashboard Condómino. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — modules d11', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Predição Manutenção (titre + distribution)', async ({ page }) => {
    await page.getByRole('button', { name: 'Predição Manutenção', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Predição de Manutenção', level: 1 })).toBeVisible()
    await expect(page.getByText('Distribuição de Risco')).toBeVisible()
  })

  test('QR Code Fração (titre + état vide)', async ({ page }) => {
    await page.getByRole('button', { name: 'QR Code Fração', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'QR Code por Fração', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhum QR Code criado')).toBeVisible()
  })

  test('Dashboard Condómino (titre + KPI)', async ({ page }) => {
    await page.getByRole('button', { name: 'Dashboard Condómino', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard Condómino — Tempo Real', level: 1 })).toBeVisible()
    await expect(page.getByText('Total condóminos', { exact: true })).toBeVisible()
  })
})
