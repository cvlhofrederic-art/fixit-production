import { test, expect } from '@playwright/test'

test.describe('Artisan registration flow', () => {
  test('registration page loads with org type selection', async ({ page }) => {
    const response = await page.goto('/pro/register', { waitUntil: 'domcontentloaded' })
    expect(response).not.toBeNull()
    expect(response!.status()).toBe(200)

    // Step 0: org type selection should be visible
    await expect(page.getByText("Quel type d'organisation")).toBeVisible({ timeout: 10000 })
  })

  test('all 5 org type buttons are rendered', async ({ page }) => {
    await page.goto('/pro/register', { waitUntil: 'domcontentloaded' })

    // Each org type button should exist
    await expect(page.getByText('Artisan / Auto-entrepreneur')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('🏛️')).toBeVisible()
    await expect(page.getByText('🏢')).toBeVisible()
    await expect(page.getByText('🗝️')).toBeVisible()
    await expect(page.getByText('🏗️')).toBeVisible()
  })

  test('clicking Artisan navigates to step 1 form', async ({ page }) => {
    await page.goto('/pro/register', { waitUntil: 'domcontentloaded' })

    // Click artisan org type
    await page.getByText('Artisan / Auto-entrepreneur').click()

    // Step 1 form fields should appear
    await expect(page.locator('input[placeholder="Jean"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[placeholder="Dupont"]')).toBeVisible()
    await expect(page.locator('input[placeholder="pro@email.com"]')).toBeVisible()
  })

  test('step 1 form shows SIRET field after selecting artisan', async ({ page }) => {
    await page.goto('/pro/register', { waitUntil: 'domcontentloaded' })
    await page.getByText('Artisan / Auto-entrepreneur').click()

    // SIRET input should be present (font-mono tracking-wider)
    const siretInput = page.locator('input.font-mono')
    await expect(siretInput).toBeVisible({ timeout: 10000 })
  })

  test('step 1 validation rejects empty form', async ({ page }) => {
    await page.goto('/pro/register', { waitUntil: 'domcontentloaded' })
    await page.getByText('Artisan / Auto-entrepreneur').click()

    // Wait for form to render
    await expect(page.locator('input[placeholder="Jean"]')).toBeVisible({ timeout: 10000 })

    // Submit without filling anything — click the submit button
    // The form has a submit button at the bottom of step 1
    const submitBtn = page.locator('button[type="submit"]')
    await submitBtn.click()

    // Error message should appear (red background div)
    const errorDiv = page.locator('.bg-red-50.text-red-600')
    await expect(errorDiv).toBeVisible({ timeout: 5000 })
  })

  test('password fields are present with validation', async ({ page }) => {
    await page.goto('/pro/register', { waitUntil: 'domcontentloaded' })
    await page.getByText('Artisan / Auto-entrepreneur').click()

    // Password inputs should exist (type="password")
    const passwordInputs = page.locator('input[type="password"]')
    await expect(passwordInputs.first()).toBeVisible({ timeout: 10000 })
    expect(await passwordInputs.count()).toBe(2) // password + confirm
  })

  test('trade/metier selection grid is visible', async ({ page }) => {
    await page.goto('/pro/register', { waitUntil: 'domcontentloaded' })
    await page.getByText('Artisan / Auto-entrepreneur').click()

    // Trade emoji icons should be visible (plomberie 🔧, electricite ⚡, etc.)
    // The grid contains 24 trades as buttons
    await expect(page.locator('input[placeholder="Jean"]')).toBeVisible({ timeout: 10000 })

    // Scroll down to see the trades section — look for the trades label
    const tradesSection = page.getByText('Vos métiers')
    // The section may use i18n key, so fallback to checking for trade emojis
    const tradeButtons = page.locator('button:has-text("⚡"), button:has-text("🔧"), button:has-text("🎨")')
    const count = await tradeButtons.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('/pro/dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/pro/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForURL('**/auth/login**', { timeout: 10000 })
    expect(page.url()).toContain('/auth/login')
  })

  test('/client/dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/client/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForURL('**/auth/login**', { timeout: 10000 })
    expect(page.url()).toContain('/auth/login')
  })

  test('/syndic/dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/syndic/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForURL('**/auth/login**', { timeout: 10000 })
    expect(page.url()).toContain('/auth/login')
  })
})
