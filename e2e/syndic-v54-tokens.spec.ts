import { test, expect, devices } from '@playwright/test'

/**
 * Visual regression + responsive checks for the syndic v54 tokens sandbox.
 *
 * Cible : http://localhost:3000/syndic/dev/tokens (gated `notFound()` en prod —
 * ces tests ne tournent qu'en CI preview / dev local).
 *
 * Couvre :
 * - Caveat 2 Claude Chat : viewport mobile 375 doit rebasculer en 1 col
 * - Caveat 1 Claude Chat : Header marketing public DOIT être absent
 * - Tokens CSS scopés sous #syndic-dashboard-v54 (G1 garde-fou)
 */

test.describe('Syndic v54 — Tokens sandbox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/syndic/dev/tokens/', { waitUntil: 'networkidle' })
  })

  test('namespace wrapper #syndic-dashboard-v54 is rendered', async ({ page }) => {
    const wrapper = page.locator('#syndic-dashboard-v54')
    await expect(wrapper).toBeVisible()
  })

  test('public marketing Header is NOT rendered (Caveat 1)', async ({ page }) => {
    // Le Header public du shell parent contient le logo "VITFIX" + nav
    // "Simulateur de devis / Se connecter / Trouver un artisan". Aucun de ces
    // textes ne doit apparaître sur la sandbox v54.
    const header = page.locator('header')
    await expect(header).toHaveCount(0)
    await expect(page.getByText('Trouver un artisan', { exact: false })).toHaveCount(0)
  })

  test('CSS variables --v54-* resolve to exact hex from V5.7 bundle', async ({ page }) => {
    const tokens = await page.evaluate(() => {
      const root = document.getElementById('syndic-dashboard-v54')
      if (!root) return null
      const cs = getComputedStyle(root)
      return {
        navy900: cs.getPropertyValue('--v54-navy-900').trim(),
        gold500: cs.getPropertyValue('--v54-gold-500').trim(),
        sage700: cs.getPropertyValue('--v54-sage-700').trim(),
        rust500: cs.getPropertyValue('--v54-rust-500').trim(),
        cream: cs.getPropertyValue('--v54-cream').trim(),
      }
    })
    expect(tokens?.navy900.toLowerCase()).toBe('#0b1828')
    expect(tokens?.gold500.toLowerCase()).toBe('#c9a574')
    expect(tokens?.sage700.toLowerCase()).toBe('#2f5c49')
    expect(tokens?.rust500.toLowerCase()).toBe('#b65a36')
    expect(tokens?.cream.toLowerCase()).toBe('#f4efe4')
  })

  test('next/font/local exposes --v54-font-* with v54-prefixed family names', async ({ page }) => {
    const fonts = await page.evaluate(() => {
      const root = document.getElementById('syndic-dashboard-v54')
      if (!root) return null
      const cs = getComputedStyle(root)
      return {
        sans: cs.getPropertyValue('--v54-font-sans').trim(),
        serif: cs.getPropertyValue('--v54-font-serif').trim(),
        mono: cs.getPropertyValue('--v54-font-mono').trim(),
      }
    })
    expect(fonts?.sans).toContain('v54Manrope')
    expect(fonts?.serif).toContain('v54Cormorant')
    expect(fonts?.mono).toContain('v54JetBrainsMono')
  })
})

test.describe('Syndic v54 — Mobile 375 responsive (Caveat 2)', () => {
  test.use({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 } })

  test('viewport 375 collapses swatches grid to 1 column', async ({ page }) => {
    await page.goto('/syndic/dev/tokens/', { waitUntil: 'networkidle' })

    // La grille des swatches utilise auto-fill minmax(180px, 1fr) — à 375px
    // de viewport il ne reste qu'une colonne au plus (180 + gap + paddings >
    // 375/2 = 187.5).
    const swatchesGrid = page
      .locator('#syndic-dashboard-v54 section')
      .first()
      .locator('> div')
      .first()
    const cols = await swatchesGrid.evaluate((el) => {
      const cs = getComputedStyle(el)
      return cs.gridTemplateColumns.split(' ').length
    })
    expect(cols).toBe(1)
  })

  test('page screenshot at 375×812 is archived as artifact', async ({ page }, testInfo) => {
    await page.goto('/syndic/dev/tokens/', { waitUntil: 'networkidle' })
    const buf = await page.screenshot({ fullPage: true })
    await testInfo.attach('tokens-375x812', { body: buf, contentType: 'image/png' })
  })
})

test.describe('Syndic v54 — Desktop 1440 baseline', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('page screenshot at 1440×900 is archived as artifact', async ({ page }, testInfo) => {
    await page.goto('/syndic/dev/tokens/', { waitUntil: 'networkidle' })
    const buf = await page.screenshot({ fullPage: true })
    await testInfo.attach('tokens-1440x900', { body: buf, contentType: 'image/png' })
  })
})
