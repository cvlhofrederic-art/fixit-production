import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d51) — navigation shell vers Caderneta de Manutenção (stateful). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Caderneta de Manutenção', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Caderneta de Manutenção (titre + état vide + ouverture modal)', async ({ page }) => {
    await page.getByRole('button', { name: 'Caderneta de Manutenção', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Caderneta de Manutenção & Técnica', level: 1 })).toBeVisible()
    await expect(page.getByText('Caderneta vazia', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '+ Intervenção' }).first().click()
    await expect(page.getByText('Nova intervenção', { exact: true })).toBeVisible()
  })
})
