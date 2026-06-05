import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d6) — navigation shell vers Calendário Regulamentar + Documentos (GED). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — modules d6', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Calendário Regulamentar (titre + table)', async ({ page }) => {
    await page.getByRole('button', { name: 'Calendário regulamentar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Calendário Regulamentar', level: 1 })).toBeVisible()
    await expect(page.getByText('AG Anual obrigatória')).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('Documentos (GED) (titre + compteur + table)', async ({ page }) => {
    await page.getByRole('button', { name: 'Documentos (GED)', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Documentos (GED)', level: 1 })).toBeVisible()
    await expect(page.getByText('10 documentos encontrados')).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
  })
})
