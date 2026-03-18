import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FR_BLOG_ARTICLES, getFrBlogArticle } from '@/lib/data/fr-blog-data'

// ── Generate static pages for all FR blog articles ──
export function generateStaticParams() {
  return FR_BLOG_ARTICLES.map(a => ({ slug: a.slug }))
}

// ── Dynamic SEO metadata ──
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = getFrBlogArticle(slug)
  if (!article) return {}

  return {
    title: article.metaTitle,
    description: article.metaDesc,
    openGraph: {
      title: article.metaTitle,
      description: article.metaDesc,
      siteName: 'VITFIX',
      locale: 'fr_FR',
      type: 'article',
      images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.metaTitle,
      description: article.metaDesc,
    },
    alternates: {
      canonical: `https://vitfix.io/fr/blog/${slug}/`,
    },
  }
}

// ── Page Component ──
export default async function FrBlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getFrBlogArticle(slug)
  if (!article) notFound()

  // Other articles for "related"
  const relatedArticles = FR_BLOG_ARTICLES
    .filter(a => a.slug !== slug && a.relatedServices.some(rs => article.relatedServices.includes(rs)))
    .slice(0, 3)

  // Map service slugs to display names
  const serviceNames: Record<string, { name: string; icon: string }> = {
    plomberie: { name: 'Plomberie', icon: '🔧' },
    electricite: { name: 'Électricité', icon: '⚡' },
    peinture: { name: 'Peinture', icon: '🎨' },
    plaquiste: { name: 'Plaquiste', icon: '🏗️' },
  }

  // Schema.org Article + FAQPage
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: article.title,
        description: article.metaDesc,
        url: `https://vitfix.io/fr/blog/${slug}/`,
        publisher: {
          '@type': 'Organization',
          name: 'VITFIX',
          url: 'https://vitfix.io',
          logo: { '@type': 'ImageObject', url: 'https://vitfix.io/og-image.png' },
        },
        mainEntityOfPage: `https://vitfix.io/fr/blog/${slug}/`,
        datePublished: article.datePublished,
        dateModified: article.datePublished,
        author: {
          '@type': 'Organization',
          name: 'VITFIX',
          url: 'https://vitfix.io',
        },
        image: 'https://vitfix.io/og-image.png',
        inLanguage: 'fr-FR',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://vitfix.io/blog/' },
          { '@type': 'ListItem', position: 3, name: article.title, item: `https://vitfix.io/fr/blog/${slug}/` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: article.sections.slice(0, 5).map(section => ({
          '@type': 'Question',
          name: section.heading,
          acceptedAnswer: {
            '@type': 'Answer',
            text: section.content,
          },
        })),
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HEADER ── */}
      <section className="pt-16 pb-10 md:pt-20 md:pb-14 bg-white border-b border-border/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-text-muted">
            <Link href="/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <Link href="/blog/" className="hover:text-yellow transition">Blog</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">{article.title}</span>
          </nav>

          {/* Category badge + date */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold">
              <span>{article.icon}</span>
              <span className="text-dark">{article.category}</span>
            </span>
            <time dateTime={article.datePublished} className="text-sm text-text-muted">
              {article.date}
            </time>
          </div>

          <h1 className="font-display text-[clamp(1.8rem,4vw,2.8rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-5">
            {article.title}
          </h1>

          <p className="text-lg text-text-muted leading-relaxed">
            {article.intro}
          </p>
        </div>
      </section>

      {/* ── ARTICLE BODY ── */}
      <article className="py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-10">
            {article.sections.map((section, i) => (
              <section key={i}>
                <h2 className="font-display text-xl md:text-2xl font-bold text-dark mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-yellow/15 flex items-center justify-center text-sm font-bold text-yellow flex-shrink-0">
                    {i + 1}
                  </span>
                  {section.heading}
                </h2>
                <div className="pl-10">
                  <p className="text-[0.95rem] text-dark/80 leading-[1.75]">{section.content}</p>
                </div>
              </section>
            ))}
          </div>

          {/* ── CTA BOX ── */}
          <div className="mt-14 rounded-2xl p-8 md:p-10 text-center" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, rgba(255,214,0,0.15) 100%)' }}>
            <span className="text-3xl block mb-3">{article.icon}</span>
            <p className="font-display font-bold text-lg text-dark mb-4">{article.ctaText}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {article.relatedServices.map(sSlug => {
                const svc = serviceNames[sSlug]
                if (!svc) return null
                return (
                  <Link
                    key={sSlug}
                    href={`/fr/services/${sSlug}-marseille/`}
                    className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-6 py-3 text-[0.9rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
                  >
                    {svc.icon} {svc.name} à Marseille
                  </Link>
                )
              })}
            </div>
            <p className="text-sm text-text-muted mt-4">
              {'Également disponible à '}
              {['Aix-en-Provence', 'Aubagne', 'La Ciotat', 'Cassis'].map((c, i) => (
                <span key={c}>
                  {i > 0 && ', '}
                  <Link href={`/fr/services/${article.relatedServices[0]}-${c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '-')}/`} className="text-yellow hover:underline">
                    {c}
                  </Link>
                </span>
              ))}
            </p>
          </div>

          {/* ── LOCAL SERVICE LINKS (SEO cross-linking) ── */}
          <div className="mt-12 p-6 bg-white rounded-2xl border border-border/50">
            <h3 className="font-display font-bold text-dark mb-4">Besoin d&apos;un artisan dans votre ville ?</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {['marseille', 'aix-en-provence', 'aubagne', 'la-ciotat', 'cassis', 'martigues'].map(citySlug => (
                article.relatedServices.slice(0, 2).map(sSlug => {
                  const svc = serviceNames[sSlug]
                  if (!svc) return null
                  const cityName = citySlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                  return (
                    <Link
                      key={`${sSlug}-${citySlug}`}
                      href={`/fr/services/${sSlug}-${citySlug}/`}
                      className="text-sm text-text-muted hover:text-yellow transition p-2 rounded-lg hover:bg-yellow/5"
                    >
                      {svc.icon} {svc.name} {cityName}
                    </Link>
                  )
                })
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* ── RELATED ARTICLES ── */}
      {relatedArticles.length > 0 && (
        <section className="py-14 bg-white border-t border-border/30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-xl font-bold text-dark mb-6">Articles similaires</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedArticles.map(a => (
                <Link
                  key={a.slug}
                  href={`/fr/blog/${a.slug}/`}
                  className="p-5 rounded-2xl border border-border/50 hover:border-yellow hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{a.icon}</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-yellow">
                      {a.category}
                    </span>
                  </div>
                  <h3 className="font-semibold text-dark group-hover:text-yellow transition-colors text-[0.93rem]">{a.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
