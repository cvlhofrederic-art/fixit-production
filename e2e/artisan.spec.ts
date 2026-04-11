import { test, expect } from '@playwright/test'

test.describe('Artisan pages', () => {
  // The i18n proxy redirects /path → /{locale}/path/ with a 307.
  // Tests use the locale-prefixed URL directly to avoid redirect issues.

  test('/recherche page loads', async ({ page }) => {
    const response = await page.goto('/fr/recherche/', { waitUntil: 'networkidle' })
    expect(response).not.toBeNull()
    expect(response!.status()).toBe(200)
  })

  test('search functionality is present on /recherche', async ({ page }) => {
    await page.goto('/fr/recherche/', { waitUntil: 'networkidle' })

    // The search page should have a search input or a filter mechanism
    // The page imports the Search icon and uses SlidersHorizontal for filters
    const searchArea = page.locator('input[type="text"], input[type="search"], [role="searchbox"]').first()
    await expect(searchArea).toBeAttached({ timeout: 10000 })
  })

  test('/pro/dashboard redirects to login when not authenticated', async ({ page }) => {
    // Clear any auth cookies/session
    await page.context().clearCookies()

    await page.goto('/fr/pro/dashboard', { waitUntil: 'networkidle' })

    // The proxy redirects unauthenticated users to /{locale}/auth/login
    await page.waitForURL('**/fr/auth/login**', { timeout: 15000 })
    expect(page.url()).toContain('/fr/auth/login')
  })

  test('/client/dashboard redirects to login when not authenticated', async ({ page }) => {
    await page.context().clearCookies()

    await page.goto('/fr/client/dashboard', { waitUntil: 'networkidle' })

    // Proxy redirects to /{locale}/auth/login for client routes
    await page.waitForURL('**/fr/auth/login**', { timeout: 15000 })
    expect(page.url()).toContain('/fr/auth/login')
  })
})
