import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d4b) — navigation shell vers A Minha Equipa + Condóminos. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Equipa & Condóminos', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('navigation vers A Minha Equipa (titre + membre + table)', async ({ page }) => {
    await page.getByRole('button', { name: 'A Minha Equipa', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'A Minha Equipa', level: 1 })).toBeVisible()
    await expect(page.getByText('Helena Carvalho')).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('navigation vers Condóminos (titre + état vide)', async ({ page }) => {
    await page.getByRole('button', { name: 'Condóminos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Condóminos & Inquilinos', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhum condómino encontrado')).toBeVisible()
  })
})
