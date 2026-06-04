import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d33) — navigation shell vers Acessibilidade + Notificações Judiciais. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — d33 (Acessibilidade + NotificJud)', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Acessibilidade DL 163 (titre + critères)', async ({ page }) => {
    await page.getByRole('button', { name: 'Acessibilidade DL 163', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Acessibilidade dos Edifícios', level: 1 })).toBeVisible()
    await expect(page.getByText('Elevador acessível', { exact: true })).toBeVisible()
  })

  test('Notificações Judiciais (titre + tipos)', async ({ page }) => {
    await page.getByRole('button', { name: 'Notificações Judiciais', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Centro de Notificações Judiciais', level: 1 })).toBeVisible()
    await expect(page.getByText('Citação tribunal', { exact: true })).toBeVisible()
  })
})
