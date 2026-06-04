import { test, expect, type Page } from '@playwright/test'

/**
 * Showcase Modal (batch 6). Focus : le focus trap WAI-ARIA hand-rolled
 * (ESC, restauration du focus, inert sur le fond) — les pièges classiques
 * d'un modal fait main. Spec validée en build prod (cf. .claude/rules/testing.md :
 * le dev-server n'hydrate pas React de façon fiable sous Playwright).
 */

test.describe.configure({ timeout: 120_000 })

async function gotoPrimitive(page: Page, slug: string) {
  await page.goto(`/fr/syndic/dev/primitives/${slug}/`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
}

test.describe('Syndic v54 — Modal showcase', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPrimitive(page, 'modal')
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('ouvre : role=dialog + aria-modal + aria-labelledby', async ({ page }) => {
    await page.getByTestId('open-modal').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    await expect(dialog).toHaveAttribute('aria-labelledby', 'demo-modal-title')
  })

  test('CRITIQUE: ESC ferme ET restaure le focus au déclencheur', async ({ page }) => {
    const trigger = page.getByTestId('open-modal')
    await trigger.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0) // unmount
    await expect(trigger).toBeFocused() // restauration du focus
  })

  test('focus initial sur le bouton fermer', async ({ page }) => {
    await page.getByTestId('open-modal').click()
    await expect(page.getByRole('button', { name: 'Fechar' })).toBeFocused()
  })

  test('clic backdrop ferme', async ({ page }) => {
    await page.getByTestId('open-modal').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.mouse.click(8, 8) // coin = backdrop (le dialog est centré)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('inert sur le fond pendant ouverture, restauré à la fermeture', async ({ page }) => {
    await page.getByTestId('open-modal').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const inertWhileOpen = await page.evaluate(() =>
      Array.from(document.body.children).some((c) => c.hasAttribute('inert')),
    )
    expect(inertWhileOpen).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const inertAfterClose = await page.evaluate(() =>
      Array.from(document.body.children).some((c) => c.hasAttribute('inert')),
    )
    expect(inertAfterClose).toBe(false)
  })

  test('focus trap : le focus reste dans le dialog après plusieurs Tab', async ({ page }) => {
    await page.getByTestId('open-modal').click()
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab')
    const contained = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      return !!d && d.contains(document.activeElement)
    })
    expect(contained).toBe(true)
  })
})
