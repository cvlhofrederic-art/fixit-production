import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d53) — navigation shell vers Planeamento (agenda semaine). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Planeamento', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Planeamento (titre + agenda + sélecteur équipe)', async ({ page }) => {
    await page.getByRole('button', { name: 'Planeamento', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Planeamento', level: 1 })).toBeVisible()
    await expect(page.getByText(/Eventos da semana/).first()).toBeVisible()
    await page.getByRole('button', { name: /Toda a equipa/ }).click()
    await expect(page.getByText('Helena Carvalho').first()).toBeVisible()
  })
})
