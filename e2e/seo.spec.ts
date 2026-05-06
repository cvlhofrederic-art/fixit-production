import { test, expect } from '@playwright/test'

test.describe('SEO', () => {
  test('/sitemap.xml returns valid sitemap index XML', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    // Dynamic sitemap may 404 in CI if build lacks full env — skip content checks
    test.skip(response.status() === 404, 'Sitemap not available in CI build')
    expect(response.status()).toBe(200)

    const contentType = response.headers()['content-type'] || ''
    expect(contentType).toMatch(/xml/)

    const body = await response.text()
    expect(body).toContain('<?xml')
    // /sitemap.xml est l'INDEX qui liste les sub-sitemaps (pas un urlset).
    expect(body).toContain('<sitemapindex')
    expect(body).toContain('<sitemap>')
    expect(body).toContain('<loc>')
  })

  test('/sitemap/0.xml returns valid urlset XML', async ({ request }) => {
    const response = await request.get('/sitemap/0.xml')
    test.skip(response.status() === 404, 'Sub-sitemap not available in CI build')
    expect(response.status()).toBe(200)

    const contentType = response.headers()['content-type'] || ''
    expect(contentType).toMatch(/xml/)

    const body = await response.text()
    expect(body).toContain('<?xml')
    expect(body).toContain('<urlset')
    expect(body).toContain('<url>')
    expect(body).toContain('<loc>')
  })

  test('/sitemap/{invalid}.xml returns 404', async ({ request }) => {
    // Garde sécurité parseSitemapId : rejette ambiguïtés canoniques.
    const responses = await Promise.all([
      request.get('/sitemap/5.xml'),
      request.get('/sitemap/0.xml.xml'),
      request.get('/sitemap/0abc'),
    ])
    for (const r of responses) {
      expect(r.status()).toBe(404)
    }
  })

  test('/robots.txt is accessible and well-formed', async ({ request }) => {
    const response = await request.get('/robots.txt')
    test.skip(response.status() === 404, 'Robots.txt not available in CI build')
    expect(response.status()).toBe(200)

    const body = await response.text()
    expect(body).toContain('User-Agent')
    expect(body).toContain('Allow')
    expect(body).toContain('Disallow')
    expect(body).toContain('Sitemap')
  })

  test('homepage has essential meta tags', async ({ page }) => {
    await page.goto('/fr/', { waitUntil: 'networkidle' })

    // <html lang="fr">
    const lang = await page.locator('html').getAttribute('lang')
    expect(lang).toBe('fr')

    // <title> contains Vitfix (case-insensitive)
    const title = await page.title()
    expect(title.toLowerCase()).toContain('vitfix')

    // meta description
    const metaDesc = page.locator('meta[name="description"]')
    await expect(metaDesc).toHaveAttribute('content', /artisan/)

    // Open Graph tags
    const ogTitle = page.locator('meta[property="og:title"]')
    await expect(ogTitle).toHaveAttribute('content', /VITFIX|Vitfix/i)

    const ogDesc = page.locator('meta[property="og:description"]')
    await expect(ogDesc).toHaveAttribute('content', /.+/)

    const ogType = page.locator('meta[property="og:type"]')
    await expect(ogType).toHaveAttribute('content', 'website')

    const ogLocale = page.locator('meta[property="og:locale"]')
    await expect(ogLocale).toHaveAttribute('content', 'fr_FR')
  })

  test('homepage has JSON-LD structured data', async ({ page }) => {
    await page.goto('/fr/', { waitUntil: 'networkidle' })

    // Extract all JSON-LD scripts
    const jsonLdScripts = page.locator('script[type="application/ld+json"]')
    const count = await jsonLdScripts.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // Parse all JSON-LD scripts, flattening @graph arrays
    const allJsonLd: any[] = []
    for (let i = 0; i < count; i++) {
      const content = await jsonLdScripts.nth(i).textContent()
      expect(content).toBeTruthy()
      const parsed = JSON.parse(content!)
      if (Array.isArray(parsed)) {
        allJsonLd.push(...parsed)
      } else if (parsed['@graph']) {
        allJsonLd.push(...parsed['@graph'])
      } else {
        allJsonLd.push(parsed)
      }
    }

    // Find the LocalBusiness or HomeAndConstructionBusiness entry.
    // @type peut être string OU array (Organization + HomeAndConstructionBusiness).
    const matchesType = (typeField: unknown, target: string): boolean =>
      typeField === target || (Array.isArray(typeField) && typeField.includes(target))
    const localBusiness = allJsonLd.find((d) =>
      matchesType(d['@type'], 'LocalBusiness') || matchesType(d['@type'], 'HomeAndConstructionBusiness')
    )
    expect(localBusiness).toBeTruthy()
    expect(localBusiness['@context']).toBe('https://schema.org')
    expect(localBusiness.name).toContain('VITFIX')
    expect(localBusiness.url).toContain('vitfix')

    // Find the WebSite entry with SearchAction (if present)
    const webSite = allJsonLd.find((d) => d['@type'] === 'WebSite')
    if (webSite) {
      expect(webSite.potentialAction).toBeTruthy()
      expect(webSite.potentialAction['@type']).toBe('SearchAction')
    }
  })

  test('SEO public routes return matching Cache-Control on GET and HEAD', async ({ request }) => {
    // Bots SEO (Googlebot, Bingbot, GPTBot) font parfois des HEAD pour vérifier
    // la fraîcheur. GET et HEAD doivent retourner le même Cache-Control public.
    const url = '/pt/servicos/canalizador-porto/'
    const [getRes, headRes] = await Promise.all([
      request.get(url),
      request.fetch(url, { method: 'HEAD' }),
    ])
    test.skip(getRes.status() === 404 || headRes.status() === 404, 'SEO route not available in CI build')
    expect(getRes.status()).toBe(200)
    expect(headRes.status()).toBe(200)

    const getCache = getRes.headers()['cache-control'] || ''
    const headCache = headRes.headers()['cache-control'] || ''
    expect(getCache).toMatch(/public/)
    expect(getCache).toMatch(/s-maxage=3600/)
    expect(headCache).toBe(getCache)
  })

  test('homepage has canonical-friendly structure', async ({ page }) => {
    await page.goto('/fr/', { waitUntil: 'networkidle' })

    // Verify the page has a main landmark
    const main = page.locator('main[id="main-content"]')
    await expect(main).toBeAttached()

    // Verify skip-to-content link exists for accessibility
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeAttached()
  })
})
