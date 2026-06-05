import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d50) — navigation shell vers Valores em dívida (stateful). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Valores em dívida', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Valores em dívida (titre + état vide + ouverture modal)', async ({ page }) => {
    await page.getByRole('button', { name: 'Valores em dívida', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Valores em dívida', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhum incumprimento', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '+ Incumprimento' }).first().click()
    await expect(page.getByText('Registar um incumprimento', { exact: true })).toBeVisible()
  })
})
