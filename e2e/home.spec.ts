import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('loads with status 200', async ({ page }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()
    expect(response!.status()).toBe(200)
  })

  test('has a visible main heading', async ({ page }) => {
    await page.goto('/')
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()
    await expect(heading).toContainText('artisan')
  })

  test('header navigation is present', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')
    await expect(header).toBeVisible()

    // VITFIX logo / brand name should be in the header
    await expect(header.getByText('VITFIX', { exact: true }).first()).toBeVisible()

    // Desktop nav with role="navigation" exists
    const nav = header.locator('nav')
    await expect(nav.first()).toBeAttached()
  })

  test('cookie consent banner appears', async ({ page }) => {
    // Clear localStorage to ensure cookie consent has not been dismissed
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('vitfix_cookie_consent'))
    await page.reload()

    // The banner appears after a 1500ms delay
    const banner = page.locator('[role="dialog"][aria-label="Consentement cookies"]')
    await expect(banner).toBeVisible({ timeout: 5000 })

    // Has accept and refuse buttons
    const acceptButton = banner.getByRole('button', { name: /accepter/i })
    const refuseButton = banner.getByRole('button', { name: /refuser/i })
    await expect(acceptButton).toBeVisible()
    await expect(refuseButton).toBeVisible()
  })

  test('services section lists artisan categories', async ({ page }) => {
    await page.goto('/')

    // The homepage displays service cards (Plomberie, Electricite, etc.)
    await expect(page.getByText('Plomberie')).toBeVisible()
    await expect(page.getByText('Serrurerie')).toBeVisible()
  })
})
