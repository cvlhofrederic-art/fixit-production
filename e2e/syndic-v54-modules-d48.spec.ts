import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d48) — navigation shell vers Ocorrências + Quadro de Avisos. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — d48 (Ocorrências + QuadroAvisos)', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Ocorrências (titre + SLA)', async ({ page }) => {
    await page.getByRole('button', { name: 'Ocorrências', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Ocorrências e Manutenção', level: 1 })).toBeVisible()
    await expect(page.getByText('Conformidade SLA', { exact: true })).toBeVisible()
  })

  test('Quadro de Avisos (titre + avisos)', async ({ page }) => {
    await page.getByRole('button', { name: 'Quadro de Avisos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Quadro de Avisos', level: 1 })).toBeVisible()
    await expect(page.getByText('Ações Rápidas', { exact: true })).toBeVisible()
  })
})
