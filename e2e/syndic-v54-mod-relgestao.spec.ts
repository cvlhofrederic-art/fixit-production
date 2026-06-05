import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d19) — navigation shell vers Relatório de Gestão. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Relatório de Gestão', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Relatório de Gestão (titre + formulaire)', async ({ page }) => {
    await page.getByRole('button', { name: 'Relatório de Gestão', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Relatório de Gestão', level: 1 })).toBeVisible()
    await expect(page.getByText('Dados do período — Abril 2026', { exact: true })).toBeVisible()
  })
})
