import type { Metadata } from 'next'
import Link from 'next/link'
import { SERVICES, CITIES, getAllUrgencyCombos } from '@/lib/data/seo-pages-data'
import { PHONE_PT } from '@/lib/constants'

// ── Static SEO metadata ──
export const metadata: Metadata = {
  title: 'Serviços de Urgência — Eletricista, Canalizador, Obras Urgentes | VITFIX',
  description:
    'Serviços de urgência 24h: eletricista, canalizador, pintor, pladur e obras urgentes em Marco de Canaveses, Penafiel, Amarante e região. Intervenção rápida 7/7. Ligue agora!',
  openGraph: {
    title: 'Serviços de Urgência — Eletricista, Canalizador, Obras Urgentes | VITFIX',
    description:
      'Serviços de urgência 24h: eletricista, canalizador, pintor, pladur e obras urgentes em Marco de Canaveses, Penafiel, Amarante e região. Intervenção rápida 7/7.',
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630, alt: 'VITFIX Serviços de Urgência' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Serviços de Urgência — VITFIX',
    description:
      'Eletricista, canalizador, pintor, pladur e obras urgentes. Intervenção rápida 24h em Marco de Canaveses e região.',
    images: ['https://vitfix.io/og-image.png'],
  },
  alternates: {
    canonical: 'https://vitfix.io/pt/urgencia/',
    languages: {
      'pt': 'https://vitfix.io/pt/urgencia/',
      'fr': 'https://vitfix.io/fr/urgence/',
      'x-default': 'https://vitfix.io/pt/urgencia/',
    },
  },
}

// ── "Como funciona" steps ──
const STEPS = [
  {
    number: '1',
    icon: '📞',
    title: 'Ligue',
    description: 'Contacte-nos por telefone ou através do site. Descrevemos a situação e enviamos um profissional imediatamente.',
  },
  {
    number: '2',
    icon: '🔍',
    title: 'Diagnóstico',
    description: 'O profissional avalia a situação no local, identifica o problema e apresenta um orçamento antes de iniciar.',
  },
  {
    number: '3',
    icon: '🔧',
    title: 'Intervenção',
    description: 'Reparação rápida e eficaz com materiais de qualidade. Garantia no trabalho realizado.',
  },
]

// ── Page Component ──
export default function UrgenciaHubPage() {
  const allCombos = getAllUrgencyCombos()

  // Schema.org — CollectionPage + BreadcrumbList
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Serviços de Urgência — VITFIX',
        description:
          'Todos os serviços de urgência VITFIX: eletricista, canalizador, pintor, pladur e obras urgentes disponíveis 24h em Marco de Canaveses, Penafiel, Amarante e região.',
        url: 'https://vitfix.io/pt/urgencia/',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: allCombos.length,
          itemListElement: SERVICES.map((service, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: `${service.name} Urgente`,
            url: `https://vitfix.io/pt/urgencia/${service.slug}-urgente-${CITIES[0].slug}/`,
          })),
        },
        provider: {
          '@type': 'Organization',
          name: 'VITFIX',
          url: 'https://vitfix.io',
          logo: 'https://vitfix.io/logo.png',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Urgência', item: 'https://vitfix.io/pt/urgencia/' },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden pt-16 pb-14 md:pt-20 md:pb-18"
        style={{ background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 30%, #FFCC80 100%)' }}
      >
        <div className="absolute top-0 right-0 w-60 h-60 bg-yellow/20 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-yellow/10 rounded-full translate-y-1/2 -translate-x-1/3" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-dark/60">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Urgência</span>
          </nav>

          {/* Urgency badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/25 text-sm font-bold mb-5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-red-700">URGÊNCIA — Disponível 24h, 7/7</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Serviços de Urgência
          </h1>
          <p className="text-lg text-dark/70 max-w-2xl mb-8 leading-relaxed">
            Emergência em casa? Os nossos profissionais verificados intervêm rapidamente em Marco de Canaveses, Penafiel, Amarante e toda a região do Tâmega e Sousa — 24 horas por dia, 7 dias por semana.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 mb-10">
            <a
              href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=URGÊNCIA!%20Preciso%20de%20ajuda%20agora.%20Podem%20vir%20rapidamente%3F`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:-translate-y-0.5 transition-all"
              style={{ background: '#25D366', boxShadow: '0 6px 20px rgba(37,211,102,0.4)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp — Resposta imediata
            </a>
            <a
              href={`tel:${PHONE_PT}`}
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z"/></svg>
              +351 912 014 971
            </a>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 bg-white/80 rounded-full px-4 py-2">
              <span className="text-yellow font-bold">⚡</span>
              <span className="text-dark"><strong>{SERVICES.length}</strong> tipos de serviço</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 rounded-full px-4 py-2">
              <span className="text-yellow font-bold">📍</span>
              <span className="text-dark"><strong>{CITIES.length}</strong> cidades cobertas</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 rounded-full px-4 py-2">
              <span className="text-yellow font-bold">🕐</span>
              <span className="text-dark">Resposta em <strong>menos de 1 hora</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* ── ALL SERVICES GRID ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Todos os serviços de urgência
          </h2>
          <p className="text-text-muted mb-10 max-w-2xl">
            Selecione o tipo de serviço e a sua cidade para encontrar um profissional disponível agora.
          </p>

          <div className="space-y-8">
            {SERVICES.map(service => (
              <div key={service.slug} className="bg-white rounded-2xl border border-border/50 overflow-hidden">
                {/* Service header */}
                <div className="flex items-center gap-4 px-6 py-5 border-b border-border/30">
                  <span className="text-3xl">{service.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-display text-xl font-bold text-dark">{service.name} Urgente</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-text-muted">
                      <span className="flex items-center gap-1">
                        <span className="text-yellow font-bold">⚡</span>
                        {service.urgency.avgResponseTime}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-text-muted/40" />
                      <span>{service.urgency.availableSchedule}</span>
                    </div>
                  </div>
                </div>

                {/* Cities sub-grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-5">
                  {CITIES.map(city => (
                    <Link
                      key={city.slug}
                      href={`/pt/urgencia/${service.slug}-urgente-${city.slug}/`}
                      className="flex items-center gap-2.5 p-3 rounded-xl border border-border/40 hover:border-yellow hover:bg-yellow/5 transition-all group"
                    >
                      <span className="text-sm">📍</span>
                      <div>
                        <span className="font-semibold text-dark group-hover:text-yellow transition-colors text-[0.9rem]">
                          {city.name}
                        </span>
                        <span className="block text-xs text-text-muted">
                          {city.population.toLocaleString('pt-PT')} hab.
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3 text-center">
            Como funciona?
          </h2>
          <p className="text-text-muted mb-10 max-w-2xl mx-auto text-center">
            Três passos simples para resolver a sua emergência.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map(step => (
              <div key={step.number} className="text-center p-6 rounded-2xl bg-warm-gray border border-border/50">
                <span className="text-4xl block mb-4">{step.icon}</span>
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow/15 text-yellow text-sm font-bold mb-3">
                  {step.number}
                </div>
                <h3 className="font-display text-lg font-bold text-dark mb-2">{step.title}</h3>
                <p className="text-[0.93rem] text-text-muted leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COVERAGE AREA ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Zona de cobertura
          </h2>
          <p className="text-text-muted mb-8 max-w-2xl">
            Atuamos em {CITIES.length} cidades do distrito do Porto e região do Tâmega e Sousa.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {CITIES.map(city => (
              <Link
                key={city.slug}
                href={`/pt/cidade/${city.slug}/`}
                className="flex items-center gap-3 p-4 bg-white rounded-2xl border-2 border-yellow/20 hover:border-yellow hover:shadow-md transition-all group"
              >
                <span className="text-xl">📍</span>
                <div>
                  <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">
                    {city.name}
                  </span>
                  <span className="block text-xs text-text-muted">
                    {city.population.toLocaleString('pt-PT')} hab. — {city.distrito}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section
        className="py-16 md:py-20"
        style={{ background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-4xl block mb-4">🚨</span>
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Tem uma emergência? Estamos disponíveis agora!
          </h2>
          <p className="text-dark/70 mb-8 max-w-md mx-auto">
            Profissionais verificados, intervenção rápida em toda a região do Tâmega e Sousa. 24h por dia, 7 dias por semana.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=URGÊNCIA!%20Preciso%20de%20ajuda%20agora.%20Podem%20vir%20rapidamente%3F`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white font-display font-bold rounded-full px-8 py-4 text-base hover:-translate-y-0.5 transition-all"
              style={{ background: '#25D366', boxShadow: '0 6px 24px rgba(37,211,102,0.45)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp — Resposta imediata
            </a>
            <a
              href={`tel:${PHONE_PT}`}
              className="inline-flex items-center gap-2 bg-dark text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-mid hover:-translate-y-0.5 transition-all"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z"/></svg>
              +351 912 014 971
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
