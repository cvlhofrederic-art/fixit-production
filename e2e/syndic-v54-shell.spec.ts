import { test, expect, type Page } from '@playwright/test'

/**
 * Étape c — Shell dashboard syndic v54 (/syndic/dev/dashboard, gated).
 * Navigation (placeholder + agent), drawer mobile. Validé build prod
 * (cf. .claude/rules/testing.md). Locators role+name uniques.
 */

test.describe.configure({ timeout: 120_000 })

test.describe('Syndic v54 — Dashboard shell', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/fr/syndic/dev/dashboard/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('rend le shell : brand + sidebar + topbar', async ({ page }) => {
    await expect(page.getByText('VitFix Pro')).toBeVisible()
    await expect(page.getByRole('button', { name: /Painel de controlo/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nova missão' })).toBeVisible()
  })

  test('navigation : clic sur un module change le contenu', async ({ page }) => {
    await page.getByRole('button', { name: /Canal de Comunicações/ }).click()
    await expect(page.getByRole('heading', { name: 'Canal de Comunicações', level: 1 })).toBeVisible()
  })

  test('navigation agent : Fixy rend AgentChatPage', async ({ page }) => {
    await page.getByRole('button', { name: /^Fixy/ }).click()
    await expect(page.getByLabel('Pergunta a Fixy')).toBeVisible()
  })

  test('drawer mobile : hamburger ouvre la sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 })
    const hamburger = page.getByRole('button', { name: 'Abrir menu' })
    await expect(hamburger).toBeVisible()
    await hamburger.click()
    await expect(page.getByRole('button', { name: 'Fechar menu' })).toBeVisible()
  })
})
