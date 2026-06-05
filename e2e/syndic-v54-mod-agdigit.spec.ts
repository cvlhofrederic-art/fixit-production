import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d49) — navigation shell vers AG Digitais (stateful). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — AG Digitais', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('AG Digitais (titre + état vide + ouverture modal)', async ({ page }) => {
    await page.getByRole('button', { name: 'AG Digitais', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'AG Digitais', level: 1 })).toBeVisible()
    await expect(page.getByText('Nenhuma AG', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Nova AG' }).first().click()
    await expect(page.getByText('Nova Assembleia Geral', { exact: true })).toBeVisible()
  })
})
