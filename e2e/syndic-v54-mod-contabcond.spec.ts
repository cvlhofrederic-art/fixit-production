import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d54) — navigation shell vers Contabilidade Condomínio (7 onglets). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Contabilidade Condomínio', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Contabilidade Condomínio (titre + KPIs + onglets)', async ({ page }) => {
    await page.getByRole('button', { name: 'Contabilidade Condomínio', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Contabilidade Condomínio', level: 1 })).toBeVisible()
    await expect(page.getByText('Frações geridas', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: /Diário contabilístico/ }).click()
    await expect(page.getByText(/Saldo :/).first()).toBeVisible()
  })
})
