import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d36) — navigation shell vers Câmaras Vigilância + NPS Pós-Intervenção. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — d36 (CCTV + NPS)', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Câmaras Vigilância (titre + tableau)', async ({ page }) => {
    await page.getByRole('button', { name: 'Câmaras Vigilância', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Câmaras de Vigilância', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhuma câmara registada.', { exact: true })).toBeVisible()
  })

  test('NPS Pós-Intervenção (titre + Empty)', async ({ page }) => {
    await page.getByRole('button', { name: 'NPS Pós-Intervenção', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'NPS Pós-Intervenção', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhum inquérito enviado ainda', { exact: true })).toBeVisible()
  })
})
