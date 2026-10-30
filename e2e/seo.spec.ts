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

    // <html lang="fr-FR"> (BCP 47 régional — cf. components/common/CoquilleRacine.tsx pour la politique)
    const lang = await page.locator('html').getAttribute('lang')
    expect(lang).toBe('fr-FR')

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
    // Playwright vise next start, qui sert l'en-tête du middleware. Sur le Worker, la page vient du cache des pages
    // pré-rendues (HIT, contrôlé par le smoke test du déploiement) et OpenNext recalcule l'en-tête : s-maxage décompté
    // depuis le build, stale-while-revalidate=2592000 (open-next.config.ts).
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

  test('accueils et pages hors préfixes SEO : Cache-Control private, no-store, comme avant le rendu statique', async ({ request }) => {
    // Pages pré-rendues : sans l'en-tête du middleware (CACHE_CONTROL_PRIVE), Next leur enverrait s-maxage=31536000.
    for (const chemin of ['/pt/', '/fr/', '/en/', '/nl/', '/es/', '/en/plumber-porto/', '/fr/simulateur-devis/marseille/']) {
      const reponse = await request.get(chemin, { maxRedirects: 0 })
      expect(reponse.status(), chemin).toBe(200)
      const cacheControl = reponse.headers()['cache-control'] || ''
      expect(cacheControl, chemin).toContain('private')
      expect(cacheControl, chemin).toContain('no-store')
    }
  })

  test('URL inconnue : 404 HTML complète, rendue côté serveur dans la langue de l’URL', async ({ request }) => {
    // Plusieurs layouts racine (un par langue, plus app/(commun)) : les URL sans route passent par
    // app/global-not-found.tsx. Une route fourre-tout qui lève notFound() ne rendrait côté serveur qu'une coquille
    // <html id="__next_error__"> vide, que ce test lit sans JavaScript.
    // La langue du texte et des métadonnées vient du cookie locale : le middleware le réécrit quand il diffère de la langue
    // de l'URL, et Next expose ce cookie à cookies() dans la même requête (en-tête x-middleware-set-cookie).
    const cas = [
      ['/pt/vitfix-test-inexistant-404/', 'pt-PT', 'Página não encontrada'],
      ['/fr/vitfix-test-inexistant-404/', 'fr-FR', 'Page non trouvée'],
      ['/pt/perto-de-mim/vitfix-test-inexistant-404/', 'pt-PT', 'Página não encontrada'],
    ] as const
    for (const [chemin, lang, titre] of cas) {
      const reponse = await request.get(chemin)
      expect(reponse.status(), chemin).toBe(404)
      const html = await reponse.text()
      expect(html, chemin).not.toContain('id="__next_error__"')
      expect(html, chemin).toContain(`<html lang="${lang}"`)
      expect(html, chemin).toMatch(new RegExp(`<h1[^>]*>${titre}</h1>`))
      // Balise des métadonnées de app/global-not-found.tsx (ROBOTS_404). Next ajoute en plus « noindex » seul à toute 404.
      expect(html, chemin).toContain('<meta name="robots" content="noindex, nofollow"/>')
    }
  })

  test('depuis la 404, « Voltar ao início » affiche l’accueil (rechargement complet entre layouts racine)', async ({ page }) => {
    // La 404 (app/global-not-found.tsx) et /pt/ n'ont pas le même layout racine : Next recharge la page. Avec un layout
    // racine commun, la 404 restait affichée sous la nouvelle URL (essai du 30/10/2026). Cookies refusés d'avance : le
    // bandeau de consentement n'apparaît pas.
    await page.addInitScript(() => {
      const refus = { performance: false, personalization: false, advertising: false, date: new Date().toISOString() }
      localStorage.setItem('vitfix_cookie_consent', JSON.stringify(refus))
    })
    await page.goto('/pt/vitfix-test-inexistant-404/')
    const titre404 = page.getByRole('heading', { level: 1, name: 'Página não encontrada' })
    await expect(titre404).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao início' }).click()
    await expect(page).toHaveURL(new RegExp('/pt/$'))
    await expect(titre404).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-PT')
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
