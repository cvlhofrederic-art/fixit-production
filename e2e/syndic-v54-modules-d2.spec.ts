import { test, expect, type Page } from '@playwright/test'

/**
 * Étape d (batch d2) — navigation du shell vers Ordens de serviço + Profissionais.
 * Gated /syndic/dev/dashboard, build prod.
 */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — modules d2 (Ordens, Profissionais)', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('navigation vers Ordens de serviço', async ({ page }) => {
    await page.getByRole('button', { name: /Ordens de serviço/ }).click()
    await expect(page.getByRole('heading', { name: 'Ordens de serviço', level: 1 })).toBeVisible()
    await expect(page.getByText('Canalização · Fuga de água apartamento')).toBeVisible()
  })

  test('navigation vers Profissionais', async ({ page }) => {
    await page.getByRole('button', { name: /^Profissionais/ }).click()
    await expect(page.getByRole('heading', { name: 'Profissionais', level: 1 })).toBeVisible()
    await expect(page.getByText('Canalizador')).toBeVisible()
  })
})
