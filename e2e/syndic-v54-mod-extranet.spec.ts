import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d46) — navigation shell vers Extranet Condóminos (stateful). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Extranet Condóminos', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Extranet Condóminos (titre + portail + ouverture modal)', async ({ page }) => {
    await page.getByRole('button', { name: 'Extranet Condóminos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Extranet Condóminos', level: 1 })).toBeVisible()
    await expect(page.getByText('Portal Condóminos', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '+ Condómino' }).first().click()
    await expect(page.getByText('Adicionar condómino', { exact: true })).toBeVisible()
  })
})
