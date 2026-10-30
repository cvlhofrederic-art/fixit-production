// tests/seo/layouts-racine-statiques.test.tsx
//
// Rendu statique des pages SEO publiques : plus de app/layout.tsx. Chaque dossier de langue (app/{pt,fr,en,nl,es}) a
// son propre layout racine, sans cookies() ni headers(), et les pages communes servies par réécriture (auth, pro,
// client, contact…) gardent un layout racine dynamique dans app/(commun). La coquille HTML est la même partout
// (components/common/CoquilleRacine.tsx) : <html lang> BCP 47, JSON-LD WebSite + entité unique #business, lien
// d'évitement, Providers. Les URL sans route sont rendues par app/global-not-found.tsx (experimental.globalNotFound).
// Les routes SEO sont du SSG pur (cache OpenNext en lecture seule) ; les pages qui lisent l'URL, la date ou les cookies au
// rendu restent dynamiques. Après le build, scripts/seo/verifier-prerendu.mjs croise le prerender-manifest avec chaque
// page des sections (CI et déploiement).
import React from 'react'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Metadata } from 'next'
import type { Locale } from '@/lib/i18n/config'
import { CONTACT_EMAIL, PHONE_FR, PHONE_PT } from '@/lib/constants'
import { ENTITE_PT } from '@/lib/seo/entite-pt'
import { METADONNEES_PARTAGEES, metadonneesRacine } from '@/lib/seo/metadonnees-racine'
import { PLANCHERS, RENDUES_A_LA_DEMANDE, TEMOINS, pagesDesSections, verifierPrerendu } from '../../scripts/seo/verifier-prerendu.mjs'

// Coquille rendue côté serveur : composants client remplacés par des enveloppes vides, préchargement des polices neutralisé.
vi.mock('react-dom', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-dom')>()), preload: vi.fn() }))
vi.mock('@/components/common/Providers', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/components/common/ConditionalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/components/common/CookieConsent', () => ({ default: () => null }))
vi.mock('@/components/common/ConsentAnalytics', () => ({ default: () => null }))
vi.mock('@/components/common/WebVitalsReporter', () => ({ default: () => null }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...autres }: { href: string; children: React.ReactNode }) => <a href={href} {...autres}>{children}</a>,
}))

// Requête simulée pour le layout commun (en-tête x-locale du middleware, cookie locale).
const requete = vi.hoisted(() => ({ cookie: undefined as string | undefined, enTete: undefined as string | undefined }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (nom: string) => (nom === 'locale' && requete.cookie ? { name: 'locale', value: requete.cookie } : undefined) }),
  headers: async () => ({ get: (nom: string) => (nom === 'x-locale' ? (requete.enTete ?? null) : null) }),
}))

import CoquilleRacine from '@/components/common/CoquilleRacine'

const RACINE = process.cwd()
const lire = (...chemin: string[]) => readFileSync(join(RACINE, ...chemin), 'utf8')
const LOCALES = ['pt', 'fr', 'en', 'nl', 'es'] as const
type LocaleTestee = (typeof LOCALES)[number]
const API_DYNAMIQUES = /next\/headers|\bcookies\(|\bheaders\(/
// Commentaires retirés avant la recherche : ils citent cookies() et headers() pour expliquer leur absence.
const sansCommentaires = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

// Arborescence de app/ : chemins relatifs à la racine, séparateur « / », dossiers suffixés de « / ».
function arborescence(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier), { withFileTypes: true }).flatMap((entree) => {
    const chemin = `${dossier}/${entree.name}`
    return entree.isDirectory() ? [`${chemin}/`, ...arborescence(chemin)] : [chemin]
  })
}
const ARBRE_APP = arborescence('app')

// Fichiers que la lecture des sources autorise à forcer le rendu dynamique ou à lire les cookies et l'URL. Les pages
// rendues à la demande par un helper (getServerTranslation lit cookies()) n'y figurent pas : la liste complète des pages
// rendues à la demande est RENDUES_A_LA_DEMANDE, contrôlée après le build par scripts/seo/verifier-prerendu.mjs.
const SEGMENTS_FORCE_DYNAMIC: Record<string, string> = {
  'app/pt/pesquisar/layout.tsx': 'recherche PT (useSearchParams)',
  'app/fr/recherche/layout.tsx': 'recherche FR (useSearchParams)',
  'app/fr/reserver/layout.tsx': 'réservation (useSearchParams)',
  'app/pt/mercados/gerir/page.tsx': 'gestion du pedido par lien à jeton (useSearchParams)',
  'app/pt/mercados/publicar/page.tsx': 'date minimale du formulaire calculée au rendu',
}
// Pages qui lisent le cookie de langue (marchés FR) : dynamiques sans force-dynamic.
const PAGES_COOKIES = ['app/fr/marches/gerer/page.tsx', 'app/fr/marches/publier/page.tsx']
// Pages qui lisent l'URL, chacune sous un layout force-dynamic de la liste.
const PAGES_URL = ['app/fr/recherche/page.tsx', 'app/fr/reserver/page.tsx']

// Imports statiques (vite n'accepte pas un chemin de module entièrement dynamique).
const LAYOUTS: Record<LocaleTestee, () => Promise<unknown>> = {
  pt: () => import('@/app/pt/layout'),
  fr: () => import('@/app/fr/layout'),
  en: () => import('@/app/en/layout'),
  nl: () => import('@/app/nl/layout'),
  es: () => import('@/app/es/layout'),
}

const rendre = (locale: LocaleTestee) => renderToStaticMarkup(<CoquilleRacine locale={locale}><p>contenu</p></CoquilleRacine>)

function graphe(html: string): Array<Record<string, unknown>> {
  const bloc = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  expect(bloc).not.toBeNull()
  return (JSON.parse(bloc![1]) as { '@graph': Array<Record<string, unknown>> })['@graph']
}

// Position d'un texte dans un fichier, qui doit y figurer.
function position(texte: string, motif: string): number {
  const indice = texte.indexOf(motif)
  expect(indice, motif).toBeGreaterThan(-1)
  return indice
}

describe('un layout racine par langue, sans API dynamique', () => {
  // Pas de layout racine commun, même « passe-plat » (sans <html>) : essayé le 30/10/2026, un seul layout racine pour Next
  // garde la 404 globale affichée après un clic sur un lien (la donnée racine de /_not-found est réutilisée) et remonte
  // Providers (synchro localStorage, Supabase) à chaque changement de section. Plusieurs layouts racine : un changement de
  // section recharge la page, comportement prévu par Next.
  it("app/layout.tsx n'existe plus : il redeviendrait le layout racine de tout le site et rendrait tout dynamique", () => {
    expect(existsSync(join(RACINE, 'app', 'layout.tsx'))).toBe(false)
  })

  it.each(LOCALES)('app/%s/layout.tsx rend la coquille commune sans cookies() ni headers()', (locale) => {
    const source = lire('app', locale, 'layout.tsx')
    expect(source).toContain('<CoquilleRacine locale="' + locale + '">')
    expect(sansCommentaires(source)).not.toMatch(API_DYNAMIQUES)
  })

  it.each(['components/common/CoquilleRacine.tsx', 'lib/seo/metadonnees-racine.ts'])('%s ne lit ni cookies() ni headers()', (fichier) => {
    expect(sansCommentaires(lire(fichier))).not.toMatch(API_DYNAMIQUES)
  })

  it.each(LOCALES)('app/%s : not-found.tsx (notFound() levé par une page de la langue, affiché par le navigateur) et error.tsx', (locale) => {
    expect(existsSync(join(RACINE, 'app', locale, 'not-found.tsx'))).toBe(true)
    expect(existsSync(join(RACINE, 'app', locale, 'error.tsx'))).toBe(true)
  })

  it('app/(commun) : layout racine dynamique, 404 et erreur', () => {
    expect(sansCommentaires(lire('app', '(commun)', 'layout.tsx'))).toMatch(API_DYNAMIQUES)
    for (const fichier of ['not-found.tsx', 'error.tsx']) {
      expect(existsSync(join(RACINE, 'app', '(commun)', fichier)), fichier).toBe(true)
    }
  })

  it('toute page est rangée dans une section : app/{pt,fr,en,nl,es}/ ou app/(commun)/', () => {
    // Hors section, une page n'a aucun layout racine : next build échoue (« doesn't have a root layout ») et next dev crée
    // à côté d'elle un layout minimal, sans la coquille ni Providers.
    const pages = ARBRE_APP.filter((f) => /\/(page|default)\.(tsx|ts|jsx|js|mdx)$/.test(f))
    expect(pages.length).toBeGreaterThan(100)
    expect(pages.filter((f) => !/^app\/(pt|fr|en|nl|es|\(commun\))\//.test(f))).toEqual([])
  })

  it('aucune route fourre-tout ([...x] ou [[...x]]) hors de app/api', () => {
    // Une page fourre-tout qui lève notFound() ne rend côté serveur qu'une coquille <html id="__next_error__"> vide, là où
    // app/global-not-found.tsx rend une 404 complète.
    expect(ARBRE_APP.filter((f) => !f.startsWith('app/api/') && /\/\[\[?\.\.\.[^/]*\/$/.test(f))).toEqual([])
  })

  it('URL sans route : app/global-not-found.tsx, activé par experimental.globalNotFound', () => {
    expect(existsSync(join(RACINE, 'app', 'global-not-found.tsx'))).toBe(true)
    expect(sansCommentaires(lire('next.config.ts'))).toMatch(/globalNotFound:\s*true/)
  })
})

describe('pages et layouts des sections de langue : aucune API dynamique directe hors fichiers listés', () => {
  // Next combine la configuration de tous les segments d'une route, layouts compris : un `revalidate` ou un
  // `force-dynamic` posé dans un layout vaut pour toutes ses pages. Cette lecture des sources ne voit que les appels
  // directs ; un helper importé qui lit cookies() ou headers() (getServerTranslation) est vu après le build par
  // scripts/seo/verifier-prerendu.mjs, qui exige au prerender-manifest chaque page hors RENDUES_A_LA_DEMANDE.
  const FICHIERS = ARBRE_APP.filter((f) => /^app\/(pt|fr|en|nl|es)\//.test(f) && /\/(page|layout|template|default)\.(tsx|ts|jsx|js|mdx)$/.test(f))
  const REGLES: Array<[string, RegExp, string[]]> = [
    ['ni revalidate ni fetchCache (cache en lecture seule, pas d’ISR)', /export const (revalidate|fetchCache)\b/, []],
    ['force-dynamic seulement dans les segments listés', /export const dynamic = ['"]force-dynamic['"]/, Object.keys(SEGMENTS_FORCE_DYNAMIC)],
    ['cookies(), headers() et draftMode() seulement dans les pages listées', /next\/headers|\bcookies\(|\bheaders\(|\bdraftMode\(/, PAGES_COOKIES],
    ['ni connection() ni noStore()', /\bconnection\(|noStore\(/, []],
    ["paramètres d'URL lus seulement sous un segment force-dynamic", /\bsearchParams\b|\buseSearchParams\b/, PAGES_URL],
  ]

  it('les page, layout, template et default des sections sont tous examinés', () => {
    expect(FICHIERS.length).toBeGreaterThanOrEqual(100)
  })

  it.each(REGLES)('%s', (_titre, motif, permis) => {
    expect(FICHIERS.filter((f) => !permis.includes(f) && motif.test(sansCommentaires(lire(f))))).toEqual([])
  })

  it.each(Object.entries(SEGMENTS_FORCE_DYNAMIC))('%s reste dynamique : %s', (fichier) => {
    expect(lire(fichier)).toMatch(/^export const dynamic = 'force-dynamic'\r?$/m)
  })

  it.each(PAGES_COOKIES)('%s lit les cookies (dynamique sans force-dynamic)', (fichier) => {
    expect(sansCommentaires(lire(fichier))).toMatch(/\bcookies\(/)
  })

  it.each(PAGES_URL)('%s est sous un layout force-dynamic de la liste', (fichier) => {
    expect(Object.keys(SEGMENTS_FORCE_DYNAMIC)).toContain(fichier.replace(/page\.tsx$/, 'layout.tsx'))
  })

  it('les pages de ces listes figurent dans RENDUES_A_LA_DEMANDE (garde après le build)', () => {
    const route = (fichier: string) => fichier.replace(/^app/, '').replace(/\/(page|layout)\.tsx$/, '')
    const pages = [...Object.keys(SEGMENTS_FORCE_DYNAMIC), ...PAGES_COOKIES, ...PAGES_URL].map(route)
    expect(pages.filter((page) => !Object.hasOwn(RENDUES_A_LA_DEMANDE, page))).toEqual([])
  })
})

describe('métadonnées des layouts racine (fusion clé par clé de Next conservée)', () => {
  it('valeurs partagées figées, identiques à l’ancien app/layout.tsx (vérification Google, robots, éditeur)', () => {
    expect(METADONNEES_PARTAGEES.authors).toEqual([{ name: 'VITFIX' }])
    expect(METADONNEES_PARTAGEES.creator).toBe('VITFIX')
    expect(METADONNEES_PARTAGEES.publisher).toBe('VITFIX')
    expect(METADONNEES_PARTAGEES.verification).toEqual({ google: 'L5Xcai6puTpFfvMAQ7zvOinxUsg6u5YGfqhRNdVp34Y' })
    expect(METADONNEES_PARTAGEES.robots).toEqual({
      index: true,
      follow: true,
      nocache: false,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 },
    })
  })

  it.each(LOCALES)('app/%s/layout.tsx porte les clés partagées de l’ancien layout racine', async (locale) => {
    const { metadata } = (await LAYOUTS[locale]()) as { metadata: Metadata }
    expect(metadata.robots).toEqual(METADONNEES_PARTAGEES.robots)
    expect(metadata.verification).toEqual(METADONNEES_PARTAGEES.verification)
    expect(metadata.authors).toEqual([{ name: 'VITFIX' }])
    expect(metadata.creator).toBe('VITFIX')
    expect(metadata.publisher).toBe('VITFIX')
    expect(metadata.openGraph?.locale).toBe({ pt: 'pt_PT', fr: 'fr_FR', en: 'en_GB', nl: 'nl_NL', es: 'es_ES' }[locale])
  })

  it('PT : template « %s | VITFIX », manifest PT, x-default sur /fr/ ; FR : template Marseille, x-default sur /', async () => {
    const pt = ((await LAYOUTS.pt()) as { metadata: Metadata }).metadata
    expect(pt.title).toEqual({ default: 'Profissionais de construção verificados em Portugal', template: '%s | VITFIX' })
    expect(pt.manifest).toBe('/pt/manifest.webmanifest')
    expect(pt.alternates?.languages).toMatchObject({ 'x-default': 'https://vitfix.io/fr/' })
    const fr = ((await LAYOUTS.fr()) as { metadata: Metadata }).metadata
    expect(fr.title).toMatchObject({ template: '%s | VITFIX Marseille' })
    expect(fr.alternates?.languages).toMatchObject({ 'x-default': 'https://vitfix.io/' })
  })

  it('metadonneesRacine : titre et Open Graph par langue, FR par défaut', () => {
    expect(metadonneesRacine('pt')).toMatchObject({ title: 'VITFIX - Encontre o profissional perto de si, em 2 cliques', openGraph: { locale: 'pt_PT' } })
    expect(metadonneesRacine('fr')).toMatchObject({ openGraph: { locale: 'fr_FR' } })
    expect(metadonneesRacine('nl')).toMatchObject({ openGraph: { locale: 'nl_NL' } })
    // Langue lue dans le cookie brut : valeur inconnue ou clé d'Object.prototype, repli sur FR.
    for (const valeur of ['de', '', 'constructor', '__proto__', 'toString']) {
      expect(metadonneesRacine(valeur as Locale), valeur).toEqual(metadonneesRacine('fr'))
    }
  })
})

describe('coquille commune (components/common/CoquilleRacine.tsx)', () => {
  it.each([
    ['pt', 'pt-PT'],
    ['fr', 'fr-FR'],
    ['en', 'en'],
    ['nl', 'nl'],
    ['es', 'es'],
  ] as Array<[LocaleTestee, string]>)('locale %s : <html lang="%s"> (BCP 47 régionalisé)', (locale, lang) => {
    expect(rendre(locale)).toMatch(new RegExp('^<html lang="' + lang + '"'))
  })

  it('PT : une seule entité #business, adresse réelle, 22 concelhos, téléphone PT, pas de SearchAction ni de priceRange', () => {
    const noeuds = graphe(rendre('pt'))
    expect(noeuds).toHaveLength(2)
    const entreprises = noeuds.filter((n) => n['@id'] === 'https://vitfix.io/#business')
    expect(entreprises).toHaveLength(1)
    expect(entreprises[0]).toMatchObject({ address: ENTITE_PT.adresse, telephone: PHONE_PT, email: CONTACT_EMAIL, taxID: 'PT276873297' })
    expect(entreprises[0].areaServed).toHaveLength(22)
    expect(entreprises[0]).not.toHaveProperty('priceRange')
    const site = noeuds.find((n) => n['@type'] === 'WebSite')!
    expect(site.inLanguage).toBe('pt-PT')
    expect(site).not.toHaveProperty('potentialAction')
  })

  it('FR : SearchAction vers /fr/recherche/, téléphone FR, priceRange, inLanguage fr-FR', () => {
    const noeuds = graphe(rendre('fr'))
    const entreprise = noeuds.find((n) => n['@id'] === 'https://vitfix.io/#business')!
    expect(entreprise).toMatchObject({ telephone: PHONE_FR, priceRange: '€€' })
    expect(entreprise).not.toHaveProperty('address')
    const site = noeuds.find((n) => n['@type'] === 'WebSite')!
    expect(site.inLanguage).toBe('fr-FR')
    expect(site.potentialAction).toMatchObject({ target: { urlTemplate: 'https://vitfix.io/fr/recherche/?q={search_term_string}' } })
  })

  it('EN : SearchAction vers /en/?q=, inLanguage en, image sociale EN', () => {
    const noeuds = graphe(rendre('en'))
    expect(noeuds.find((n) => n['@type'] === 'WebSite')).toMatchObject({ inLanguage: 'en', potentialAction: { target: { urlTemplate: 'https://vitfix.io/en/?q={search_term_string}' } } })
    expect(noeuds.find((n) => n['@id'] === 'https://vitfix.io/#business')).toMatchObject({ image: 'https://vitfix.io/api/og/?locale=en' })
  })

  it('lien d’évitement dans la langue, contenu dans <main id="main-content">', () => {
    expect(rendre('pt')).toContain('Ir para o conteúdo principal')
    expect(rendre('fr')).toContain('Aller au contenu principal')
    expect(rendre('en')).toContain('Skip to main content')
    expect(rendre('nl')).toContain('Skip to main content')
    expect(rendre('es')).toContain('Ir al contenido principal')
    expect(rendre('pt')).toContain('<main id="main-content"><p>contenu</p></main>')
  })
})

describe('layout racine commun (app/(commun)/layout.tsx) : locale de la requête, comme l’ancien app/layout.tsx', () => {
  it('x-locale (middleware) prime sur le cookie ; sans les deux, fr ; métadonnées par le cookie', async () => {
    const { default: LayoutCommun, generateMetadata } = await import('@/app/(commun)/layout')
    requete.enTete = 'pt'
    requete.cookie = 'fr'
    expect(renderToStaticMarkup(await LayoutCommun({ children: <p>x</p> }))).toMatch(/^<html lang="pt-PT"/)
    requete.enTete = undefined
    requete.cookie = 'en'
    expect(renderToStaticMarkup(await LayoutCommun({ children: <p>x</p> }))).toMatch(/^<html lang="en"/)
    requete.cookie = undefined
    expect(renderToStaticMarkup(await LayoutCommun({ children: <p>x</p> }))).toMatch(/^<html lang="fr-FR"/)
    requete.cookie = 'pt'
    expect((await generateMetadata()).openGraph).toMatchObject({ locale: 'pt_PT' })
    requete.cookie = undefined
    expect((await generateMetadata()).openGraph).toMatchObject({ locale: 'fr_FR' })
  })
})

describe('404 des URL sans route (app/global-not-found.tsx) : comme l’ancien app/layout.tsx + app/not-found.tsx', () => {
  it('coquille dans la langue de la requête (x-locale puis cookie), texte et métadonnées par le cookie, noindex', async () => {
    const { default: GlobalNotFound, generateMetadata } = await import('@/app/global-not-found')
    requete.enTete = 'pt'
    requete.cookie = 'pt'
    const html = renderToStaticMarkup(await GlobalNotFound())
    expect(html).toMatch(/^<html lang="pt-PT"/)
    expect(html).toContain('Página não encontrada')
    expect(html).toContain('href="/pt/pesquisar/"')
    // Une seule entité #business, comme sur toutes les pages.
    expect(graphe(html).filter((n) => n['@id'] === 'https://vitfix.io/#business')).toHaveLength(1)
    expect(await generateMetadata()).toMatchObject({
      title: metadonneesRacine('pt').title,
      robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
    })
    requete.enTete = 'fr'
    requete.cookie = 'fr'
    const fr = renderToStaticMarkup(await GlobalNotFound())
    expect(fr).toMatch(/^<html lang="fr-FR"/)
    expect(fr).toContain('Page non trouvée')
    requete.enTete = undefined
    requete.cookie = undefined
    const parDefaut = renderToStaticMarkup(await GlobalNotFound())
    expect(parDefaut).toMatch(/^<html lang="fr-FR"/)
    expect(parDefaut).toContain('Page non trouvée')
    expect((await generateMetadata()).openGraph).toMatchObject({ locale: 'fr_FR' })
  })

  it('cookie de langue invalide, même une clé d’Object.prototype : 404 en anglais, sans erreur', async () => {
    const { default: PageIntrouvable } = await import('@/components/common/PageIntrouvable')
    expect(renderToStaticMarkup(<PageIntrouvable locale="constructor" />)).toContain('Page not found')
    expect(renderToStaticMarkup(<PageIntrouvable locale="de" />)).toContain('Page not found')
  })
})

describe('routes SEO : pré-rendues au build et servies telles quelles par le Worker', () => {
  const ROUTES_SEO = [
    'app/pt/servicos/[slug]/page.tsx', 'app/pt/servicos/page.tsx', 'app/pt/servicos/limpeza-de-telhados/page.tsx',
    'app/pt/servicos/renovacao-de-fachadas/page.tsx', 'app/pt/servicos/trabalhos-verticais/page.tsx',
    'app/pt/servicos/limpeza-de-terrenos-agueda/page.tsx', 'app/pt/servicos/terraplanagem-agueda/page.tsx',
    'app/pt/precos/[slug]/page.tsx', 'app/pt/precos/page.tsx', 'app/pt/perto-de-mim/[slug]/page.tsx', 'app/pt/perto-de-mim/page.tsx',
    'app/pt/blog/[slug]/page.tsx', 'app/pt/blog/page.tsx', 'app/pt/cidade/[slug]/page.tsx', 'app/pt/cidade/page.tsx',
    'app/fr/services/[slug]/page.tsx', 'app/fr/services/page.tsx', 'app/fr/ville/[slug]/page.tsx', 'app/fr/blog/[slug]/page.tsx',
    'app/fr/blog/page.tsx', 'app/fr/urgence/[slug]/page.tsx', 'app/fr/urgence/page.tsx', 'app/fr/pres-de-chez-moi/[slug]/page.tsx',
    'app/en/[slug]/page.tsx',
  ]

  // Cache en assets statiques en lecture seule (open-next.config.ts) : pas d'ISR. Un `revalidate` rendrait chaque page
  // périmée après le délai, puis relancerait à chaque requête une revalidation vouée à l'échec (écriture refusée).
  // Le contenu de ces pages ne vient que du dépôt : une mise à jour = un déploiement.
  it.each(ROUTES_SEO)('%s : statique (ni revalidate, ni force-dynamic, ni API dynamique)', (fichier) => {
    const source = sansCommentaires(lire(fichier))
    expect(source).not.toMatch(/export const (revalidate|dynamic)\b/)
    expect(source).not.toMatch(API_DYNAMIQUES)
  })

  it('open-next.config.ts : cache lu dans les assets du Worker, écritures ignorées sans ligne d’erreur', async () => {
    type CacheIncremental = {
      name: string
      get(cle: string, type?: string): Promise<unknown>
      set(cle: string, valeur: unknown, type?: string): Promise<void>
      delete(cle: string): Promise<void>
    }
    const { default: config } = await import('@/open-next.config')
    // Priorité des en-têtes : celle du middleware (défaut d'OpenNext). Avec `headersAndCookiesPriority`, l'en-tête de Next
    // (s-maxage=31536000 sur une page pré-rendue) l'emporterait sur le `private, no-store` des accueils.
    expect((config as { dangerous?: { headersAndCookiesPriority?: unknown } }).dangerous?.headersAndCookiesPriority).toBeUndefined()
    const fabrique = config.default.override?.incrementalCache
    expect(typeof fabrique).toBe('function')
    const cache = await (fabrique as unknown as () => Promise<CacheIncremental>)()
    // populateCache reconnaît ce cache par son nom pour copier les entrées du build.
    expect(cache.name).toBe('cf-static-assets-incremental-cache')

    // Contexte Cloudflare du Worker (liaison ASSETS), tel que le pose OpenNext.
    const CONTEXTE = Symbol.for('__cloudflare-context__')
    const portee = globalThis as unknown as Record<symbol, unknown>
    const lireAsset = vi.fn(async (_url: string) => ({ ok: true, body: null, json: async () => ({ type: 'app' }) }))
    portee[CONTEXTE] = { env: { ASSETS: { fetch: lireAsset } }, ctx: {}, cf: {} }
    vi.stubEnv('OPEN_NEXT_BUILD_ID', 'build-test')
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect(await cache.get('/pt/servicos/canalizador-porto', 'cache')).toMatchObject({ value: { type: 'app' } })
      expect(lireAsset).toHaveBeenCalledWith('http://assets.local/cdn-cgi/_next_cache/build-test/pt/servicos/canalizador-porto.cache')
      // Slug inconnu rendu à la demande, cache fetch : l'écriture est demandée à chaque requête.
      await cache.set('/pt/servicos/zzz-zzz', { type: 'app' }, 'cache')
      await cache.delete('/pt/servicos/zzz-zzz')
      expect(lireAsset).toHaveBeenCalledTimes(1)
      expect(erreurs).not.toHaveBeenCalled()
    } finally {
      delete portee[CONTEXTE]
      vi.unstubAllEnvs()
      erreurs.mockRestore()
    }
  })

  it('CI de PR et déploiement : la garde du pré-rendu suit le build ; copie des pages avant wrangler deploy', () => {
    const ci = lire('.github', 'workflows', 'ci.yml')
    expect(position(ci, 'run: node scripts/seo/verifier-prerendu.mjs')).toBeGreaterThan(position(ci, '- name: Vérifier le build de production'))
    const workflow = lire('.github', 'workflows', 'deploy-cloudflare.yml')
    const build = position(workflow, '- name: Build OpenNext bundle')
    const garde = position(workflow, 'node scripts/seo/verifier-prerendu.mjs')
    const copie = position(workflow, 'cp -R .open-next/cache/. .open-next/assets/cdn-cgi/_next_cache/')
    expect(garde).toBeGreaterThan(build)
    expect(copie).toBeGreaterThan(garde)
    expect(copie).toBeLessThan(position(workflow, '- name: Deploy to Cloudflare Workers'))
  })
})

describe('scripts/seo/verifier-prerendu.mjs : garde du prerender-manifest après le build', () => {
  type RoutePrerendue = { initialRevalidateSeconds: number | false; srcRoute: string }
  type Manifeste = { routes: Record<string, RoutePrerendue>; dynamicRoutes: Record<string, object> }
  // Pages d'exemple : une page statique et un gabarit par section, plus les pages listées comme rendues à la demande.
  const PAGES = ['/pt', '/pt/servicos/[slug]', '/fr', '/fr/blog', '/fr/blog/[slug]', '/en', '/en/[slug]', ...Object.keys(RENDUES_A_LA_DEMANDE)].sort()
  const MESSAGE_PAGE_A_LA_DEMANDE = (page: string) => expect.stringContaining(`page rendue à la demande : ${page} (`)

  // Manifeste conforme : chaque page non listée pré-rendue (une page par gabarit), pages témoins, et autant de routes que
  // le plancher de chaque section.
  function manifesteConforme(pages: string[] = PAGES): Manifeste {
    const manifeste: Manifeste = { routes: {}, dynamicRoutes: {} }
    const ajouter = (chemin: string, gabarit = chemin) => {
      manifeste.routes[chemin] = { initialRevalidateSeconds: false, srcRoute: gabarit }
    }
    for (const page of pages) {
      if (Object.hasOwn(RENDUES_A_LA_DEMANDE, page)) continue
      if (page.includes('[')) {
        manifeste.dynamicRoutes[page] = {}
        ajouter(page.replace(/\[[^\]]+\]/g, 'exemple'), page)
      } else {
        ajouter(page)
      }
    }
    for (const temoin of TEMOINS) if (!(temoin in manifeste.routes)) ajouter(temoin)
    for (const [prefixe, plancher] of Object.entries(PLANCHERS)) {
      const presentes = Object.keys(manifeste.routes).filter((chemin) => chemin.startsWith(prefixe)).length
      for (let i = 0; i < plancher - presentes; i++) ajouter(`${prefixe}page-${i}`)
    }
    return manifeste
  }

  // Ramène une section à exactement `nombre` routes pré-rendues, par des routes de remplissage ajoutées ou retirées.
  function avecRoutes(manifeste: Manifeste, prefixe: string, nombre: number): Manifeste {
    const routes = { ...manifeste.routes }
    const remplissage = Object.keys(routes).filter((chemin) => chemin.startsWith(`${prefixe}page-`))
    let total = Object.keys(routes).filter((chemin) => chemin.startsWith(prefixe)).length
    while (total > nombre && remplissage.length) {
      delete routes[remplissage.pop()!]
      total--
    }
    for (let i = 0; total < nombre; i++) {
      if (`${prefixe}ajout-${i}` in routes) continue
      routes[`${prefixe}ajout-${i}`] = { initialRevalidateSeconds: false, srcRoute: `${prefixe}ajout-${i}` }
      total++
    }
    return { ...manifeste, routes }
  }

  it('planchers figés : /pt/ 540, /fr/ 1 500, /en/ 10', () => {
    expect(PLANCHERS).toEqual({ '/pt/': 540, '/fr/': 1500, '/en/': 10 })
  })

  it('manifeste conforme : aucune erreur', () => {
    expect(verifierPrerendu(manifesteConforme(), PAGES).erreurs).toEqual([])
  })

  it('plancher : 1 500 routes /fr/ passent, 1 499 échouent', () => {
    expect(verifierPrerendu(avecRoutes(manifesteConforme(), '/fr/', 1500), PAGES).erreurs).toEqual([])
    expect(verifierPrerendu(avecRoutes(manifesteConforme(), '/fr/', 1499), PAGES).erreurs).toEqual(['/fr/ : 1499 routes pré-rendues, plancher 1500'])
  })

  it('section /pt/ redevenue dynamique : plancher, témoins et gabarit en erreur', () => {
    const manifeste = manifesteConforme()
    const routes = Object.fromEntries(Object.entries(manifeste.routes).filter(([chemin]) => !chemin.startsWith('/pt/')))
    const dynamicRoutes = Object.fromEntries(Object.entries(manifeste.dynamicRoutes).filter(([gabarit]) => !gabarit.startsWith('/pt/')))
    const { erreurs } = verifierPrerendu({ routes, dynamicRoutes }, PAGES)
    expect(erreurs).toContain('/pt/ : 0 routes pré-rendues, plancher 540')
    expect(erreurs).toContain('page témoin absente du pré-rendu : /pt/servicos/canalizador-porto')
    expect(erreurs).toContainEqual(MESSAGE_PAGE_A_LA_DEMANDE('/pt/servicos/[slug]'))
  })

  it('gabarit devenu dynamique (helper qui lit cookies() dans une famille sans témoin) : erreur qui nomme la page', () => {
    const manifeste = manifesteConforme()
    delete manifeste.dynamicRoutes['/fr/blog/[slug]']
    delete manifeste.routes['/fr/blog/exemple']
    expect(verifierPrerendu(avecRoutes(manifeste, '/fr/', 1500), PAGES).erreurs).toEqual([MESSAGE_PAGE_A_LA_DEMANDE('/fr/blog/[slug]')])
  })

  it('gabarit au manifeste mais sans aucune page pré-rendue : erreur', () => {
    const manifeste = manifesteConforme()
    delete manifeste.routes['/fr/blog/exemple']
    expect(verifierPrerendu(avecRoutes(manifeste, '/fr/', 1500), PAGES).erreurs).toEqual([MESSAGE_PAGE_A_LA_DEMANDE('/fr/blog/[slug]')])
  })

  it('page statique devenue dynamique : erreur', () => {
    const manifeste = manifesteConforme()
    delete manifeste.routes['/fr/blog']
    expect(verifierPrerendu(avecRoutes(manifeste, '/fr/', 1500), PAGES).erreurs).toEqual([MESSAGE_PAGE_A_LA_DEMANDE('/fr/blog')])
  })

  it('page listée dans RENDUES_A_LA_DEMANDE mais pré-rendue : erreur, la liste reste exacte', () => {
    const manifeste = manifesteConforme()
    manifeste.routes['/fr/cgu'] = { initialRevalidateSeconds: false, srcRoute: '/fr/cgu' }
    expect(verifierPrerendu(avecRoutes(manifeste, '/fr/', 1500), PAGES).erreurs).toEqual([
      'page pré-rendue encore listée dans RENDUES_A_LA_DEMANDE : /fr/cgu (la retirer de la liste)',
    ])
  })

  it('page listée qui n’existe plus : erreur', () => {
    const pages = PAGES.filter((page) => page !== '/fr/cgu')
    expect(verifierPrerendu(manifesteConforme(pages), pages).erreurs).toEqual(["RENDUES_A_LA_DEMANDE cite une page qui n'existe plus : /fr/cgu"])
  })

  it('page témoin absente : erreur', () => {
    const manifeste = manifesteConforme()
    delete manifeste.routes['/fr/services/plombier-marseille']
    expect(verifierPrerendu(avecRoutes(manifeste, '/fr/', 1500), PAGES).erreurs).toEqual(['page témoin absente du pré-rendu : /fr/services/plombier-marseille'])
  })

  it('route avec revalidate (ISR sur un cache en lecture seule) : erreur', () => {
    const manifeste = manifesteConforme()
    manifeste.routes['/pt/blog/cano-entupido-como-resolver'] = { initialRevalidateSeconds: 86400, srcRoute: '/pt/blog/[slug]' }
    expect(verifierPrerendu(manifeste, PAGES).erreurs).toEqual(['1 route(s) avec revalidate (cache en lecture seule) : /pt/blog/cano-entupido-como-resolver'])
  })

  it('pages réelles des sections : RENDUES_A_LA_DEMANDE ne cite que des pages qui existent', () => {
    const pages = pagesDesSections(RACINE)
    // Décompte indépendant : un fichier page par route (aucun emplacement @x ni dossier privé dans les sections).
    const fichiersPage = ARBRE_APP.filter((f) => /^app\/(pt|fr|en|nl|es)\//.test(f) && /\/page\.(tsx|ts|jsx|js)$/.test(f))
    expect(fichiersPage.length).toBeGreaterThan(80)
    expect(pages).toHaveLength(fichiersPage.length)
    expect(pages).toContain('/pt')
    expect(pages).toContain('/pt/servicos/[slug]')
    expect(Object.keys(RENDUES_A_LA_DEMANDE).filter((page) => !pages.includes(page))).toEqual([])
  })

  it('correspondance fichier → route comme Next : groupes et emplacements @x omis, dossiers _x et page.mdx ignorés', () => {
    const racine = mkdtempSync(join(tmpdir(), 'pages-sections-'))
    const creer = (chemin: string) => {
      mkdirSync(join(racine, dirname(chemin)), { recursive: true })
      writeFileSync(join(racine, chemin), '')
    }
    try {
      for (const fichier of ['app/fr/page.tsx', 'app/fr/@bandeau/page.tsx', 'app/fr/(groupe)/a/page.tsx', 'app/fr/b/[slug]/page.ts', 'app/fr/_prive/page.tsx', 'app/fr/c/page.mdx', 'app/pt/page.jsx']) {
        creer(fichier)
      }
      expect(pagesDesSections(racine)).toEqual(['/fr', '/fr/a', '/fr/b/[slug]', '/pt'])
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  })

  it('en ligne de commande, sur les pages réelles : code 0 si conforme, code 1 et annotations ::error:: sinon', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'verifier-prerendu-'))
    const lancer = (manifeste: object) => {
      const fichier = join(dossier, 'prerender-manifest.json')
      writeFileSync(fichier, JSON.stringify({ version: 4, ...manifeste }))
      return spawnSync(process.execPath, ['scripts/seo/verifier-prerendu.mjs', fichier], { cwd: RACINE, encoding: 'utf8' })
    }
    try {
      const conforme = lancer(manifesteConforme(pagesDesSections(RACINE)))
      expect(conforme.status, conforme.stdout).toBe(0)
      const echec = lancer({ routes: {}, dynamicRoutes: {} })
      expect(echec.status).toBe(1)
      expect(echec.stdout).toContain('::error::page témoin absente du pré-rendu : /pt/servicos/canalizador-porto')
      expect(echec.stdout).toContain('::error::page rendue à la demande : /pt/servicos/[slug] ')
    } finally {
      rmSync(dossier, { recursive: true, force: true })
    }
  })
})
