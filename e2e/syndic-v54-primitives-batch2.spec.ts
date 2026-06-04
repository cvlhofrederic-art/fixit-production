import { test, expect, type Page } from '@playwright/test'

/**
 * Showcase Pill / Skeleton / Pulse (batch 2 étape b).
 * Navigation /fr/ explicite + domcontentloaded + waitFor (cf. spec tokens).
 * Sandbox gated localhost-only.
 */

test.describe.configure({ timeout: 120_000 })

async function gotoPrimitive(page: Page, slug: string) {
  await page.goto(`/fr/syndic/dev/primitives/${slug}/`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('#syndic-dashboard-v54').waitFor({ state: 'attached', timeout: 60_000 })
}

test.describe('Syndic v54 — Pill showcase', () => {
  test.beforeEach(({ page }) => gotoPrimitive(page, 'pill'))

  test('renders the 6 kinds with-dot and without-dot rows', async ({ page }) => {
    // 6 (avec dot) + 6 (noDot) + 3 (contexte) = 15 pills
    const pills = page.locator('#syndic-dashboard-v54 span').filter({ hasText: /sage|gold|amber|rust|dark|défaut|Operação|Sincronizado|pendentes/ })
    expect(await pills.count()).toBeGreaterThanOrEqual(12)
  })

  test('sage pill resolves to the sage tint tokens', async ({ page }) => {
    const sage = page.getByText('sage', { exact: true }).first()
    const { bg, color } = await sage.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { bg: cs.backgroundColor, color: cs.color }
    })
    // sage-50 #ECF2EC → rgb(236, 242, 236) ; sage-700 #2F5C49 → rgb(47, 92, 73)
    expect(bg).toBe('rgb(236, 242, 236)')
    expect(color).toBe('rgb(47, 92, 73)')
  })

  test('noDot pill hides the ::before dot (display none)', async ({ page }) => {
    // Bloc "Avec point" : sage #0 a un ::before visible. Bloc "Sans point" :
    // sage #1 a son ::before en display:none.
    const withDotSage = page.locator('#syndic-dashboard-v54 span', { hasText: /^sage$/ }).nth(0)
    const noDotSage = page.locator('#syndic-dashboard-v54 span', { hasText: /^sage$/ }).nth(1)
    const withDotDisplay = await withDotSage.evaluate((el) => getComputedStyle(el, '::before').display)
    const noDotDisplay = await noDotSage.evaluate((el) => getComputedStyle(el, '::before').display)
    expect(withDotDisplay).not.toBe('none')
    expect(noDotDisplay).toBe('none')
  })

  test('dark kind dot is visible — ::before resolves to gold-400 on navy-900, not navy', async ({ page }) => {
    // .dark : fond navy-900, texte gold-400 → le dot ::before (currentColor) doit
    // être gold-400 (visible), pas navy (invisible sur navy).
    const darkPill = page.locator('#syndic-dashboard-v54 span', { hasText: /^dark$/ }).first()
    const dotColor = await darkPill.evaluate((el) => getComputedStyle(el, '::before').backgroundColor)
    expect(dotColor).toBe('rgb(217, 188, 146)') // gold-400 #D9BC92
  })
})

test.describe('Syndic v54 — Skeleton showcase', () => {
  test.beforeEach(({ page }) => gotoPrimitive(page, 'skeleton'))

  test('renders base bars + card/row/kpi containers', async ({ page }) => {
    const bars = page.locator('#syndic-dashboard-v54 span[aria-hidden="true"]')
    expect(await bars.count()).toBeGreaterThanOrEqual(6)
  })

  test('base skeleton bar has the shimmer animation', async ({ page }) => {
    const first = page.getByTestId('skeleton-bars').locator('> span').first()
    const animName = await first.evaluate((el) => getComputedStyle(el).animationName)
    expect(animName).not.toBe('none')
  })

  test('card container resolves to white bg + 1px line border + radius 10px', async ({ page }) => {
    const card = page.getByTestId('skeleton-card')
    const { bg, borderW, radius } = await card.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { bg: cs.backgroundColor, borderW: cs.borderTopWidth, radius: cs.borderTopLeftRadius }
    })
    expect(bg).toBe('rgb(255, 255, 255)') // #fff
    expect(borderW).toBe('1px')
    expect(radius).toBe('10px') // --v54-r-md
  })

  test('kpi forces its descendant bars to display:block', async ({ page }) => {
    const innerBar = page.getByTestId('skeleton-kpi').locator('> span').first()
    const display = await innerBar.evaluate((el) => getComputedStyle(el).display)
    expect(display).toBe('block')
  })
})

test.describe('Syndic v54 — Pulse showcase', () => {
  test.beforeEach(({ page }) => gotoPrimitive(page, 'pulse'))

  test('renders the pulse dot 7×7 with red background', async ({ page }) => {
    const pulse = page.locator('#syndic-dashboard-v54 span[aria-hidden="true"]').first()
    const { w, h, bg } = await pulse.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { w: cs.width, h: cs.height, bg: cs.backgroundColor }
    })
    expect(w).toBe('7px')
    expect(h).toBe('7px')
    expect(bg).toBe('rgb(239, 68, 68)') // #ef4444
  })

  test('pulse has the notifsDotPulse animation', async ({ page }) => {
    const pulse = page.locator('#syndic-dashboard-v54 span[aria-hidden="true"]').first()
    const animName = await pulse.evaluate((el) => getComputedStyle(el).animationName)
    expect(animName).not.toBe('none')
  })
})
