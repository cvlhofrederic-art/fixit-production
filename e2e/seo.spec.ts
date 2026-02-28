import { test, expect } from '@playwright/test'

test.describe('SEO', () => {
  test('/sitemap.xml returns valid XML', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)

    const contentType = response.headers()['content-type'] || ''
    expect(contentType).toMatch(/xml/)

    const body = await response.text()
    expect(body).toContain('<?xml')
    expect(body).toContain('<urlset')
    expect(body).toContain('<url>')
    expect(body).toContain('<loc>')
  })

  test('/robots.txt is accessible and well-formed', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)

    const body = await response.text()
    expect(body).toContain('User-Agent')
    expect(body).toContain('Allow')
    expect(body).toContain('Disallow')
    expect(body).toContain('Sitemap')
  })

  test('homepage has essential meta tags', async ({ page }) => {
    await page.goto('/')

    // <html lang="fr">
    const lang = await page.locator('html').getAttribute('lang')
    expect(lang).toBe('fr')

    // <title> contains VITFIX
    const title = await page.title()
    expect(title).toContain('VITFIX')

    // meta description
    const metaDesc = page.locator('meta[name="description"]')
    await expect(metaDesc).toHaveAttribute('content', /artisan/)

    // Open Graph tags
    const ogTitle = page.locator('meta[property="og:title"]')
    await expect(ogTitle).toHaveAttribute('content', /VITFIX/)

    const ogDesc = page.locator('meta[property="og:description"]')
    await expect(ogDesc).toHaveAttribute('content', /.+/)

    const ogType = page.locator('meta[property="og:type"]')
    await expect(ogType).toHaveAttribute('content', 'website')

    const ogLocale = page.locator('meta[property="og:locale"]')
    await expect(ogLocale).toHaveAttribute('content', 'fr_FR')
  })

  test('homepage has JSON-LD structured data', async ({ page }) => {
    await page.goto('/')

    // Extract all JSON-LD scripts
    const jsonLdScripts = page.locator('script[type="application/ld+json"]')
    const count = await jsonLdScripts.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // Parse and verify the LocalBusiness schema
    const allJsonLd: any[] = []
    for (let i = 0; i < count; i++) {
      const content = await jsonLdScripts.nth(i).textContent()
      expect(content).toBeTruthy()
      const parsed = JSON.parse(content!)
      allJsonLd.push(parsed)
    }

    // Find the LocalBusiness entry
    const localBusiness = allJsonLd.find((d) => d['@type'] === 'LocalBusiness')
    expect(localBusiness).toBeTruthy()
    expect(localBusiness['@context']).toBe('https://schema.org')
    expect(localBusiness.name).toBe('VITFIX')
    expect(localBusiness.url).toBe('https://vitfix.fr')

    // Find the WebSite entry with SearchAction
    const webSite = allJsonLd.find((d) => d['@type'] === 'WebSite')
    expect(webSite).toBeTruthy()
    expect(webSite.potentialAction).toBeTruthy()
    expect(webSite.potentialAction['@type']).toBe('SearchAction')
  })

  test('homepage has canonical-friendly structure', async ({ page }) => {
    await page.goto('/')

    // Verify the page has a main landmark
    const main = page.locator('main[id="main-content"]')
    await expect(main).toBeAttached()

    // Verify skip-to-content link exists for accessibility
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeAttached()
  })
})
