import { test, expect, type Page } from '@playwright/test'

/** Étape d — navigation shell vers Edifícios (utilise Progress). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Edifícios', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('navigation vers Edifícios (titre + bâtiment + barre de progression)', async ({ page }) => {
    await page.getByRole('button', { name: /Edifícios/ }).click()
    await expect(page.getByRole('heading', { name: 'Edifícios', level: 1 })).toBeVisible()
    await expect(page.getByText('Edifício Atlântico')).toBeVisible()
    await expect(page.getByRole('progressbar').first()).toBeVisible()
  })
})
