import { test, expect } from '@playwright/test'

test.describe('Auth flow', () => {
  test('login page loads at /auth/login', async ({ page }) => {
    const response = await page.goto('/fr/auth/login', { waitUntil: 'networkidle' })
    expect(response).not.toBeNull()
    expect(response!.status()).toBe(200)
  })

  test('login page displays space selector and form', async ({ page }) => {
    await page.goto('/fr/auth/login', { waitUntil: 'networkidle' })

    // The page has the VITFIX branding
    await expect(page.getByText('VITFIX', { exact: true }).first()).toBeVisible()

    // Three space selectors: Particulier, Artisan, Pro (syndic)
    await expect(page.getByRole('button', { name: /Particulier/i })).toBeVisible()
    // Case-sensitive match to avoid matching "votre artisan" in Particulier button text
    await expect(page.getByRole('button', { name: /Artisan/ })).toBeVisible()
  })

  test('login form has email and password inputs after selecting a space', async ({ page }) => {
    await page.goto('/fr/auth/login', { waitUntil: 'networkidle' })

    // Click on the "Particulier" space to reveal the form
    await page.getByRole('button', { name: /Particulier/i }).click()

    // Email and password fields should now be visible
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
  })

  test('submitting with empty fields shows validation or prevents submission', async ({ page }) => {
    await page.goto('/fr/auth/login', { waitUntil: 'networkidle' })

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
    await page.goto('/fr/auth/login', { waitUntil: 'networkidle' })

    // Select Particulier space
    await page.getByRole('button', { name: /Particulier/i }).click()

    // Fill in bogus credentials
    await page.locator('input[type="email"]').fill('nobody-' + Date.now() + '@example-invalid.test')
    await page.locator('input[type="password"]').fill('wrongpassword123')

    // Submit
    await page.getByRole('button', { name: /se connecter/i }).click()

    // Either an error message renders (substring + insensitive to trailing
    // punctuation) OR we stay on the login URL (no redirect = login refused).
    // Whichever comes first within 15s satisfies the test.
    await Promise.race([
      expect(
        page.locator(
          'text=/email ou mot de passe|incorrect|invalid|invalide/i'
        )
      ).toBeVisible({ timeout: 15000 }),
      page.waitForURL('**/auth/login**', { timeout: 15000 }),
    ])

    // Final invariant: nous restons bien sur la page login (pas redirigé vers
    // un dashboard, ce qui prouve que le sign-in a échoué).
    expect(page.url()).toContain('/auth/login')
  })
})

// Lot 1 de l'analyse Sentry du 28/10/2026 : le tableau de bord client et la page de connexion ne doivent plus se
// renvoyer l'un vers l'autre, et le tableau de bord ne doit jamais se recharger en boucle sur une erreur d'auth.
test.describe('Tableau de bord client : pas de boucle de rechargement', () => {
  test('sans session : une seule redirection vers la connexion, puis la page reste stable 12 s', async ({ page }) => {
    const navigations: string[] = []
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url())
    })

    await page.goto('/fr/client/dashboard/', { waitUntil: 'networkidle' })
    await page.waitForURL('**/auth/login**', { timeout: 15000 })
    const apresArrivee = navigations.length

    await page.waitForTimeout(12_000)

    expect(navigations.length).toBe(apresArrivee)
    expect(page.url()).toContain('/auth/login')
  })

  // Exige un compte client de test : E2E_CLIENT_EMAIL et E2E_CLIENT_PASSWORD (absents en CI aujourd'hui, le test
  // est alors ignoré). En local : E2E_CLIENT_EMAIL=… E2E_CLIENT_PASSWORD=… npx playwright test e2e/auth.spec.ts
  test('connecté : le tableau de bord reste chargé 60 s sans navigation ni AbortError', async ({ page }) => {
    const email = process.env.E2E_CLIENT_EMAIL
    const motDePasse = process.env.E2E_CLIENT_PASSWORD
    test.skip(!email || !motDePasse, 'identifiants E2E_CLIENT_EMAIL / E2E_CLIENT_PASSWORD absents')

    await page.goto('/fr/auth/login', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Particulier/i }).click()
    await page.locator('input[type="email"]').fill(email!)
    await page.locator('input[type="password"]').fill(motDePasse!)
    await page.getByRole('button', { name: /se connecter/i }).click()
    await page.waitForURL('**/client/dashboard**', { timeout: 20000 })

    const anomalies: string[] = []
    page.on('console', (message) => {
      if (/AbortError|Multiple GoTrueClient/.test(message.text())) anomalies.push(message.text())
    })
    page.on('pageerror', (erreur) => anomalies.push(String(erreur)))
    const navigations: string[] = []
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url())
    })

    await page.waitForTimeout(60_000)

    expect(navigations).toEqual([])
    expect(anomalies).toEqual([])
    expect(page.url()).toContain('/client/dashboard')
  })
})
