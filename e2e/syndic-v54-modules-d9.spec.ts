import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d9) — navigation shell vers Atas IA / Pagamentos Digitais / Votação Online. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — modules d9', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Atas com IA (titre + action)', async ({ page }) => {
    await page.getByRole('button', { name: 'Atas com IA', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Atas com IA — Atas de Assembleia', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Começar do zero' })).toBeVisible()
  })

  test('Pagamentos Digitais (titre + table)', async ({ page }) => {
    await page.getByRole('button', { name: 'Pagamentos Digitais', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Pagamentos Digitais', level: 1 })).toBeVisible()
    await expect(page.getByText('Últimos 10 pagamentos recebidos')).toBeVisible()
  })

  test('Votação Online (titre + deliberações)', async ({ page }) => {
    await page.getByRole('button', { name: 'Votação Online', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Votação Online AG', level: 1 })).toBeVisible()
    await expect(page.getByText('Deliberações em curso', { exact: true })).toBeVisible()
  })
})
