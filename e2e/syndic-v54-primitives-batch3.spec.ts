import { test, expect, type Page } from '@playwright/test'

/**
 * Showcase Toggle / Field / FormRow / SegmentedControl (batch 3).
 * Navigation /fr/ explicite + domcontentloaded + waitFor (cf. batches 1-2).
 * Sandbox gated localhost-only.
 */

test.describe.configure({ timeout: 120_000 })

async function gotoPrimitive(page: Page, slug: string) {
  await page.goto(`/fr/syndic/dev/primitives/${slug}/`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
}

test.describe('Syndic v54 — Toggle showcase', () => {
  test.beforeEach(({ page }) => gotoPrimitive(page, 'toggle'))

  test('on track resolves to sage-500, off track to navy-100', async ({ page }) => {
    const on = page.getByTestId('tg-on').locator('label')
    const off = page.getByTestId('tg-off').locator('label')
    expect(await on.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(63, 122, 96)') // sage-500
    expect(await off.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(199, 208, 219)') // navy-100
  })

  test('disabled toggle has opacity 0.5 + disabled input', async ({ page }) => {
    const d = page.getByTestId('tg-disabled').locator('label')
    expect(await d.evaluate((el) => getComputedStyle(el).opacity)).toBe('0.5')
    expect(await d.locator('input').isDisabled()).toBe(true)
  })
})

test.describe('Syndic v54 — Field showcase', () => {
  test.beforeEach(({ page }) => gotoPrimitive(page, 'field'))

  test('clicking the label focuses the associated input (htmlFor↔id, anti-bug V5.2)', async ({ page }) => {
    await page.locator('label[for="cond-name"]').click()
    await expect(page.locator('#cond-name')).toBeFocused()
  })

  test('focus resolves the gold-500 border ring', async ({ page }) => {
    const input = page.locator('#cond-name')
    await input.focus()
    expect(await input.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(201, 165, 116)') // gold-500
  })

  test('suffix unit (€) renders inside the field', async ({ page }) => {
    const suffix = page.getByTestId('field-demo').locator('span', { hasText: '€' }).first()
    await expect(suffix).toBeVisible()
  })

  test('errored field exposes aria-invalid + rust-500 border', async ({ page }) => {
    const email = page.locator('#cond-email')
    expect(await email.getAttribute('aria-invalid')).toBe('true')
    expect(await email.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(182, 90, 54)') // rust-500
  })
})

test.describe('Syndic v54 — SegmentedControl showcase', () => {
  test.beforeEach(({ page }) => gotoPrimitive(page, 'segmented-control'))

  test('active segment resolves to navy-900 bg + gold-400 text', async ({ page }) => {
    const active = page.getByTestId('seg').locator('label[class*="active"]').first()
    const { bg, color } = await active.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { bg: cs.backgroundColor, color: cs.color }
    })
    expect(bg).toBe('rgb(11, 24, 40)') // navy-900
    expect(color).toBe('rgb(217, 188, 146)') // gold-400
  })

  test('renders a radiogroup with 3 native radios', async ({ page }) => {
    const group = page.getByTestId('seg').getByRole('radiogroup')
    await expect(group).toHaveAttribute('aria-label', /Dura/)
    expect(await group.locator('input[type="radio"]').count()).toBe(3)
  })

  test('selecting a segment checks the corresponding radio', async ({ page }) => {
    const seg = page.getByTestId('seg')
    await seg.locator('input[value="30"]').check()
    await expect(seg.locator('input[value="30"]')).toBeChecked()
    await expect(seg.locator('input[value="60"]')).not.toBeChecked()
  })
})

test.describe('Syndic v54 — FormRow showcase', () => {
  test.beforeEach(({ page }) => gotoPrimitive(page, 'form-row'))

  test('renders a 2-column grid', async ({ page }) => {
    const row = page.getByTestId('form-row-demo').locator('> div').first()
    const cols = await row.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    expect(cols.split(' ').length).toBe(2)
  })
})
