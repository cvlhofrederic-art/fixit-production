import { test, expect } from '@playwright/test'

test.describe('Artisan registration flow', () => {
  // The i18n proxy redirects /pro/register → /{locale}/pro/register/
  // Tests use the locale-prefixed URL directly to avoid 307 redirect
  const REGISTER_URL = '/fr/pro/register/'

  // Helper: navigate to register page and wait for full hydration
  async function gotoRegister(page: import('@playwright/test').Page) {
    await page.goto(REGISTER_URL, { waitUntil: 'networkidle' })
    await expect(page.getByText("Quel type d'organisation")).toBeVisible({ timeout: 15000 })
  }

  // Helper: select artisan org type and wait for form
  async function selectArtisan(page: import('@playwright/test').Page) {
    await gotoRegister(page)
    await page.getByText('Artisan / Auto-entrepreneur').click()
    await expect(page.locator('input[placeholder="Jean"]')).toBeVisible({ timeout: 15000 })
  }

  test('registration page loads with org type selection', async ({ page }) => {
    const response = await page.goto(REGISTER_URL, { waitUntil: 'networkidle' })
    expect(response).not.toBeNull()
    expect(response!.status()).toBe(200)
    await expect(page.getByText("Quel type d'organisation")).toBeVisible({ timeout: 15000 })
  })

  test('all 5 org type buttons are rendered', async ({ page }) => {
    await gotoRegister(page)
    await expect(page.getByText('Artisan / Auto-entrepreneur')).toBeVisible()
    await expect(page.getByText('🏛️')).toBeVisible()
    await expect(page.getByText('🏢')).toBeVisible()
    await expect(page.getByText('🗝️')).toBeVisible()
    await expect(page.getByText('🏗️')).toBeVisible()
  })

  test('clicking Artisan navigates to step 1 form', async ({ page }) => {
    await selectArtisan(page)
    await expect(page.locator('input[placeholder="Dupont"]')).toBeVisible()
    await expect(page.locator('input[placeholder="pro@email.com"]')).toBeVisible()
  })

  test('step 1 form shows SIRET field after selecting artisan', async ({ page }) => {
    await selectArtisan(page)
    const siretInput = page.locator('input.font-mono')
    await expect(siretInput).toBeVisible({ timeout: 10000 })
  })

  test('step 1 validation rejects empty form', async ({ page }) => {
    await selectArtisan(page)
    const submitBtn = page.locator('button[type="submit"]')
    await submitBtn.click()
    // Form uses HTML5 required validation — check that we stay on step 1
    // (no navigation away) and either native validation or JS error appears
    const errorDiv = page.locator('.bg-red-50.text-red-600')
    const nativeInvalid = page.locator('input:invalid')
    // At least one validation indicator should appear
    await expect(errorDiv.or(nativeInvalid.first())).toBeVisible({ timeout: 5000 })
  })

  test('password fields are present with validation', async ({ page }) => {
    await selectArtisan(page)
    const passwordInputs = page.locator('input[type="password"]')
    await expect(passwordInputs.first()).toBeVisible({ timeout: 10000 })
    expect(await passwordInputs.count()).toBe(2)
  })

  test('trade/metier selection grid is visible', async ({ page }) => {
    await selectArtisan(page)
    const tradeButtons = page.locator('button:has-text("⚡"), button:has-text("🔧"), button:has-text("🎨")')
    const count = await tradeButtons.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('/pro/dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/pro/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForURL('**/auth/login**', { timeout: 15000 })
    expect(page.url()).toContain('/auth/login')
  })

  test('/client/dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/client/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForURL('**/auth/login**', { timeout: 15000 })
    expect(page.url()).toContain('/auth/login')
  })

  test('/syndic/dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/syndic/dashboard', { waitUntil: 'domcontentloaded' })
    // Proxy redirects syndic to /{locale}/syndic/login/ (not /auth/login)
    await page.waitForURL('**/syndic/login**', { timeout: 15000 })
    expect(page.url()).toContain('/syndic/login')
  })
})
