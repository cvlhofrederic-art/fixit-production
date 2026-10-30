// tests/seo/liens-entete-pied-langues.test.tsx
//
// En-tête et pied de page publics (components/common/Header.tsx et Footer.tsx) dans les sections EN, NL et ES. Leurs
// liens visaient /en/recherche/, /en/auth/login/, /en/pro/register/, /en/pro/tarifs/, /en/pro/faq/, /en/pricing/ et,
// en NL et ES, les slugs FR (/nl/cgu/, /es/cookies/, /nl/tarifs/…) : 32 URL en 404 en production (HTML et
// préchargement RSC), sur les pages légales EN, les pages de service EN, les pages investisseurs NL et ES et les pages
// communes servies sous ces préfixes (/en/rejoindre/…). next.config.ts ne réécrit les pages de app/(commun)/ que sous
// /fr/ et /pt/, et ces sections n'ont que leur accueil, leurs pages de service et, en anglais, les pages légales.
//
// Chaque lien rendu, dans chaque langue, connecté ou non, doit mener à une page, sans redirection, rejoué comme en
// production : redirections de next.config.ts, puis middleware (préfixe de langue forcé, consolidation PT), puis
// réécritures beforeFiles, puis pages de app/ (sans segment dynamique : /en/pricing/ tomberait sur app/en/[slug]).

import React from 'react'
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import configurationNext from '@/next.config'
import { destinoConsolidado } from '@/lib/seo/pt-consolidacao'
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/config'

// next.config.ts déclare trailingSlash: true ; next/link lit cette variable (injectée au build) pour normaliser les
// href rendus comme en production.
vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

type Utilisateur = { email: string; app_metadata: { role: string }; user_metadata: { full_name: string } }
const etat = vi.hoisted(() => ({ utilisateur: null as Utilisateur | null }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: etat.utilisateur } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signOut: async () => ({ error: null }),
    },
  },
}))

import Header from '@/components/common/Header'
import Footer from '@/components/common/Footer'
import { LanguageProvider } from '@/lib/i18n/context'
import { LIENS_ENTETE_PIED } from '@/lib/i18n/liens-entete-pied'

// ── Rejeu du routage de production ──────────────────────────────────────────

// Même bibliothèque que le routeur d'OpenNext, et regex du routes-manifest construite comme au build par Next
// (voir tests/next-config-routage-opennext.test.ts, qui rejoue les mêmes règles en détail).
const requireOpenNext = createRequire(createRequire(import.meta.url).resolve('@opennextjs/aws/core/routing/matcher.js'))
const { compile, match } = requireOpenNext('path-to-regexp') as typeof import('path-to-regexp')
const { buildCustomRoute } = createRequire(import.meta.url)('next/dist/lib/build-custom-route') as {
  buildCustomRoute: (phase: 'redirect' | 'rewrite', regle: Regle, cheminsReserves?: string[]) => { regex: string }
}
type Regle = { source: string; destination: string }

function resoudre(phase: 'redirect' | 'rewrite', regles: Regle[], chemin: string): string | null {
  for (const regle of regles) {
    const regex = new RegExp(buildCustomRoute(phase, regle, phase === 'redirect' ? ['/_next'] : undefined).regex)
    if (!regex.test(chemin)) continue
    const parametres = ((match(regle.source)(chemin) || { params: {} }).params) as Record<string, unknown>
    return Object.keys(parametres).length > 0 ? compile(regle.destination)(parametres) : regle.destination
  }
  return null
}

const estGroupe = (nom: string) => nom.startsWith('(') && nom.endsWith(')')
const FICHIERS_PAGE = ['page.tsx', 'page.ts']

/** Une page de app/ sert-elle exactement ce chemin, sans segment dynamique ? (groupes de routes traversés) */
function pageExiste(chemin: string): boolean {
  const avecGroupes = (dossier: string): string[] => [
    dossier,
    ...readdirSync(dossier, { withFileTypes: true })
      .filter((entree) => entree.isDirectory() && estGroupe(entree.name))
      .flatMap((entree) => avecGroupes(join(dossier, entree.name))),
  ]
  let dossiers = avecGroupes(join(process.cwd(), 'app'))
  for (const segment of chemin.split('/').filter(Boolean)) {
    dossiers = dossiers.map((dossier) => join(dossier, segment)).filter((dossier) => existsSync(dossier)).flatMap(avecGroupes)
  }
  return dossiers.some((dossier) => FICHIERS_PAGE.some((fichier) => existsSync(join(dossier, fichier))))
}

/** Défaut du lien, ou null s'il mène à une page sans redirection. */
async function defautDuLien(href: string): Promise<string | null> {
  const url = new URL(href, 'https://vitfix.io')
  const chemin = url.pathname
  if (!chemin.endsWith('/')) return 'sans barre finale (308 trailingSlash)'
  const redirections = ((await configurationNext.redirects?.()) ?? []) as Regle[]
  const redirigee = resoudre('redirect', redirections, chemin)
  if (redirigee) return `redirigé (next.config.ts) vers ${redirigee}`
  if (!/^\/(fr|pt|en|nl|es)\//.test(chemin)) return 'sans langue : le middleware le renvoie vers la langue du cookie'
  const consolidee = destinoConsolidado(chemin)
  if (consolidee) return `redirigé (middleware) vers ${consolidee}`
  const reecritures = await configurationNext.rewrites?.()
  const avantFichiers = (reecritures && !Array.isArray(reecritures) ? reecritures.beforeFiles ?? [] : []) as Regle[]
  const servi = resoudre('rewrite', avantFichiers, chemin) ?? chemin
  return pageExiste(servi) ? null : `aucune page pour ${servi}`
}

// ── Rendu de l'en-tête et du pied ───────────────────────────────────────────

const UTILISATEURS: Record<string, Utilisateur> = {
  artisan: { email: 'ana@exemple.pt', app_metadata: { role: 'artisan' }, user_metadata: { full_name: 'Ana Silva' } },
  pro_societe: { email: 'rui@exemple.pt', app_metadata: { role: 'pro_societe' }, user_metadata: { full_name: 'Rui Costa' } },
  client: { email: 'eva@exemple.pt', app_metadata: { role: 'client' }, user_metadata: { full_name: 'Eva Lopes' } },
}

/** href de tous les liens internes de l'en-tête (menus ouverts) et du pied, pour une langue et un compte. */
async function liensRendus(locale: Locale, role?: keyof typeof UTILISATEURS): Promise<string[]> {
  etat.utilisateur = role ? UTILISATEURS[role] : null
  const { container, unmount } = render(
    <LanguageProvider initialLocale={locale}>
      <Header />
      <Footer />
    </LanguageProvider>,
  )
  if (role) {
    const initiales = UTILISATEURS[role].user_metadata.full_name.split(' ').map((mot) => mot[0]).join('')
    fireEvent.click((await screen.findByText(initiales)).closest('button')!)
  } else {
    await act(async () => { await Promise.resolve() })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
  const hrefs = Array.from(container.querySelectorAll('a[href]'), (lien) => lien.getAttribute('href') ?? '')
  unmount()
  return [...new Set(hrefs.filter((href) => href.startsWith('/')))].sort()
}

beforeEach(() => {
  etat.utilisateur = null
})

describe('en-tête et pied de page : chaque lien mène à une page, sans redirection', () => {
  it.each(SUPPORTED_LOCALES.flatMap((locale) => [undefined, ...Object.keys(UTILISATEURS)].map((role) => [locale, role ?? 'non connecté'] as const)))(
    '%s, %s',
    async (locale, compte) => {
      const hrefs = await liensRendus(locale, compte === 'non connecté' ? undefined : compte)
      expect(hrefs.length).toBeGreaterThan(5)
      const defauts = (await Promise.all(hrefs.map(async (href) => [href, await defautDuLien(href)] as const)))
        .filter(([, defaut]) => defaut !== null)
        .map(([href, defaut]) => `${href} : ${defaut}`)
      expect(defauts).toEqual([])
    },
  )

  it('rejoue bien les 404 constatées en production', async () => {
    // Garde du rejeu lui-même : les anciennes cibles doivent être signalées.
    for (const href of ['/en/recherche/', '/en/auth/login/', '/en/pro/register/', '/en/pro/tarifs/', '/en/pro/faq/', '/en/pricing/', '/nl/cgu/', '/es/cookies/']) {
      expect(await defautDuLien(href), href).toMatch(/^aucune page/)
    }
    expect(await defautDuLien('/en/search/')).toBe('redirigé (next.config.ts) vers /en/')
    expect(await defautDuLien('/auth/login/')).toMatch(/^sans langue/)
  })
})

describe('destinations retenues', () => {
  it('FR et PT inchangés', async () => {
    expect(await liensRendus('fr')).toEqual([
      '/fr/', '/fr/#how', '/fr/auth/login/', '/fr/avis/', '/fr/cgu/', '/fr/confidentialite/', '/fr/contact/', '/fr/cookies/',
      '/fr/mentions-legales/', '/fr/plan-du-site/', '/fr/pro/faq/', '/fr/pro/register/', '/fr/pro/tarifs/', '/fr/recherche/',
      '/fr/simulateur-devis/', '/fr/tarifs/',
    ])
    expect(await liensRendus('pt')).toEqual([
      '/pt/', '/pt/#how', '/pt/auth/login/', '/pt/avaliacoes/', '/pt/avisos-legais/', '/pt/cidade/', '/pt/contacto/',
      '/pt/mapa-do-site/', '/pt/perto-de-mim/', '/pt/pesquisar/', '/pt/politica-cookies/', '/pt/precos/', '/pt/privacidade/',
      '/pt/pro/faq/', '/pt/pro/register/', '/pt/pro/tarifs/', '/pt/servicos/', '/pt/simulador-orcamento/', '/pt/termos/',
      '/pt/urgencia/',
    ])
  })

  it.each(['en', 'nl', 'es'] as const)('%s : accueil de la section, pages PT, pages légales EN', (locale) => {
    expect(Object.fromEntries(Object.entries(LIENS_ENTETE_PIED).map(([cle, chemins]) => [cle, chemins[locale]]))).toEqual({
      // Où mènent déjà /en/search/, /en/reviews/ et /en/contact/ (redirections de next.config.ts).
      recherche: `/${locale}/`,
      avis: `/${locale}/`,
      contact: `/${locale}/`,
      // Pages que la section n'a pas, réécrites sous /pt/ seulement ou propres au marché PT (Porto).
      simulateur: '/pt/simulador-orcamento',
      tarifs: '/pt/precos',
      connexion: '/pt/auth/login',
      devenirPartenaire: '/pt/pro/register',
      offresPro: '/pt/pro/tarifs',
      faqPro: '/pt/pro/faq',
      espaceArtisan: '/pt/artisan/dashboard',
      espacePro: '/pt/pro/dashboard',
      espaceClient: '/pt/client/dashboard',
      // Pages légales EN : préfixées par LocaleLink en EN (/en/legal-notices/), déjà préfixées en NL et ES.
      mentionsLegales: locale === 'en' ? '/legal-notices' : '/en/legal-notices',
      cgu: locale === 'en' ? '/terms' : '/en/terms',
      confidentialite: locale === 'en' ? '/privacy' : '/en/privacy',
      cookies: locale === 'en' ? '/cookie-policy' : '/en/cookie-policy',
    })
  })

  it.each([
    ['artisan', '/en/artisan/dashboard/', '/pt/artisan/dashboard/'],
    ['pro_societe', '/en/pro/dashboard/', '/pt/pro/dashboard/'],
    ['client', '/en/client/dashboard/', '/pt/client/dashboard/'],
  ] as const)('« My space » (%s, EN) : %s remplacé par %s', async (role, avant, apres) => {
    const hrefs = await liensRendus('en', role)
    expect(hrefs).not.toContain(avant)
    expect(hrefs).toContain(apres)
  })
})
