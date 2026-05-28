import { test, expect, type Page } from '@playwright/test'

/**
 * Showcase Tabs (batch 5). Focus : le pattern clavier WAI-ARIA (roving tabindex
 * + activation automatique), le piège classique des tabs hand-rolled.
 */

test.describe.configure({ timeout: 120_000 })

async function gotoPrimitive(page: Page, slug: string) {
  await page.goto(`/fr/syndic/dev/primitives/${slug}/`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
}

test.describe('Syndic v54 — Tabs showcase', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPrimitive(page, 'tabs')
    // Attendre l'hydratation (le dev server hydrate lentement) avant clavier/clic.
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('CRITIQUE: flèche droite = aria-selected + activeElement + onChange ensemble', async ({ page }) => {
    const list = page.getByTestId('tabs-controlled')
    const pro = list.getByRole('tab', { name: /Pro/ })
    await pro.focus()
    await expect(pro).toBeFocused()
    await page.keyboard.press('ArrowRight')
    const interno = list.getByRole('tab', { name: /Interno/ })
    await expect(interno).toHaveAttribute('aria-selected', 'true') // (a)
    await expect(interno).toBeFocused() // (b) document.activeElement === tab 2
    await expect(page.getByTestId('tabs-active')).toContainText('int') // (c) onChange a fired
  })

  test('flèche gauche wrappe du premier au dernier', async ({ page }) => {
    const list = page.getByTestId('tabs-controlled')
    await list.getByRole('tab', { name: /Pro/ }).focus()
    await page.keyboard.press('ArrowLeft')
    await expect(list.getByRole('tab', { name: /Pedidos/ })).toHaveAttribute('aria-selected', 'true')
  })

  test('Home/End sautent au premier/dernier (sans wrap)', async ({ page }) => {
    const list = page.getByTestId('tabs-controlled')
    await list.getByRole('tab', { name: /Pro/ }).focus()
    await page.keyboard.press('End')
    await expect(list.getByRole('tab', { name: /Pedidos/ })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(list.getByRole('tab', { name: /Pro/ })).toBeFocused()
  })

  test('roving tabindex (actif 0, autres -1) + underline actif gold-500', async ({ page }) => {
    const list = page.getByTestId('tabs-controlled')
    const pro = list.getByRole('tab', { name: /Pro/ })
    expect(await pro.getAttribute('tabindex')).toBe('0')
    expect(await list.getByRole('tab', { name: /Interno/ }).getAttribute('tabindex')).toBe('-1')
    const underline = await pro.evaluate((el) => getComputedStyle(el, '::after').backgroundColor)
    expect(underline).toBe('rgb(201, 165, 116)') // gold-500 #C9A574
  })

  test('non-contrôlé : sélection au clic', async ({ page }) => {
    const list = page.getByTestId('tabs-uncontrolled')
    await list.getByRole('tab', { name: /Sinistros/ }).click()
    await expect(list.getByRole('tab', { name: /Sinistros/ })).toHaveAttribute('aria-selected', 'true')
  })
})
