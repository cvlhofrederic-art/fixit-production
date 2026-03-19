import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BLOG_ARTICLES, getBlogArticle, SERVICES, CITIES } from '@/lib/data/seo-pages-data'

// ── Generate static pages for all blog articles ──
export function generateStaticParams() {
  return BLOG_ARTICLES.map(a => ({ slug: a.slug }))
}

// ── Dynamic SEO metadata ──
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = getBlogArticle(slug)
  if (!article) return {}

  return {
    title: article.metaTitle,
    description: article.metaDesc,
    openGraph: {
      title: article.metaTitle,
      description: article.metaDesc,
      siteName: 'VITFIX',
      locale: 'pt_PT',
      type: 'article',
      images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.metaTitle,
      description: article.metaDesc,
    },
    alternates: {
      canonical: `https://vitfix.io/pt/blog/${slug}/`,
    },
  }
}

const categoryLabel = (cat: string) => {
  switch (cat) {
    case 'eletricidade': return 'Eletricidade'
    case 'canalizacao': return 'Canalização'
    case 'pintura': return 'Pintura'
    case 'pladur': return 'Pladur'
    case 'obras': return 'Obras e Remodelação'
    case 'isolamento': return 'Isolamento Térmico'
    case 'impermeabilizacao': return 'Impermeabilização'
    case 'desentupimento': return 'Desentupimento'
    case 'manutencao': return 'Manutenção e Reparações'
    default: return cat
  }
}

// ── Page Component ──
export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getBlogArticle(slug)
  if (!article) notFound()

  // Related services for CTA links
  const relatedServiceData = article.relatedServices
    .map(sSlug => SERVICES.find(s => s.slug === sSlug))
    .filter(Boolean)

  // Other articles in same category
  const relatedArticles = BLOG_ARTICLES
    .filter(a => a.slug !== slug && a.relatedServices.some(rs => article.relatedServices.includes(rs)))
    .slice(0, 3)

  // Estimated read time (rough: 200 words per minute)
  const totalWords = article.sections.reduce((acc, s) => acc + s.content.split(' ').length + s.heading.split(' ').length, 0) + article.intro.split(' ').length
  const readTime = Math.max(3, Math.ceil(totalWords / 200))

  // Schema.org Article
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: article.title,
        description: article.metaDesc,
        url: `https://vitfix.io/pt/blog/${slug}/`,
        publisher: {
          '@type': 'Organization',
          name: 'VITFIX',
          url: 'https://vitfix.io',
          logo: { '@type': 'ImageObject', url: 'https://vitfix.io/logo.png' },
        },
        mainEntityOfPage: `https://vitfix.io/pt/blog/${slug}/`,
        datePublished: article.datePublished,
        dateModified: article.datePublished,
        author: {
          '@type': 'Organization',
          name: 'VITFIX',
          url: 'https://vitfix.io',
        },
        image: 'https://vitfix.io/og-image.png',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://vitfix.io/pt/blog/' },
          { '@type': 'ListItem', position: 3, name: article.title, item: `https://vitfix.io/pt/blog/${slug}/` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: article.sections.slice(0, 5).map(section => ({
          '@type': 'Question',
          name: section.heading,
          acceptedAnswer: {
            '@type': 'Answer',
            text: section.content.slice(0, 300) + '...',
          },
        })),
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO HEADER ── */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <Link href="/pt/blog/" className="hover:text-yellow transition">Blog</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium line-clamp-1">{article.title}</span>
          </nav>

          {/* Category badge + date + read time */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold">
              <span>{article.icon}</span>
              <span className="text-dark">{categoryLabel(article.category)}</span>
            </span>
            <time dateTime={article.datePublished} className="text-sm text-text-muted">
              {new Date(article.datePublished).toLocaleDateString('pt-PT', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
            <span className="text-sm text-text-muted flex items-center gap-1">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              {readTime} min de leitura
            </span>
          </div>

          <h1 className="font-display text-[clamp(1.8rem,4vw,2.8rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-5">
            {article.title}
          </h1>

          <p className="text-lg text-text-muted leading-relaxed">
            {article.intro}
          </p>

          {/* Author bar */}
          <div className="mt-8 flex items-center gap-3 pt-6 border-t border-border/30">
            <div className="w-10 h-10 rounded-full bg-yellow/15 flex items-center justify-center">
              <span className="font-display font-bold text-yellow text-sm">VF</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-dark block">Equipa VITFIX</span>
              <span className="text-xs text-text-muted">Especialistas em serviços domésticos</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── TABLE OF CONTENTS (for longer articles) ── */}
      {article.sections.length > 3 && (
        <section className="bg-white border-y border-border/30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <details className="group">
              <summary className="cursor-pointer flex items-center gap-2 font-display font-bold text-dark text-sm select-none">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-yellow group-open:rotate-90 transition-transform"><path d="M9 18l6-6-6-6"/></svg>
                Índice do artigo ({article.sections.length} secções)
              </summary>
              <ol className="mt-4 ml-6 space-y-2">
                {article.sections.map((section, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow/15 flex items-center justify-center text-xs font-bold text-yellow mt-0.5">{i + 1}</span>
                    <span className="text-text-muted">{section.heading}</span>
                  </li>
                ))}
              </ol>
            </details>
          </div>
        </section>
      )}

      {/* ── ARTICLE BODY ── */}
      <article className="py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-10">
            {article.sections.map((section, i) => (
              <section key={i} className="group">
                <h2 className="font-display text-xl md:text-2xl font-bold text-dark mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-yellow/15 flex items-center justify-center text-sm font-bold text-yellow shadow-sm">
                    {i + 1}
                  </span>
                  {section.heading}
                </h2>
                <div className="pl-12">
                  <p className="text-[0.95rem] text-dark/80 leading-[1.8]">{section.content}</p>
                </div>
              </section>
            ))}
          </div>

          {/* ── KEY TAKEAWAYS ── */}
          <div className="mt-14 bg-white rounded-2xl border border-border/50 p-6 md:p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">💡</span>
              <h3 className="font-display font-bold text-dark">Pontos-chave deste artigo</h3>
            </div>
            <ul className="space-y-3">
              {article.sections.slice(0, 4).map((section, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold mt-0.5">✓</span>
                  <span className="text-[0.93rem] text-dark leading-relaxed">{section.heading}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── CTA BOX ── */}
          <div className="mt-10 rounded-2xl p-8 md:p-10 text-center" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, rgba(255,214,0,0.18) 100%)' }}>
            <span className="text-4xl block mb-3">{article.icon}</span>
            <p className="font-display font-bold text-xl text-dark mb-2">{article.ctaText}</p>
            <p className="text-sm text-text-muted mb-6">Profissionais verificados na região do Tâmega e Sousa</p>
            <div className="flex flex-wrap justify-center gap-3">
              {relatedServiceData.map(s => s && (
                <Link
                  key={s.slug}
                  href={`/pt/servicos/${s.slug}-marco-de-canaveses/`}
                  className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-6 py-3 text-[0.9rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
                >
                  {s.icon} {s.name} em Marco de Canaveses
                </Link>
              ))}
            </div>
            <p className="text-sm text-text-muted mt-5">
              {'Também disponível em '}
              {['Penafiel', 'Amarante', 'Baião', 'Felgueiras'].map((c, i) => (
                <span key={c}>
                  {i > 0 && ', '}
                  <Link href={`/pt/servicos/${article.relatedServices[0]}-${c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '-')}/`} className="text-yellow hover:underline font-medium">
                    {c}
                  </Link>
                </span>
              ))}
            </p>
          </div>

          {/* ── LOCAL SERVICE LINKS (SEO internal links) ── */}
          <div className="mt-10 bg-white rounded-2xl border border-border/50 p-6 md:p-8">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">📍</span>
              <h3 className="font-display font-bold text-dark">Precisa de um profissional na sua zona?</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {CITIES.slice(0, 4).map(city => (
                relatedServiceData.map(s => s && (
                  <Link
                    key={`${s.slug}-${city.slug}`}
                    href={`/pt/servicos/${s.slug}-${city.slug}/`}
                    className="flex items-center gap-2 text-sm text-text-muted hover:text-yellow transition p-3 rounded-xl hover:bg-yellow/5 border border-transparent hover:border-yellow/20"
                  >
                    <span>{s.icon}</span>
                    <span>{s.name} {city.name}</span>
                  </Link>
                ))
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* ── RELATED ARTICLES ── */}
      {relatedArticles.length > 0 && (
        <section className="py-14 md:py-18 bg-white border-t border-border/30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-8">
              <span className="text-2xl">📚</span>
              <h2 className="font-display text-xl md:text-2xl font-bold text-dark">Artigos relacionados</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {relatedArticles.map(a => (
                <Link
                  key={a.slug}
                  href={`/pt/blog/${a.slug}/`}
                  className="group bg-warm-gray rounded-2xl border border-border/50 overflow-hidden hover:border-yellow hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="bg-gradient-to-br from-yellow/5 via-warm-gray to-white p-6 text-center">
                    <span className="text-4xl group-hover:scale-110 transition-transform inline-block">{a.icon}</span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-yellow bg-yellow/10 px-2 py-0.5 rounded-full">
                        {categoryLabel(a.category)}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-dark group-hover:text-yellow transition-colors text-[0.93rem] leading-snug mb-2">{a.title}</h3>
                    <p className="text-text-muted text-xs leading-relaxed line-clamp-2">{a.intro}</p>
                    <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
                      <span className="text-xs font-semibold text-yellow">Ler mais</span>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-yellow"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BACK TO BLOG CTA ── */}
      <section className="py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link
            href="/pt/blog/"
            className="inline-flex items-center gap-2 text-text-muted hover:text-yellow font-display font-semibold transition"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Voltar ao blog
          </Link>
        </div>
      </section>
    </div>
  )
}
