import { test, expect, type Page } from '@playwright/test'

/**
 * Showcase Toast (batch 7). Focus : kinds + aria-live, auto-dismiss, cap 3 FIFO,
 * pause au survol / focus-within, dismiss clavier, et surtout le test critique
 * #253 — le viewport (inline dans le wrapper) est neutralisé par l'inert d'un
 * Modal ouvert. Spec validée en build prod (cf. .claude/rules/testing.md).
 *
 * NB : toutes les requêtes role=status/alert sont SCOPÉES au viewport toast.
 * Next.js injecte un `#__next-route-announcer__` (role=alert) global qu'il ne
 * faut pas confondre avec nos toasts.
 */

test.describe.configure({ timeout: 120_000 })

async function gotoPrimitive(page: Page, slug: string) {
  await page.goto(`/fr/syndic/dev/primitives/${slug}/`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
}

const viewportOf = (page: Page) => page.getByRole('region', { name: 'Notificações' })

test.describe('Syndic v54 — Toast showcase', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPrimitive(page, 'toast')
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 })
  })

  test('viewport role=region + aria-label ; push kinds -> role/aria-live corrects', async ({ page }) => {
    const viewport = viewportOf(page)
    await expect(viewport).toBeAttached()
    await page.getByTestId('push-success').click()
    const status = viewport.getByRole('status')
    await expect(status).toBeVisible()
    await expect(status).toHaveAttribute('aria-live', 'polite')
    await page.getByTestId('push-error').click()
    const alert = viewport.getByRole('alert')
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
    await expect(viewportOf(page).locator('[role="status"], [role="alert"]')).toHaveCount(3)
    await expect(page.getByText('Intervenção criada #1')).toHaveCount(0)
  })

  test('pause au survol : le timer est figé tant que la souris survole', async ({ page }) => {
    await page.getByTestId('push-success').click()
    const toast = viewportOf(page).getByRole('status')
    await expect(toast).toBeVisible()
    // Firefox CI : l'animation d'entrée + un mouseleave parasite peuvent relancer le
    // timer d'auto-dismiss (~4s). On force le survol (sans attendre la stabilité de
    // l'animation) et on le ré-affirme à mi-parcours pour garder la pause active > 4s.
    await toast.hover({ force: true })
    await page.waitForTimeout(2500)
    await toast.hover({ force: true }) // ré-affirme le survol (contre un mouseleave parasite firefox)
    await page.waitForTimeout(2500)
    await expect(toast).toBeVisible() // toujours là : le survol a bien figé le timer
    await page.mouse.move(0, 0) // relâche le survol -> relance le timer
    await expect(page.getByText('Intervenção criada')).toHaveCount(0, { timeout: 6000 })
  })

  test('pause au focus-within : focus dans le toast fige le timer', async ({ page }) => {
    await page.getByTestId('push-success').click()
    await page.getByRole('button', { name: 'Fechar notificação' }).focus()
    await page.waitForTimeout(5000)
    await expect(viewportOf(page).getByRole('status')).toBeVisible() // toujours là (focus pause)
  })

  test('dismiss : clic X et touche Espace ferment', async ({ page }) => {
    const viewport = viewportOf(page)
    await page.getByTestId('push-error').click()
    await page.getByRole('button', { name: 'Fechar notificação' }).click()
    await expect(viewport.getByRole('alert')).toHaveCount(0)
    // Espace sur le X focalisé
    await page.getByTestId('push-error').click()
    const close = page.getByRole('button', { name: 'Fechar notificação' })
    await close.focus()
    await page.keyboard.press('Space')
    await expect(viewport.getByRole('alert')).toHaveCount(0)
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
