import { test, expect } from '@playwright/test'

test.describe('Artisan pages', () => {
  test('/recherche page loads', async ({ page }) => {
    const response = await page.goto('/recherche')
    expect(response).not.toBeNull()
    expect(response!.status()).toBe(200)
  })

  test('search functionality is present on /recherche', async ({ page }) => {
    await page.goto('/recherche')

    // The search page should have a search input or a filter mechanism
    // The page imports the Search icon and uses SlidersHorizontal for filters
    const searchArea = page.locator('input[type="text"], input[type="search"], [role="searchbox"]').first()
    await expect(searchArea).toBeAttached({ timeout: 10000 })
  })

  test('/pro/dashboard redirects to login when not authenticated', async ({ page }) => {
    // Clear any auth cookies/session
    await page.context().clearCookies()

    const response = await page.goto('/pro/dashboard', { waitUntil: 'domcontentloaded' })

    // The middleware redirects unauthenticated users to /pro/login
    await page.waitForURL('**/pro/login**', { timeout: 10000 })
    expect(page.url()).toContain('/pro/login')
  })

  test('/client/dashboard redirects to login when not authenticated', async ({ page }) => {
    await page.context().clearCookies()

    await page.goto('/client/dashboard', { waitUntil: 'domcontentloaded' })

    // Middleware redirects to /auth/login for client routes
    await page.waitForURL('**/auth/login**', { timeout: 10000 })
    expect(page.url()).toContain('/auth/login')
  })
})
