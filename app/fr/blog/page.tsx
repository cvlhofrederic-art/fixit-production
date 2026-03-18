import type { Metadata } from 'next'
import Link from 'next/link'
import { FR_BLOG_ARTICLES } from '@/lib/data/fr-blog-data'

export const metadata: Metadata = {
  title: 'Blog Vitfix — Conseils travaux et guides pratiques',
  description: 'Conseils, guides et actualités sur les travaux et la rénovation par Vitfix. Choisir un artisan, devis, normes, aides financières.',
  openGraph: {
    title: 'Blog Vitfix — Conseils travaux',
    description: 'Guides pratiques et actualités pour votre habitat.',
    siteName: 'VITFIX',
    locale: 'fr_FR',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  alternates: {
    canonical: 'https://vitfix.io/fr/blog/',
    languages: { 'fr': 'https://vitfix.io/fr/blog/', 'pt': 'https://vitfix.io/pt/blog/' },
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      name: 'Blog Vitfix — Conseils travaux et guides pratiques',
      description: 'Guides pratiques et actualités pour votre habitat.',
      url: 'https://vitfix.io/fr/blog/',
      inLanguage: 'fr-FR',
      publisher: { '@type': 'Organization', name: 'VITFIX', url: 'https://vitfix.io' },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: FR_BLOG_ARTICLES.length,
        itemListElement: FR_BLOG_ARTICLES.map((a, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `https://vitfix.io/fr/blog/${a.slug}/`,
          name: a.title,
        })),
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://vitfix.io/fr/blog/' },
      ],
    },
  ],
}

export default function FrBlogPage() {
  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO ── */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-text-muted">
            <Link href="/fr/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Blog</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-4">
            <span>📝</span>
            <span className="text-dark">Blog VITFIX</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Le blog Vitfix
          </h1>
          <p className="text-lg text-text-muted max-w-2xl leading-relaxed">
            Conseils travaux, guides pratiques et actualités pour votre habitat. Rédigés par nos experts.
          </p>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="bg-dark text-white py-5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: `${FR_BLOG_ARTICLES.length}+`, label: 'Articles publiés' },
              { value: '5', label: 'Catégories' },
              { value: '100%', label: 'Contenu gratuit' },
              { value: '2026', label: 'Mis à jour' },
            ].map(stat => (
              <div key={stat.label}>
                <span className="font-display text-2xl md:text-3xl font-extrabold text-yellow">{stat.value}</span>
                <span className="block text-sm text-white/70 mt-0.5">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED ARTICLE ── */}
      {FR_BLOG_ARTICLES.length > 0 && (
        <section className="py-14 md:py-18">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link
              href={`/fr/blog/${FR_BLOG_ARTICLES[0].slug}/`}
              className="group block bg-white rounded-2xl border border-border/50 overflow-hidden hover:border-yellow hover:shadow-lg transition-all"
            >
              <div className="grid md:grid-cols-2">
                <div className="bg-gradient-to-br from-yellow/5 via-warm-gray to-white p-10 md:p-14 flex items-center justify-center">
                  <span className="text-7xl md:text-8xl group-hover:scale-110 transition-transform">{FR_BLOG_ARTICLES[0].icon}</span>
                </div>
                <div className="p-8 md:p-10 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-yellow text-dark text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      À la une
                    </span>
                    <span className="bg-yellow/10 border border-yellow/25 text-dark text-xs font-semibold px-2.5 py-1 rounded-full">
                      {FR_BLOG_ARTICLES[0].category}
                    </span>
                  </div>
                  <h2 className="font-display text-2xl md:text-3xl font-extrabold text-dark mb-3 group-hover:text-yellow transition-colors leading-tight">
                    {FR_BLOG_ARTICLES[0].title}
                  </h2>
                  <p className="text-text-muted leading-relaxed mb-6">{FR_BLOG_ARTICLES[0].intro}</p>
                  <span className="inline-flex items-center gap-2 text-yellow font-display font-bold text-sm group-hover:gap-3 transition-all">
                    Lire l&apos;article complet
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* ── ALL ARTICLES GRID ── */}
      <section className="pb-14 md:pb-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-2xl">📚</span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
              Tous les articles
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FR_BLOG_ARTICLES.slice(1).map((article) => (
              <Link
                key={article.slug}
                href={`/fr/blog/${article.slug}/`}
                className="group bg-white rounded-2xl border border-border/50 overflow-hidden hover:border-yellow hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="bg-gradient-to-br from-yellow/5 via-warm-gray to-white p-8 text-center">
                  <span className="text-5xl group-hover:scale-110 transition-transform inline-block">{article.icon}</span>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-yellow/10 border border-yellow/25 text-dark text-xs font-semibold px-2.5 py-1 rounded-full">
                      {article.category}
                    </span>
                    <span className="text-text-muted text-xs">{article.date}</span>
                  </div>
                  <h2 className="font-display font-bold text-dark mb-2 group-hover:text-yellow transition-colors leading-snug">
                    {article.title}
                  </h2>
                  <p className="text-text-muted text-sm leading-relaxed line-clamp-3">{article.intro}</p>
                  <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
                    <span className="text-sm font-semibold text-yellow">Lire la suite</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-yellow"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ── */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Besoin d&apos;un artisan maintenant ?
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Trouvez des artisans vérifiés près de chez vous pour tous vos travaux.
          </p>
          <Link
            href="/recherche"
            className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
          >
            Trouver un artisan près de chez moi
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </section>
    </div>
  )
}
