import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d45) — navigation shell vers Seguro Obrigatório (stateful). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Seguro Obrigatório', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Seguro Obrigatório (titre + état vide + ouverture modal)', async ({ page }) => {
    await page.getByRole('button', { name: 'Seguro Obrigatório', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Seguro Obrigatório de Condomínio', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhuma apólice registada', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '+ Nova Apólice' }).first().click()
    await expect(page.getByText('Nova apólice de seguro', { exact: true })).toBeVisible()
  })
})
