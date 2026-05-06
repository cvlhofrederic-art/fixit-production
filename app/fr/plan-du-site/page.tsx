import type { Metadata } from 'next'
import Link from 'next/link'
import { FR_SERVICES, FR_CITIES, getAllFrPageCombos } from '@/lib/data/fr-seo-pages-data'
import { FR_BLOG_ARTICLES } from '@/lib/data/fr-blog-data'

export const metadata: Metadata = {
  title: 'Plan du site VITFIX — Toutes nos pages services et villes',
  description: 'Plan du site complet VITFIX : services artisans, villes desservies en PACA, articles de blog, ressources. Navigation rapide vers toutes nos pages.',
  alternates: {
    canonical: 'https://vitfix.io/fr/plan-du-site/',
    languages: {
      'fr': 'https://vitfix.io/fr/plan-du-site/',
      'pt': 'https://vitfix.io/pt/mapa-do-site/',
      'x-default': 'https://vitfix.io/fr/plan-du-site/',
    },
  },
  openGraph: {
    title: 'Plan du site VITFIX',
    description: 'Toutes nos pages services et villes en PACA.',
    type: 'website',
    url: 'https://vitfix.io/fr/plan-du-site/',
    siteName: 'VITFIX',
    locale: 'fr_FR',
  },
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
    { '@type': 'ListItem', position: 2, name: 'Plan du site', item: 'https://vitfix.io/fr/plan-du-site/' },
  ],
}

export default function PlanDuSitePage() {
  // Regroupe les combos service × ville par service pour navigation hiérarchique.
  const combos = getAllFrPageCombos()
  const combosByService = FR_SERVICES.map(service => ({
    service,
    combos: combos.filter(c => c.service.slug === service.slug),
  })).filter(g => g.combos.length > 0)

  return (
    <div className="min-h-screen bg-warm-gray py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
          <Link href="/fr/" className="hover:text-yellow transition">VITFIX</Link>
          <span className="mx-2">/</span>
          <span className="text-dark font-medium">Plan du site</span>
        </nav>

        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-dark mb-3">
          Plan du site
        </h1>
        <p className="text-text-muted mb-10 max-w-2xl">
          Toutes les pages VITFIX en France : services artisans, villes desservies, ressources et articles.
        </p>

        {/* ── Pages principales ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="font-display text-xl font-bold text-dark mb-5">Pages principales</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            <li><Link href="/fr/" className="text-dark/80 hover:text-yellow hover:underline">Accueil</Link></li>
            <li><Link href="/fr/recherche" className="text-dark/80 hover:text-yellow hover:underline">Recherche d&apos;artisans</Link></li>
            <li><Link href="/fr/services/" className="text-dark/80 hover:text-yellow hover:underline">Tous les services</Link></li>
            <li><Link href="/fr/urgence/" className="text-dark/80 hover:text-yellow hover:underline">Urgence 24/7</Link></li>
            <li><Link href="/fr/comment-ca-marche/" className="text-dark/80 hover:text-yellow hover:underline">Comment ça marche</Link></li>
            <li><Link href="/fr/artisans-verifies/" className="text-dark/80 hover:text-yellow hover:underline">Artisans vérifiés</Link></li>
            <li><Link href="/fr/devenir-partenaire/" className="text-dark/80 hover:text-yellow hover:underline">Devenir partenaire</Link></li>
            <li><Link href="/fr/a-propos/" className="text-dark/80 hover:text-yellow hover:underline">À propos</Link></li>
            <li><Link href="/fr/blog/" className="text-dark/80 hover:text-yellow hover:underline">Blog</Link></li>
            <li><Link href="/fr/copropriete/" className="text-dark/80 hover:text-yellow hover:underline">Syndics & copropriétés</Link></li>
            <li><Link href="/fr/simulateur-devis/" className="text-dark/80 hover:text-yellow hover:underline">Simulateur de devis</Link></li>
            <li><Link href="/fr/specialites/" className="text-dark/80 hover:text-yellow hover:underline">Spécialités</Link></li>
            <li><Link href="/fr/mentions-legales" className="text-dark/80 hover:text-yellow hover:underline">Mentions légales</Link></li>
            <li><Link href="/fr/cgu" className="text-dark/80 hover:text-yellow hover:underline">CGU</Link></li>
          </ul>
        </section>

        {/* ── Services × villes ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="font-display text-xl font-bold text-dark mb-2">Services par ville en PACA</h2>
          <p className="text-text-muted text-sm mb-6">
            {combosByService.reduce((sum, g) => sum + g.combos.length, 0)} combinaisons services × villes.
          </p>
          <div className="space-y-6">
            {combosByService.map(({ service, combos: serviceCombos }) => (
              <details key={service.slug} className="group rounded-xl border border-border/40 overflow-hidden" open={service.slug === 'plombier'}>
                <summary className="flex items-center justify-between gap-4 px-5 py-3 cursor-pointer list-none bg-warm-gray/40 font-semibold text-dark hover:bg-warm-gray transition select-none">
                  <span className="flex items-center gap-3">
                    <Link href={`/fr/pres-de-chez-moi/${service.slug}/`} className="hover:text-yellow hover:underline">
                      {service.name}
                    </Link>
                    <span className="text-xs text-text-muted">({serviceCombos.length} villes)</span>
                  </span>
                  <span className="text-yellow text-sm group-open:rotate-45 transition-transform">+</span>
                </summary>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 p-5 text-sm">
                  {serviceCombos.map(c => (
                    <li key={c.slug}>
                      <Link href={`/fr/services/${c.slug}/`} className="text-dark/80 hover:text-yellow hover:underline">
                        {service.name} à {c.city.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>

        {/* ── Villes ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="font-display text-xl font-bold text-dark mb-5">Villes desservies en PACA</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
            {FR_CITIES.map(city => (
              <li key={city.slug}>
                <Link href={`/fr/ville/${city.slug}/`} className="text-dark/80 hover:text-yellow hover:underline">
                  {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Blog ── */}
        {FR_BLOG_ARTICLES.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
            <h2 className="font-display text-xl font-bold text-dark mb-5">Articles du blog</h2>
            <ul className="space-y-2 text-sm">
              {FR_BLOG_ARTICLES.map(a => (
                <li key={a.slug}>
                  <Link href={`/fr/blog/${a.slug}/`} className="text-dark/80 hover:text-yellow hover:underline">
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Footer ── */}
        <p className="text-center text-xs text-text-muted mt-10">
          Vous cherchez le sitemap XML ? <a href="/sitemap.xml" className="hover:text-dark underline">/sitemap.xml</a>
        </p>
      </div>
    </div>
  )
}
