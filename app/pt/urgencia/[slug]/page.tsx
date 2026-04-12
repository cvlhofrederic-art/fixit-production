import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllUrgencyCombos, getUrgencyCombo, SERVICES, BLOG_ARTICLES } from '@/lib/data/seo-pages-data'
import { PHONE_PT } from '@/lib/constants'

// ── Generate all 32 urgency pages (4 services × 8 cities) ──
export function generateStaticParams() {
  return getAllUrgencyCombos().map(p => ({ slug: p.slug }))
}

// ── Dynamic SEO metadata ──
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const combo = getUrgencyCombo(slug)
  if (!combo) return {}

  const title = combo.service.urgency.metaTitle.replace(/{city}/g, combo.city.name)
  const description = combo.service.urgency.metaDesc.replace(/{city}/g, combo.city.name)

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
      canonical: `https://vitfix.io/pt/urgencia/${slug}/`,
      languages: {
        'pt': `https://vitfix.io/pt/urgencia/${slug}/`,
        'fr': 'https://vitfix.io/fr/urgence/',
        'en': 'https://vitfix.io/en/',
        'x-default': `https://vitfix.io/pt/urgencia/${slug}/`,
      },
    },
  }
}

// ── Page Component ──
export default async function UrgencyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const combo = getUrgencyCombo(slug)
  if (!combo) notFound()

  const { service, city, nearbyCities } = combo
  const replaceCity = (text: string) => text.replace(/\{city\}/g, city.name)
  const urgency = service.urgency
  const heroTitle = replaceCity(urgency.heroTitle)
  const heroSubtitle = replaceCity(urgency.heroSubtitle)
  const relatedArticles = BLOG_ARTICLES.filter(a => a.relatedServices.includes(service.slug)).slice(0, 3)

  // Schema.org — Emergency Service + FAQPage
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EmergencyService',
        name: `VITFIX - ${service.name} Urgente em ${city.name}`,
        description: urgency.metaDesc.replace(/{city}/g, city.name),
        url: `https://vitfix.io/pt/urgencia/${slug}/`,
        areaServed: {
          '@type': 'City',
          name: city.name,
          containedInPlace: { '@type': 'AdministrativeArea', name: `Distrito de ${city.distrito}` },
        },
        availableChannel: {
          '@type': 'ServiceChannel',
          serviceType: `${service.name} de urgência`,
          availableLanguage: 'Português',
        },
        hoursAvailable: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: '00:00',
          closes: '23:59',
        },
        image: 'https://vitfix.io/logo.png',
        telephone: PHONE_PT,
        address: {
          '@type': 'PostalAddress',
          addressLocality: city.name,
          addressRegion: city.distrito,
          addressCountry: 'PT',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: city.lat,
          longitude: city.lng,
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          reviewCount: '127',
          bestRating: '5',
          worstRating: '1',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Urgência', item: 'https://vitfix.io/pt/urgencia/' },
          { '@type': 'ListItem', position: 3, name: `${service.name} Urgente em ${city.name}`, item: `https://vitfix.io/pt/urgencia/${slug}/` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: service.faqs.map(faq => ({
          '@type': 'Question',
          name: replaceCity(faq.question),
          acceptedAnswer: { '@type': 'Answer', text: replaceCity(faq.answer) },
        })),
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO URGENCE ── */}
      <section className="relative overflow-hidden pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 30%, #FFCC80 100%)' }}>
        <div className="absolute top-0 right-0 w-60 h-60 bg-yellow/20 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-yellow/10 rounded-full translate-y-1/2 -translate-x-1/3" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-dark/60">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <Link href="/pt/urgencia/" className="hover:text-yellow transition">Urgência</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">{service.name} em {city.name}</span>
          </nav>

          {/* Urgency badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/25 text-sm font-bold mb-5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-red-700">URGÊNCIA — {urgency.availableSchedule}</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            {heroTitle}
          </h1>
          <p className="text-lg text-dark/70 max-w-2xl mb-8 leading-relaxed">
            {heroSubtitle}
          </p>

          {/* CTAs urgence */}
          <div className="flex flex-wrap gap-3 mb-10">
            <Link
              href="/pt/pesquisar/"
              className="inline-flex items-center gap-2 bg-red-600 text-white font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:bg-red-700 hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(220,38,38,0.3)]"
            >
              <span className="text-lg">🚨</span>
              Pedir ajuda agora
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 border-2 border-dark text-dark rounded-full font-bold px-7 py-3.5 text-[0.95rem] bg-white/80 hover:bg-dark hover:text-white transition-all"
            >
              Contactar-nos
            </Link>
          </div>

          {/* Tempo de resposta */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 bg-white/80 rounded-full px-4 py-2">
              <span className="text-yellow font-bold">⚡</span>
              <span className="text-dark">Tempo médio de resposta: <strong>{urgency.avgResponseTime}</strong></span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 rounded-full px-4 py-2">
              <span className="text-yellow font-bold">📍</span>
              <span className="text-dark">{city.name} e {city.freguesias.length} freguesias</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── O QUE FAZER IMEDIATAMENTE ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            O que fazer imediatamente?
          </h2>
          <p className="text-text-muted mb-8 max-w-2xl">
            Siga estes passos enquanto espera pelo profissional VITFIX:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {urgency.immediateSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-white rounded-xl border border-border/50">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold mt-0.5">
                  {i + 1}
                </span>
                <span className="text-[0.93rem] text-dark leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUANDO CHAMAR ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Quando chamar um {service.name.toLowerCase()} de urgência?
          </h2>
          <p className="text-text-muted mb-8 max-w-2xl">
            Estas situações requerem intervenção profissional imediata em {city.name}:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {urgency.whenToCall.map((situation, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl border-2 border-red-100 bg-red-50/50 hover:border-red-200 transition-colors">
                <span className="flex-shrink-0 text-red-500 text-lg mt-0.5">⚠️</span>
                <span className="text-[0.93rem] text-dark font-medium">{situation}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES COMPLETS ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            Os nossos serviços de {service.name.toLowerCase()} em {city.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {service.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-white rounded-xl border border-border/50">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold mt-0.5">✓</span>
                <span className="text-[0.93rem] text-dark leading-relaxed">{feature}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`/pt/servicos/${service.slug}-${city.slug}/`}
              className="text-yellow font-semibold hover:underline"
            >
              Ver todos os serviços de {service.name.toLowerCase()} em {city.name} →
            </Link>
            {['canalizador', 'eletricista', 'pintor'].includes(service.slug) && (
              <Link
                href={`/pt/precos/${service.slug}/`}
                className="text-text-muted font-semibold hover:text-dark hover:underline transition"
              >
                💰 Ver tabela de preços →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── ZONA DE COBERTURA ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Cobertura de urgência — {city.name}
          </h2>
          <p className="text-text-muted mb-6">
            Os nossos {service.name.toLowerCase()}s de urgência atuam em {city.name} ({city.population.toLocaleString('pt-PT')} habitantes) e em todas as suas freguesias:
          </p>
          <div className="flex flex-wrap gap-2 mb-10">
            {city.freguesias.map(f => (
              <span key={f} className="px-3 py-1.5 bg-warm-gray rounded-full text-sm text-dark/70 border border-border/30">{f}</span>
            ))}
          </div>

          {/* Urgência noutras cidades */}
          {nearbyCities.length > 0 && (
            <>
              <h3 className="font-display text-xl font-bold mb-4">{service.name} urgente noutras cidades</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {nearbyCities.map(nc => (
                  <Link
                    key={nc.slug}
                    href={`/pt/urgencia/${service.slug}-urgente-${nc.slug}/`}
                    className="flex items-center gap-3 p-4 rounded-xl border-2 border-yellow/20 hover:border-yellow hover:bg-yellow/5 transition-all group"
                  >
                    <span className="text-xl">🚨</span>
                    <div>
                      <span className="font-semibold text-dark group-hover:text-yellow transition-colors">{service.name} urgente em {nc.name}</span>
                      <span className="block text-xs text-text-muted">{nc.population.toLocaleString('pt-PT')} hab.</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Perguntas frequentes — {service.name} urgente
          </h2>
          <div className="space-y-4 mt-8">
            {service.faqs.map((faq, i) => (
              <details key={i} className="group rounded-2xl border border-border/50 bg-white overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                  <span className="text-[0.95rem]">{replaceCity(faq.question)}</span>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">
                  {replaceCity(faq.answer)}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── RELATED BLOG ── */}
      {relatedArticles.length > 0 && (
        <section className="py-14 md:py-18 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-xl font-bold text-dark mb-6">Artigos relacionados</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedArticles.map(a => (
                <Link
                  key={a.slug}
                  href={`/pt/blog/${a.slug}/`}
                  className="p-5 rounded-2xl border border-border/50 hover:border-yellow hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{a.icon}</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-yellow">{a.category}</span>
                  </div>
                  <h3 className="font-semibold text-dark group-hover:text-yellow transition-colors text-[0.93rem]">{a.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── OTHER URGENCY SERVICES ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
            Outros serviços de urgência em {city.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SERVICES.filter(s => s.slug !== service.slug).map(os => (
              <Link
                key={os.slug}
                href={`/pt/urgencia/${os.slug}-urgente-${city.slug}/`}
                className="p-6 bg-white rounded-2xl border-2 border-yellow/20 hover:border-yellow hover:shadow-md transition-all group text-center"
              >
                <span className="text-3xl block mb-3">{os.icon}</span>
                <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{os.name} Urgente</span>
                <span className="block text-sm text-text-muted mt-1">em {city.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-16 md:py-20" style={{ background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-4xl block mb-4">🚨</span>
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Urgência em {city.name}? Estamos disponíveis agora!
          </h2>
          <p className="text-dark/70 mb-8 max-w-md mx-auto">
            {urgency.availableSchedule}. Profissionais verificados, intervenção rápida.
          </p>
          <Link
            href="/pt/pesquisar/"
            className="inline-flex items-center gap-2 bg-red-600 text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-red-700 hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(220,38,38,0.3)]"
          >
            Encontrar {service.name.toLowerCase()} urgente agora
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </section>
    </div>
  )
}
