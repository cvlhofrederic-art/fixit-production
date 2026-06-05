import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d42) — navigation shell vers Declaração de Encargos (stateful). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Declaração de Encargos', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Declaração de Encargos (titre + état vide + ouverture modal)', async ({ page }) => {
    await page.getByRole('button', { name: 'Declaração de Encargos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Declaração de Encargos', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhuma declaração registada', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '+ Nova declaração' }).first().click()
    await expect(page.getByText('Nova declaração de encargos', { exact: true })).toBeVisible()
  })
})
