import { test, expect } from '@playwright/test'

test.describe('Auth flow', () => {
  test('login page loads at /auth/login', async ({ page }) => {
    const response = await page.goto('/auth/login')
    expect(response).not.toBeNull()
    expect(response!.status()).toBe(200)
  })

  test('login page displays space selector and form', async ({ page }) => {
    await page.goto('/auth/login')

    // The page has the VITFIX branding
    await expect(page.getByText('VITFIX', { exact: true }).first()).toBeVisible()

    // Three space selectors: Particulier, Artisan, Pro (syndic)
    await expect(page.getByRole('button', { name: /Particulier/i })).toBeVisible()
    // Case-sensitive match to avoid matching "votre artisan" in Particulier button text
    await expect(page.getByRole('button', { name: /Artisan/ })).toBeVisible()
  })

  test('login form has email and password inputs after selecting a space', async ({ page }) => {
    await page.goto('/auth/login')

    // Click on the "Particulier" space to reveal the form
    await page.getByRole('button', { name: /Particulier/i }).click()

    // Email and password fields should now be visible
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
  })

  test('submitting with empty fields shows validation or prevents submission', async ({ page }) => {
    await page.goto('/auth/login')

    // Select Particulier space to reveal the form
    await page.getByRole('button', { name: /Particulier/i }).click()

    // The email input has the required attribute; submitting empty should
    // trigger browser-native validation (the form won't actually submit).
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toHaveAttribute('required', '')

    // Try to submit the form with empty fields
    const submitButton = page.getByRole('button', { name: /se connecter/i })
    await expect(submitButton).toBeVisible()
    await submitButton.click()

    // The email field should be marked invalid by the browser (required + empty)
    const isInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    )
    expect(isInvalid).toBe(true)
  })

  test('submitting with invalid credentials shows error message', async ({ page }) => {
    await page.goto('/auth/login')

    // Select Particulier space
    await page.getByRole('button', { name: /Particulier/i }).click()

    // Fill in bogus credentials
    await page.locator('input[type="email"]').fill('nobody@example.com')
    await page.locator('input[type="password"]').fill('wrongpassword123')

    // Submit
    await page.getByRole('button', { name: /se connecter/i }).click()

    // Should display an error message
    const errorBox = page.locator('text=Email ou mot de passe incorrect')
    await expect(errorBox).toBeVisible({ timeout: 10000 })
  })
})
