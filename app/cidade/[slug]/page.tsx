import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CITIES, SERVICES, BLOG_ARTICLES } from '@/lib/data/seo-pages-data'
import { PHONE_PT } from '@/lib/constants'

// ── Generate 8 static city pages ──
export function generateStaticParams() {
  return CITIES.map(c => ({ slug: c.slug }))
}

// ── Dynamic SEO metadata ──
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const city = CITIES.find(c => c.slug === slug)
  if (!city) return {}

  const title = `Serviços para Casa em ${city.name} — Eletricista, Canalizador, Pintor | VITFIX`
  const description = `Encontre profissionais verificados em ${city.name}: eletricista, canalizador, pintor e pladur. Orçamento grátis. Intervenção rápida em ${city.name} e freguesias.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'VITFIX',
      locale: 'pt_PT',
      type: 'website',
      images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `https://vitfix.io/pt/cidade/${slug}/`,
    },
  }
}

// ── Page Component ──
export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const city = CITIES.find(c => c.slug === slug)
  if (!city) notFound()

  const nearbyCities = city.nearby
    .map(ns => CITIES.find(c => c.slug === ns))
    .filter((c): c is typeof CITIES[number] => !!c)

  // Schema.org
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        name: `VITFIX — Serviços para Casa em ${city.name}`,
        description: `Profissionais verificados para eletricidade, canalização, pintura e pladur em ${city.name}.`,
        url: `https://vitfix.io/pt/cidade/${slug}/`,
        areaServed: {
          '@type': 'City',
          name: city.name,
          containedInPlace: { '@type': 'AdministrativeArea', name: `Distrito de ${city.distrito}` },
        },
        image: 'https://vitfix.io/logo.png',
        telephone: PHONE_PT,
        geo: {
          '@type': 'GeoCoordinates',
          latitude: city.lat,
          longitude: city.lng,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Cidades', item: 'https://vitfix.io/pt/servicos/' },
          { '@type': 'ListItem', position: 3, name: city.name, item: `https://vitfix.io/pt/cidade/${slug}/` },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO ── */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <Link href="/pt/servicos/" className="hover:text-yellow transition">Serviços</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">{city.name}</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span className="text-lg">📍</span>
            <span className="text-dark">{city.name} · Distrito de {city.distrito}</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Serviços para Casa em {city.name}
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            Encontre profissionais verificados para todas as necessidades da sua casa em {city.name} ({city.population.toLocaleString('pt-PT')} habitantes). Orçamento grátis e intervenção rápida.
          </p>

          <div className="flex flex-wrap gap-3 mb-10">
            <Link
              href="/pt/pesquisar/"
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              Encontrar profissional em {city.name}
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Profissionais verificados</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Orçamento grátis</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Serviço 7/7</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Resposta rápida</span>
          </div>
        </div>
      </section>

      {/* ── ALL SERVICES IN THIS CITY ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Serviços disponíveis em {city.name}
          </h2>
          <p className="text-text-muted mb-8 max-w-2xl">
            A VITFIX oferece profissionais qualificados em {city.name} para as seguintes especialidades:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SERVICES.map(service => (
              <Link
                key={service.slug}
                href={`/pt/servicos/${service.slug}-${city.slug}/`}
                className="p-6 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{service.icon}</span>
                  <h3 className="font-display font-bold text-lg text-dark group-hover:text-yellow transition-colors">
                    {service.name} em {city.name}
                  </h3>
                </div>
                <p className="text-text-muted text-sm leading-relaxed mb-4">{service.heroSubtitle}</p>
                <div className="flex flex-wrap gap-2">
                  {service.features.slice(0, 3).map((f, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-yellow/10 border border-yellow/25 text-dark">
                      {f}
                    </span>
                  ))}
                </div>
                <div className="mt-4">
                  <span className="text-yellow font-semibold text-sm">Ver mais →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── URGENCY SERVICES ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🚨</span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
              Urgências em {city.name}
            </h2>
          </div>
          <p className="text-text-muted mb-6 max-w-2xl">
            Precisa de um profissional urgente em {city.name}? Os nossos técnicos estão disponíveis para intervenções de emergência.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {SERVICES.slice(0, 6).map(service => (
              <Link
                key={service.slug}
                href={`/pt/urgencia/${service.slug}-urgente-${city.slug}/`}
                className="p-4 rounded-xl border border-red-200 bg-red-50/50 hover:border-red-400 hover:shadow-sm transition-all group text-center"
              >
                <span className="text-2xl block mb-2">{service.icon}</span>
                <span className="font-display font-bold text-sm text-dark group-hover:text-red-600 transition-colors">{service.name}</span>
                <span className="block text-xs text-red-500 font-semibold mt-1">Urgente →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICE GUIDES ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">💰</span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
              Tabela de preços em {city.name}
            </h2>
          </div>
          <p className="text-text-muted mb-6 max-w-2xl">
            Consulte os preços de referência para os principais serviços na região.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { slug: 'canalizador', name: 'Canalizador', icon: '🚿', range: '30 - 2500€' },
              { slug: 'eletricista', name: 'Eletricista', icon: '⚡', range: '30 - 1200€' },
              { slug: 'pintor', name: 'Pintor', icon: '🎨', range: '5 - 1500€' },
            ].map(guide => (
              <Link
                key={guide.slug}
                href={`/pt/precos/${guide.slug}/`}
                className="p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group"
              >
                <span className="text-3xl block mb-3">{guide.icon}</span>
                <h3 className="font-display font-bold text-dark group-hover:text-yellow transition-colors mb-1">Preços {guide.name}</h3>
                <span className="text-sm text-text-muted block mb-2">Faixa: {guide.range}</span>
                <span className="text-yellow font-semibold text-sm">Ver tabela →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FREGUESIAS ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Freguesias de {city.name}
          </h2>
          <p className="text-text-muted mb-6">
            Os nossos profissionais atuam em todas as {city.freguesias.length} freguesias do concelho de {city.name}:
          </p>
          <div className="flex flex-wrap gap-2 mb-8">
            {city.freguesias.map(f => (
              <span key={f} className="px-3 py-1.5 bg-warm-gray rounded-full text-sm text-dark/70 border border-border/30">{f}</span>
            ))}
          </div>

          <div className="mt-8 rounded-2xl p-6 md:p-8" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.06) 0%, rgba(255,214,0,0.12) 100%)' }}>
            <h3 className="font-display font-bold text-dark mb-2">Sobre {city.name}</h3>
            <p className="text-text-muted text-sm leading-relaxed">
              {city.name} é um concelho do distrito de {city.distrito} com uma população de {city.population.toLocaleString('pt-PT')} habitantes.
              A VITFIX oferece serviços de eletricidade, canalização, pintura e pladur em todo o concelho,
              incluindo as {city.freguesias.length} freguesias. Todos os nossos profissionais são verificados e oferecem orçamento gratuito.
            </p>
          </div>
        </div>
      </section>

      {/* ── NEARBY CITIES ── */}
      {nearbyCities.length > 0 && (
        <section className="py-14 md:py-18">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
              Cidades próximas de {city.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {nearbyCities.map(nc => (
                <Link
                  key={nc.slug}
                  href={`/pt/cidade/${nc.slug}/`}
                  className="p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group text-center"
                >
                  <span className="text-2xl block mb-2">📍</span>
                  <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{nc.name}</span>
                  <span className="block text-xs text-text-muted mt-1">{nc.population.toLocaleString('pt-PT')} habitantes</span>
                  <div className="mt-3 flex flex-wrap justify-center gap-1">
                    {SERVICES.map(s => (
                      <span key={s.slug} className="text-sm" title={s.name}>{s.icon}</span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── RELATED BLOG ARTICLES ── */}
      {BLOG_ARTICLES.length > 0 && (
        <section className="py-14 md:py-18 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
              Artigos úteis para a sua casa
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {BLOG_ARTICLES.slice(0, 6).map(article => (
                <Link
                  key={article.slug}
                  href={`/pt/blog/${article.slug}/`}
                  className="p-5 rounded-2xl border border-border/50 hover:border-yellow hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{article.icon}</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-yellow">{article.category}</span>
                  </div>
                  <h3 className="font-display font-bold text-dark group-hover:text-yellow transition-colors mb-2 text-[0.93rem]">{article.title}</h3>
                  <p className="text-sm text-text-muted line-clamp-2 leading-relaxed">{article.intro}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BOTTOM CTA ── */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Precisa de um profissional em {city.name}?
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Encontre profissionais verificados perto de si em poucos cliques. Orçamento grátis, sem compromisso.
          </p>
          <Link
            href="/pt/pesquisar/"
            className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
          >
            Encontrar profissional agora
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </section>
    </div>
  )
}
