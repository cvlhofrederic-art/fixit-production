import { test, expect, type Page } from '@playwright/test'

/**
 * Showcase Toast (batch 7). Focus : kinds + aria-live, auto-dismiss, cap 3 FIFO,
 * pause au survol / focus-within, dismiss clavier, et surtout le test critique
 * #253 — le viewport (inline dans le wrapper) est neutralisé par l'inert d'un
 * Modal ouvert. Spec validée en build prod (cf. .claude/rules/testing.md).
 */

test.describe.configure({ timeout: 120_000 })

async function gotoPrimitive(page: Page, slug: string) {
  await page.goto(`/fr/syndic/dev/primitives/${slug}/`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
}

test.describe('Syndic v54 — Toast showcase', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPrimitive(page, 'toast')
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('viewport role=region + aria-label ; push kinds -> role/aria-live corrects', async ({ page }) => {
    await expect(page.getByRole('region', { name: 'Notificações' })).toBeAttached()
    await page.getByTestId('push-success').click()
    const status = page.getByRole('status')
    await expect(status).toBeVisible()
    await expect(status).toHaveAttribute('aria-live', 'polite')
    await page.getByTestId('push-error').click()
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toHaveAttribute('aria-live', 'assertive')
  })

  test('auto-dismiss : success disparaît (~4s)', async ({ page }) => {
    await page.getByTestId('push-success').click()
    await expect(page.getByText('Intervenção criada')).toBeVisible()
    await expect(page.getByText('Intervenção criada')).toHaveCount(0, { timeout: 6000 })
  })

  test('cap 3 FIFO : empiler 4 -> 3 visibles, le plus ancien tombe', async ({ page }) => {
    await page.getByTestId('push-flood').click()
    // 4 poussés, cap 3 -> le 1er (success #1) tombe immédiatement.
    await expect(page.locator('[role="status"], [role="alert"]')).toHaveCount(3)
    await expect(page.getByText('Intervenção criada #1')).toHaveCount(0)
  })

  test('pause au survol : le timer est figé tant que la souris survole', async ({ page }) => {
    await page.getByTestId('push-success').click()
    const toast = page.getByRole('status')
    await toast.hover()
    await page.waitForTimeout(5000) // > 4s : sans pause, il aurait disparu
    await expect(toast).toBeVisible()
    await page.mouse.move(0, 0) // relâche le survol -> relance le timer
    await expect(page.getByText('Intervenção criada')).toHaveCount(0, { timeout: 6000 })
  })

  test('pause au focus-within : focus dans le toast fige le timer', async ({ page }) => {
    await page.getByTestId('push-success').click()
    await page.getByRole('button', { name: 'Fechar notificação' }).focus()
    await page.waitForTimeout(5000)
    await expect(page.getByRole('status')).toBeVisible() // toujours là (focus pause)
  })

  test('dismiss : clic X et touche Espace ferment', async ({ page }) => {
    await page.getByTestId('push-error').click()
    await page.getByRole('button', { name: 'Fechar notificação' }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    // Espace sur le X focalisé
    await page.getByTestId('push-error').click()
    const close = page.getByRole('button', { name: 'Fechar notificação' })
    await close.focus()
    await page.keyboard.press('Space')
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('CRITIQUE #253: viewport inerté pendant un Modal ouvert, restauré à la fermeture', async ({ page }) => {
    await page.getByTestId('open-modal-toast').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    // Pousser un toast depuis le modal (le bouton est dans le portail, hors inert)
    await page.getByTestId('push-from-modal').click()
    const inertedWhileModal = await page.evaluate(() => {
      const v = document.querySelector('[aria-label="Notificações"]')
      return !!v && !!v.closest('[inert]')
    })
    expect(inertedWhileModal).toBe(true) // viewport neutralisé par l'inert du modal
    // Fermer le modal -> le viewport n'est plus inerté (toast error persistant encore vivant)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const inertedAfterClose = await page.evaluate(() => {
      const v = document.querySelector('[aria-label="Notificações"]')
      return !!v && !!v.closest('[inert]')
    })
    expect(inertedAfterClose).toBe(false)
  })
})
