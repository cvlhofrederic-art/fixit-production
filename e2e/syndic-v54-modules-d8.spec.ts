import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d8) — navigation shell vers Seguros / Processamentos Lote / AG Live. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — modules d8', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Gestão Seguros (titre + état vide)', async ({ page }) => {
    await page.getByRole('button', { name: 'Gestão Seguros', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Gestão de Seguros', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhum edifício registado')).toBeVisible()
  })

  test('Processamentos Lote (titre + cartes)', async ({ page }) => {
    await page.getByRole('button', { name: 'Processamentos Lote', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Processamentos em Lote', level: 1 })).toBeVisible()
    // exact: getByText est substring/insensible à la casse → éviter la collision avec le lede (« …emissão de quotas… »).
    await expect(page.getByText('Emissão de Quotas', { exact: true })).toBeVisible()
  })

  test('AG Live Digital (titre + état vide)', async ({ page }) => {
    await page.getByRole('button', { name: 'AG Live Digital', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Assembleia Geral Digital', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhuma AG em curso')).toBeVisible()
  })
})
