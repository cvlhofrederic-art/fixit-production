import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d7) — navigation shell vers Relatório Mensal + Análise Orçamentos. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — modules d7', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Relatório Mensal (titre + aperçu)', async ({ page }) => {
    await page.getByRole('button', { name: 'Relatório mensal', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Relatório Mensal', level: 1 })).toBeVisible()
    await expect(page.getByText('Relatório Mensal de Gestão')).toBeVisible()
  })

  test('Análise Orçamentos/Faturas (titre + drop-zone)', async ({ page }) => {
    await page.getByRole('button', { name: 'Análise Orçamentos/Faturas', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Análise Orçamentos & Faturas', level: 1 })).toBeVisible()
    await expect(page.getByText('Arraste o seu PDF aqui')).toBeVisible()
  })
})
