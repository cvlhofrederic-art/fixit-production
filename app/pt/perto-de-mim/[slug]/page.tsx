import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SERVICES, CITIES, type ServiceData, type CityData } from '@/lib/data/seo-pages-data'
import { PHONE_PT } from '@/lib/constants'

// ─────────────────────────────────────────────────────────────
// SLUG RESOLVER
// Handles:
//   eletricista                         → service only
//   eletricista-marco-de-canaveses      → service + city
//   picheleiro                          → canalizador (isPicheleiro=true)
//   picheleiro-marco-de-canaveses       → canalizador + city (isPicheleiro=true)
// ─────────────────────────────────────────────────────────────
interface Resolved {
  service: ServiceData
  city: CityData | null
  isPicheleiro: boolean
}

function resolveSlug(slug: string): Resolved | null {
  // 1. Direct service match
  const directService = SERVICES.find(s => s.slug === slug)
  if (directService) return { service: directService, city: null, isPicheleiro: false }

  // 2. Picheleiro generic
  if (slug === 'picheleiro') {
    const canaliz = SERVICES.find(s => s.slug === 'canalizador')
    if (canaliz) return { service: canaliz, city: null, isPicheleiro: true }
  }

  // 3. Picheleiro + city
  if (slug.startsWith('picheleiro-')) {
    const citySlug = slug.slice('picheleiro-'.length)
    const city = CITIES.find(c => c.slug === citySlug)
    const canaliz = SERVICES.find(s => s.slug === 'canalizador')
    if (city && canaliz) return { service: canaliz, city, isPicheleiro: true }
  }

  // 4. Service + city (try every service prefix, longest first to avoid partial matches)
  for (const service of SERVICES) {
    const prefix = `${service.slug}-`
    if (slug.startsWith(prefix)) {
      const citySlug = slug.slice(prefix.length)
      const city = CITIES.find(c => c.slug === citySlug)
      if (city) return { service, city, isPicheleiro: false }
    }
  }

  return null
}

// ─────────────────────────────────────────────────────────────
// STATIC PARAMS — 45 pages
//   4  generic service pages
//  32  service × city pages
//   1  picheleiro generic
//   8  picheleiro × city
// ─────────────────────────────────────────────────────────────
export function generateStaticParams() {
  const params: { slug: string }[] = []

  // Generic service pages (4)
  SERVICES.forEach(s => params.push({ slug: s.slug }))

  // Service × city (4 × 8 = 32)
  SERVICES.forEach(s =>
    CITIES.forEach(c => params.push({ slug: `${s.slug}-${c.slug}` }))
  )

  // Picheleiro generic (1)
  params.push({ slug: 'picheleiro' })

  // Picheleiro × city (8)
  CITIES.forEach(c => params.push({ slug: `picheleiro-${c.slug}` }))

  return params // 45 total
}

// ─────────────────────────────────────────────────────────────
// METADATA
// ─────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const resolved = resolveSlug(slug)
  if (!resolved) return {}

  const { service, city, isPicheleiro } = resolved
  const displayName = isPicheleiro ? 'Picheleiro' : service.name
  const locationLabel = city ? ` em ${city.name}` : ''

  const title = `${displayName} Perto de Mim${locationLabel} — Profissionais Verificados | VITFIX`
  const description = city
    ? `Procura um ${displayName.toLowerCase()} perto de si em ${city.name}? VITFIX cobre todas as ${city.freguesias.length} freguesias de ${city.name} (${city.population.toLocaleString('pt-PT')} hab.). Orçamento grátis, resposta rápida, 7/7.`
    : `Procura um ${displayName.toLowerCase()} perto de si? A VITFIX liga-o a profissionais verificados no Tâmega e Sousa. Orçamento grátis, resposta rápida, 7 dias por semana.`

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
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `https://vitfix.io/pt/perto-de-mim/${slug}/` },
  }
}

// ─────────────────────────────────────────────────────────────
// SHARED WHATSAPP ICON SVG
// ─────────────────────────────────────────────────────────────
const WaSvg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const PhoneSvg = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
  </svg>
)

// ─────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────
export default async function PertoDeMinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const resolved = resolveSlug(slug)
  if (!resolved) notFound()

  const { service, city, isPicheleiro } = resolved
  const displayName = isPicheleiro ? 'Picheleiro' : service.name
  const locationLabel = city ? ` em ${city.name}` : ''
  const otherServices = SERVICES.filter(s => s.slug !== service.slug)

  // Contextual WhatsApp message
  const waText = city
    ? `Olá! Preciso de ${displayName.toLowerCase()} perto de mim em ${city.name}. Podem ajudar?`
    : `Olá! Preciso de ${displayName.toLowerCase()} perto de mim. Podem ajudar?`
  const waHref = `https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(waText)}`
  const waUrgText = city
    ? `URGÊNCIA! Preciso de ${displayName.toLowerCase()} urgente perto de mim em ${city.name}. Podem vir rapidamente?`
    : `URGÊNCIA! Preciso de ${displayName.toLowerCase()} urgente perto de mim. Podem vir rapidamente?`
  const waUrgHref = `https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(waUrgText)}`

  // Schema.org — LocalBusiness (with geo when city-specific) + Breadcrumb + FAQ
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      city
        ? {
            '@type': 'LocalBusiness',
            name: `VITFIX — ${displayName} Perto de Mim em ${city.name}`,
            description: `${displayName} verificado perto de si em ${city.name} e nas ${city.freguesias.length} freguesias do município.`,
            url: `https://vitfix.io/pt/perto-de-mim/${slug}/`,
            telephone: PHONE_PT,
            areaServed: { '@type': 'City', name: city.name },
            geo: { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lng },
            priceRange: '€€',
            image: 'https://vitfix.io/logo.png',
            openingHoursSpecification: {
              '@type': 'OpeningHoursSpecification',
              dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
              opens: '08:00',
              closes: '20:00',
            },
          }
        : {
            '@type': 'Service',
            name: `${displayName} Perto de Mim`,
            description: `Encontre profissionais de ${displayName.toLowerCase()} verificados perto de si no Tâmega e Sousa.`,
            provider: { '@type': 'Organization', name: 'VITFIX', url: 'https://vitfix.io' },
            areaServed: CITIES.map(c => ({ '@type': 'City', name: c.name })),
            serviceType: displayName,
          },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Perto de Mim', item: 'https://vitfix.io/pt/perto-de-mim/' },
          ...(city
            ? [
                { '@type': 'ListItem', position: 3, name: displayName, item: `https://vitfix.io/pt/perto-de-mim/${service.slug}/` },
                { '@type': 'ListItem', position: 4, name: city.name, item: `https://vitfix.io/pt/perto-de-mim/${slug}/` },
              ]
            : [{ '@type': 'ListItem', position: 3, name: `${displayName} Perto de Mim`, item: `https://vitfix.io/pt/perto-de-mim/${slug}/` }]),
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `Como encontrar um ${displayName.toLowerCase()} perto de mim${city ? ` em ${city.name}` : ''}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: city
                ? `Na VITFIX, temos profissionais de ${displayName.toLowerCase()} que cobrem todas as freguesias de ${city.name} (${city.population.toLocaleString('pt-PT')} habitantes). Contacte-nos via WhatsApp ou telefone para uma resposta imediata.`
                : `Na VITFIX, basta selecionar o serviço de ${displayName.toLowerCase()} e indicar a sua localização. Apresentamos profissionais verificados disponíveis na sua zona, com orçamento grátis e sem compromisso.`,
            },
          },
          {
            '@type': 'Question',
            name: `Qual o tempo de resposta de um ${displayName.toLowerCase()} perto de mim?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Os profissionais VITFIX respondem em ${service.urgency.avgResponseTime}. Para urgências, estamos disponíveis ${service.urgency.availableSchedule}.`,
            },
          },
          {
            '@type': 'Question',
            name: isPicheleiro ? 'O que é um picheleiro? É diferente de um canalizador?' : `Quanto custa um ${displayName.toLowerCase()} perto de mim?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: isPicheleiro
                ? `"Picheleiro" é o nome regional no Norte de Portugal (especialmente no Tâmega e Sousa) para o que no resto do país se chama "canalizador". É o mesmo profissional — faz reparações de canalização, fugas de água, entupimentos e instalações. Na VITFIX, os nossos picheleiros/canalizadores cobrem ${CITIES.map(c => c.name).join(', ')}.`
                : `O custo varia conforme o tipo de serviço. Na VITFIX, o orçamento é sempre gratuito e sem compromisso. Os nossos profissionais de ${displayName.toLowerCase()} apresentam preços transparentes antes de iniciar qualquer trabalho.`,
            },
          },
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
        style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <span className="hover:text-yellow transition cursor-default">Perto de Mim</span>
            <span className="mx-2">/</span>
            {city ? (
              <>
                <Link href={`/pt/perto-de-mim/${service.slug}/`} className="hover:text-yellow transition">{displayName}</Link>
                <span className="mx-2">/</span>
                <span className="text-dark font-medium">{city.name}</span>
              </>
            ) : (
              <span className="text-dark font-medium">{displayName}</span>
            )}
          </nav>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span className="text-lg">{service.icon}</span>
            <span className="text-dark">
              {displayName}{city ? ` · ${city.name}` : ' · Tâmega e Sousa'}
            </span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            {displayName} Perto de Mim{locationLabel}
          </h1>

          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            {city
              ? `Profissional de ${displayName.toLowerCase()} disponível perto de si em ${city.name} e em todas as suas ${city.freguesias.length} freguesias. Resposta rápida, orçamento gratuito, serviço 7 dias por semana.`
              : `Encontre profissionais de ${displayName.toLowerCase()} verificados perto de si no Tâmega e Sousa. Resposta rápida, orçamento grátis, serviço 7 dias por semana.${isPicheleiro ? ' (Picheleiro = canalizador no Norte de Portugal)' : ''}`
            }
          </p>

          {/* CTAs hero */}
          <div className="flex flex-wrap gap-3 mb-10">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:-translate-y-0.5 transition-all"
              style={{ background: '#25D366', boxShadow: '0 6px 20px rgba(37,211,102,0.35)' }}
            >
              <WaSvg />
              WhatsApp — Resposta rápida
            </a>
            <a
              href={`tel:${PHONE_PT}`}
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all"
            >
              <PhoneSvg />
              +351 912 014 971
            </a>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Profissionais verificados</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Orçamento grátis</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Serviço 7/7</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> {service.urgency.avgResponseTime}</span>
          </div>
        </div>
      </section>

      {/* ── CITY-SPECIFIC: info + freguesias ── */}
      {city && (
        <section className="py-14 md:py-18 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
              {displayName} disponível em toda a {city.name}
            </h2>
            <p className="text-text-muted mb-6 max-w-2xl">
              Os nossos profissionais cobrem os <strong>{city.population.toLocaleString('pt-PT')} habitantes</strong> de {city.name} e todas as suas {city.freguesias.length} freguesias:
            </p>
            <div className="flex flex-wrap gap-2 mb-8">
              {city.freguesias.map(f => (
                <span key={f} className="px-3 py-1.5 bg-warm-gray rounded-full text-sm text-dark/70 border border-border/30">{f}</span>
              ))}
            </div>

            {/* Link to full service page */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/pt/servicos/${service.slug}-${city.slug}/`}
                className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-6 py-2.5 text-[0.9rem] hover:bg-yellow-light transition-all"
              >
                {service.icon} Ver todos os serviços de {displayName.toLowerCase()} em {city.name}
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              <Link
                href={`/pt/urgencia/${service.slug}-urgente-${city.slug}/`}
                className="inline-flex items-center gap-2 border-[1.5px] border-dark text-dark rounded-full font-medium px-6 py-2.5 text-[0.9rem] hover:bg-dark hover:text-white transition-all"
              >
                ⚡ Urgência em {city.name}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── GENERIC: cities grid ── */}
      {!city && (
        <section className="py-14 md:py-18">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
              {displayName} perto de si — Escolha a sua cidade
            </h2>
            <p className="text-text-muted mb-8 max-w-2xl">
              Selecione a sua cidade para ver profissionais de {displayName.toLowerCase()} disponíveis perto de si. Cobrimos toda a região do Tâmega e Sousa.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {CITIES.map(c => (
                <Link
                  key={c.slug}
                  href={`/pt/perto-de-mim/${isPicheleiro ? 'picheleiro' : service.slug}-${c.slug}/`}
                  className="p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{service.icon}</span>
                    <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{c.name}</span>
                  </div>
                  <div className="space-y-1 text-sm text-text-muted">
                    <p>{c.population.toLocaleString('pt-PT')} habitantes</p>
                    <p>{c.freguesias.length} freguesias</p>
                  </div>
                  <span className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-yellow">
                    Perto de mim
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURES ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            O que faz um {displayName.toLowerCase()} perto de si?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {service.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-white rounded-xl border border-border/50">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold mt-0.5">✓</span>
                <span className="text-[0.93rem] text-dark leading-relaxed">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── URGENCY BLOCK — dark style ── */}
      <section className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="relative overflow-hidden rounded-2xl p-8 md:p-12"
            style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}
          >
            <div className="absolute top-0 right-0 w-56 h-56 bg-yellow/8 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">⚠️</span>
                  <span className="text-yellow font-bold text-sm uppercase tracking-wider">
                    Urgência 24h{city ? ` — ${city.name}` : ''}
                  </span>
                </div>
                <h3 className="font-display text-xl md:text-2xl font-bold text-white mb-2">
                  Precisa de {displayName.toLowerCase()} urgente{city ? ` em ${city.name}` : ''}?
                </h3>
                <p className="text-white/70 max-w-lg leading-relaxed text-[0.93rem]">
                  {service.urgencyText}
                </p>
                <p className="text-white/40 text-xs mt-2">{service.urgency.availableSchedule} · Resposta em {service.urgency.avgResponseTime}</p>
              </div>
              <div className="flex flex-col sm:flex-row md:flex-col gap-3 flex-shrink-0">
                <a
                  href={waUrgHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 text-white font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:-translate-y-0.5 transition-all whitespace-nowrap"
                  style={{ background: '#25D366', boxShadow: '0 6px 24px rgba(37,211,102,0.4)' }}
                >
                  <WaSvg />
                  WhatsApp — Urgência
                </a>
                <a
                  href={`tel:${PHONE_PT}`}
                  className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:-translate-y-0.5 transition-all whitespace-nowrap"
                >
                  <PhoneSvg />
                  +351 912 014 971
                </a>
              </div>
            </div>

            {/* City links (only on generic pages) */}
            {!city && (
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CITIES.map(c => (
                  <Link
                    key={c.slug}
                    href={`/pt/urgencia/${service.slug}-urgente-${c.slug}/`}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-white/10 hover:border-yellow/50 hover:bg-white/5 transition-all text-sm"
                  >
                    <span className="text-yellow text-xs">⚡</span>
                    <span className="font-semibold text-white/70 hover:text-white transition-colors text-xs">{c.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── NEARBY CITIES (city-specific pages only) ── */}
      {city && city.nearby.length > 0 && (
        <section className="py-14 md:py-18 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
              {displayName} perto de mim — cidades próximas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {CITIES.filter(c => city.nearby.includes(c.slug)).map(nc => (
                <Link
                  key={nc.slug}
                  href={`/pt/perto-de-mim/${isPicheleiro ? 'picheleiro' : service.slug}-${nc.slug}/`}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border/50 hover:border-yellow hover:bg-yellow/5 transition-all group"
                >
                  <span className="text-xl">{service.icon}</span>
                  <div>
                    <span className="font-semibold text-dark group-hover:text-yellow transition-colors">{displayName} em {nc.name}</span>
                    <span className="block text-xs text-text-muted">{nc.population.toLocaleString('pt-PT')} hab.</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── OTHER SERVICES ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
            Outros serviços perto de mim{city ? ` em ${city.name}` : ''}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {otherServices.map(os => (
              <Link
                key={os.slug}
                href={city ? `/pt/perto-de-mim/${os.slug}-${city.slug}/` : `/pt/perto-de-mim/${os.slug}/`}
                className="p-6 bg-warm-gray rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group text-center"
              >
                <span className="text-3xl block mb-3">{os.icon}</span>
                <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{os.name}</span>
                <span className="block text-sm text-text-muted mt-1">Perto de mim{city ? ` em ${city.name}` : ''}</span>
              </Link>
            ))}
            {/* Picheleiro card (alias canalizador) */}
            {service.slug !== 'canalizador' && (
              <Link
                href={city ? `/pt/perto-de-mim/picheleiro-${city.slug}/` : `/pt/perto-de-mim/picheleiro/`}
                className="p-6 bg-warm-gray rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group text-center"
              >
                <span className="text-3xl block mb-3">🔧</span>
                <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">Picheleiro</span>
                <span className="block text-sm text-text-muted mt-1">Perto de mim{city ? ` em ${city.name}` : ''}</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            Perguntas frequentes — {displayName} perto de mim{locationLabel}
          </h2>
          <div className="space-y-4">
            <details className="group rounded-2xl border border-border/50 bg-white overflow-hidden">
              <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                <span className="text-[0.95rem]">Como encontrar um {displayName.toLowerCase()} perto de mim{locationLabel}?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
              </summary>
              <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">
                {city
                  ? `Na VITFIX, temos profissionais de ${displayName.toLowerCase()} que cobrem todas as freguesias de ${city.name}. O mais rápido é contactar-nos via WhatsApp — respondemos em ${service.urgency.avgResponseTime}.`
                  : `Na VITFIX, basta indicar a sua localização. Apresentamos-lhe profissionais verificados disponíveis na sua zona. Pode também contactar-nos diretamente via WhatsApp ou telefone para uma resposta imediata.`
                }
              </div>
            </details>

            <details className="group rounded-2xl border border-border/50 bg-white overflow-hidden">
              <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                <span className="text-[0.95rem]">Qual o tempo de resposta de um {displayName.toLowerCase()} perto de mim?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
              </summary>
              <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">
                Os profissionais VITFIX intervêm em <strong>{service.urgency.avgResponseTime}</strong>. Para urgências, estamos disponíveis <strong>{service.urgency.availableSchedule}</strong>. O melhor é enviar uma mensagem WhatsApp para obter uma resposta imediata.
              </div>
            </details>

            {isPicheleiro ? (
              <details className="group rounded-2xl border border-border/50 bg-white overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                  <span className="text-[0.95rem]">O que é um picheleiro? É diferente de um canalizador?</span>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">
                  &ldquo;Picheleiro&rdquo; é o nome regional no Norte de Portugal (Tâmega e Sousa, Douro, Minho) para o que no resto do país se chama &ldquo;canalizador&rdquo;. É exatamente o mesmo profissional — faz fugas de água, desentupimentos, reparação de esquentadores e caldeiras, e instalações de canalização. Na VITFIX, os nossos picheleiros/canalizadores cobrem {CITIES.map(c => c.name).join(', ')}.
                </div>
              </details>
            ) : (
              <details className="group rounded-2xl border border-border/50 bg-white overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                  <span className="text-[0.95rem]">Quanto custa um {displayName.toLowerCase()} perto de mim?</span>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">
                  {service.faqs[0]?.answer || `O custo varia conforme o tipo de serviço e a complexidade do trabalho. Na VITFIX, o orçamento é sempre gratuito e sem compromisso.`}
                </div>
              </details>
            )}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Precisa de um {displayName.toLowerCase()} perto de si{city ? ` em ${city.name}` : ''}?
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Contacte-nos diretamente — resposta em {service.urgency.avgResponseTime}. Orçamento gratuito, sem compromisso.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white font-display font-bold rounded-full px-8 py-4 text-base hover:-translate-y-0.5 transition-all"
              style={{ background: '#25D366', boxShadow: '0 6px 24px rgba(37,211,102,0.4)' }}
            >
              <WaSvg />
              WhatsApp — Resposta imediata
            </a>
            <a
              href={`tel:${PHONE_PT}`}
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              <PhoneSvg />
              +351 912 014 971
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
