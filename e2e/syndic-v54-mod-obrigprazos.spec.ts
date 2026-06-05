import { test, expect, type Page } from '@playwright/test'

/** Étape d (batch d44) — navigation shell vers Obrigações e Prazos (stateful). Build prod, gated. */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Obrigações e Prazos', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('Obrigações e Prazos (titre + références + ouverture modal)', async ({ page }) => {
    await page.getByRole('button', { name: 'Obrigações e Prazos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Obrigações Legais', level: 1 })).toBeVisible()
    await expect(page.getByText('Inspeção de gás', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '+ Adicionar' }).first().click()
    await expect(page.getByText('Adicionar obrigação legal', { exact: true })).toBeVisible()
  })
})
