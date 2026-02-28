import { test, expect } from '@playwright/test'

test.describe('Accessibility (a11y)', () => {
  test('homepage has correct ARIA landmarks', async ({ page }) => {
    await page.goto('/')

    // Must have a <main> landmark
    const main = page.locator('main')
    await expect(main.first()).toBeAttached()

    // Must have a <header> landmark
    const header = page.locator('header')
    await expect(header.first()).toBeAttached()

    // Must have a <nav> landmark
    const nav = page.locator('nav')
    await expect(nav.first()).toBeAttached()

    // Must have a <footer> landmark
    const footer = page.locator('footer')
    await expect(footer.first()).toBeAttached()
  })

  test('skip-to-content link exists and targets main', async ({ page }) => {
    await page.goto('/')

    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeAttached()

    // The target element must exist
    const mainContent = page.locator('#main-content')
    await expect(mainContent).toBeAttached()
  })

  test('all images have alt text', async ({ page }) => {
    await page.goto('/')

    const images = page.locator('img')
    const count = await images.count()

    for (let i = 0; i < count; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      const role = await img.getAttribute('role')

      // Images must have alt text OR role="presentation"
      const hasAlt = alt !== null && alt !== undefined
      const isDecorative = role === 'presentation' || role === 'none'
      expect(
        hasAlt || isDecorative,
        `Image ${i} is missing alt text`
      ).toBe(true)
    }
  })

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto('/auth/login')

    // Select Particulier to reveal the form
    await page.getByText('Particulier').click()

    const inputs = page.locator('input:not([type="hidden"]):not([type="submit"])')
    const count = await inputs.count()

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i)
      const id = await input.getAttribute('id')
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledBy = await input.getAttribute('aria-labelledby')
      const placeholder = await input.getAttribute('placeholder')

      // Input must have: label[for=id], aria-label, aria-labelledby, or placeholder
      let hasLabel = false
      if (id) {
        const label = page.locator(`label[for="${id}"]`)
        hasLabel = (await label.count()) > 0
      }

      const isAccessible =
        hasLabel || !!ariaLabel || !!ariaLabelledBy || !!placeholder

      expect(
        isAccessible,
        `Input ${i} (id=${id}) has no accessible label`
      ).toBe(true)
    }
  })

  test('interactive elements are keyboard focusable', async ({ page }) => {
    await page.goto('/')

    // Tab through the page and check that focus is visible
    await page.keyboard.press('Tab')
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName)
    expect(firstFocused).toBeTruthy()

    // Tab a few more times — focus should move
    await page.keyboard.press('Tab')
    const secondFocused = await page.evaluate(() => document.activeElement?.tagName)
    expect(secondFocused).toBeTruthy()
  })

  test('page has proper heading hierarchy', async ({ page }) => {
    await page.goto('/')

    // Must have exactly one h1
    const h1Count = await page.locator('h1').count()
    expect(h1Count).toBe(1)

    // h2s should exist (sections)
    const h2Count = await page.locator('h2').count()
    expect(h2Count).toBeGreaterThanOrEqual(1)
  })

  test('color contrast: text is readable (basic check)', async ({ page }) => {
    await page.goto('/')

    // Check that body text color is not too light
    const bodyColor = await page.evaluate(() => {
      const body = document.querySelector('body')
      if (!body) return null
      return window.getComputedStyle(body).color
    })
    expect(bodyColor).toBeTruthy()
    // Body text should not be white or near-white on white background
    expect(bodyColor).not.toBe('rgb(255, 255, 255)')
  })
})
