import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d12) — navigation shell vers Sinistros / Preparador AG / Lançamento Faturas / Emails Fixy. Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — modules d12', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Sinistros (titre + pipeline)', async ({ page }) => {
    await page.getByRole('button', { name: 'Sinistros', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Pipeline Sinistros', level: 1 })).toBeVisible()
    await expect(page.getByText('VISTA DO PIPELINE')).toBeVisible()
  })

  test('Preparador AG (titre + état vide)', async ({ page }) => {
    await page.getByRole('button', { name: 'Preparador AG', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Preparador AG', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhuma AG preparada')).toBeVisible()
  })

  test('Lançamento IA Faturas (titre + drop-zone)', async ({ page }) => {
    await page.getByRole('button', { name: 'Lançamento IA Faturas', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Lançamento IA de Faturas', level: 1 })).toBeVisible()
    await expect(page.getByText('Arraste e largue as suas faturas aqui')).toBeVisible()
  })

  test('Emails Fixy (titre + état initial)', async ({ page }) => {
    await page.getByRole('button', { name: 'Emails Fixy', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Emails Fixy', level: 1 })).toBeVisible()
    await expect(page.getByText('Ligue a sua caixa Gmail')).toBeVisible()
  })
})
