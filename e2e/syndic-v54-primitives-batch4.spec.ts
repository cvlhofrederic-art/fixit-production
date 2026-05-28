import { test, expect, type Page } from '@playwright/test'

/**
 * Showcase Panel / KPI(+Grid) / Empty / Alert / PageHead (batch 4).
 * Navigation /fr/ explicite + domcontentloaded + waitFor (cf. batches précédents).
 */

test.describe.configure({ timeout: 120_000 })

async function gotoPrimitive(page: Page, slug: string) {
  await page.goto(`/fr/syndic/dev/primitives/${slug}/`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
}

test.describe('Syndic v54 — Panel showcase', () => {
  test.beforeEach(({ page }) => gotoPrimitive(page, 'panel'))

  test('panel: white bg + 1px border + radius 14px', async ({ page }) => {
    const panel = page.getByTestId('panel-demo').locator('> div').first()
    const { bg, radius, borderW } = await panel.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, borderW: cs.borderTopWidth }
    })
    expect(bg).toBe('rgb(255, 255, 255)')
    expect(radius).toBe('14px')
    expect(borderW).toBe('1px')
  })
})

test.describe('Syndic v54 — KPI showcase', () => {
  test.beforeEach(({ page }) => gotoPrimitive(page, 'kpi'))

  test('KPIGrid is an auto-fit multi-column grid', async ({ page }) => {
    const grid = page.getByTestId('kpi-grid-demo').locator('> div').first()
    const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    expect(cols.split(' ').length).toBeGreaterThanOrEqual(2)
  })

  test('sage accent KPI has a 3px sage-500 top border', async ({ page }) => {
    const sageKpi = page.getByTestId('kpi-grid-demo').locator('> div > div').nth(1)
    const { color, width } = await sageKpi.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { color: cs.borderTopColor, width: cs.borderTopWidth }
    })
    expect(color).toBe('rgb(63, 122, 96)') // sage-500 #3F7A60
    expect(width).toBe('3px')
  })

  test('currency (cur) resolves to gold-700 italic', async ({ page }) => {
    const cur = page.getByTestId('kpi-props').getByText('€', { exact: true })
    const { color, style } = await cur.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { color: cs.color, style: cs.fontStyle }
    })
    expect(color).toBe('rgb(132, 104, 56)') // gold-700 #846838
    expect(style).toBe('italic')
  })
})

test.describe('Syndic v54 — Empty showcase', () => {
  test.beforeEach(({ page }) => gotoPrimitive(page, 'empty'))

  test('renders the 12 bundle illustrations (each an injected SVG)', async ({ page }) => {
    const svgs = page.getByTestId('empty-illus-grid').locator('svg')
    expect(await svgs.count()).toBe(12)
  })

  test('badge fallback renders a badge-circle icon', async ({ page }) => {
    await expect(page.getByTestId('empty-badge').locator('svg').first()).toBeVisible()
  })
})

test.describe('Syndic v54 — Alert showcase', () => {
  test.beforeEach(({ page }) => gotoPrimitive(page, 'alert'))

  test('the 4 kinds resolve to 4 distinct backgrounds (amber default first)', async ({ page }) => {
    const bgs = await page
      .getByTestId('alert-demo')
      .locator('> div')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor))
    expect(bgs.length).toBe(4)
    expect(new Set(bgs).size).toBe(4)
    expect(bgs[0]).toBe('rgb(248, 239, 218)') // amber-50 #F8EFDA
  })
})

test.describe('Syndic v54 — PageHead showcase', () => {
  test.beforeEach(({ page }) => gotoPrimitive(page, 'page-head'))

  test('eyebrow is gold-700 + uppercase', async ({ page }) => {
    const eye = page.getByText('Gestão · Condomínio')
    const { color, transform } = await eye.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { color: cs.color, transform: cs.textTransform }
    })
    expect(color).toBe('rgb(132, 104, 56)') // gold-700 #846838
    expect(transform).toBe('uppercase')
  })
})
