import { test, expect, type Page } from '@playwright/test'

/**
 * Étape d — Painel de controlo (ModDashboard) rendu dans le shell, route par
 * défaut de /syndic/dev/dashboard (gated). Validé build prod.
 */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Painel de controlo', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('la route par défaut rend le Painel de controlo (hero + KPIs)', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Bem-vindo/ })).toBeVisible()
    await expect(page.getByText('Edifícios geridos')).toBeVisible()
    await expect(page.getByText('Orçamento global — Exercício 2026')).toBeVisible()
  })

  test('action rapide → toast', async ({ page }) => {
    await page.getByRole('button', { name: /Criar missão/ }).click()
    await expect(page.getByText('Abertura do formulário de nova missão')).toBeVisible()
  })
})
