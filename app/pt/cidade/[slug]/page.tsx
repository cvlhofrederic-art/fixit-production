import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CITIES, SERVICES, getCityBySlug } from '@/lib/data/seo-pages-data'
import { PHONE_PT } from '@/lib/constants'

export function generateStaticParams() {
  return CITIES.map(city => ({ slug: city.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const city = getCityBySlug(slug)
  if (!city) return {}

  const title = `Profissionais em ${city.name} — Eletricista, Canalizador, Pintor | VITFIX`
  const description = `Encontre um profissional qualificado em ${city.name} (${city.distrito}): eletricista, canalizador, pintor, pladur. Orçamento grátis, disponíveis 7/7.`

  return {
    title,
    description,
    alternates: { canonical: `https://vitfix.io/pt/cidade/${slug}/` },
    openGraph: { title, description, siteName: 'VITFIX', locale: 'pt_PT', type: 'website' },
  }
}

export default async function PtCidadePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const city = getCityBySlug(slug)
  if (!city) notFound()

  const nearbyCities = city.nearby
    .map(n => CITIES.find(c => c.slug === n))
    .filter((c): c is typeof CITIES[0] => c !== undefined)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HomeAndConstructionBusiness',
        name: `VITFIX — Profissionais em ${city.name}`,
        description: `Serviços profissionais em ${city.name}: eletricista, canalizador, pintor, pladur, obras de remodelação. Profissionais verificados, orçamento grátis, resposta rápida.`,
        url: `https://vitfix.io/pt/cidade/${slug}/`,
        image: 'https://vitfix.io/og-image.png',
        logo: 'https://vitfix.io/og-image.png',
        areaServed: { '@type': 'City', name: city.name },
        telephone: PHONE_PT,
        address: {
          '@type': 'PostalAddress',
          addressLocality: city.name,
          addressRegion: city.distrito,
          addressCountry: 'PT',
        },
        geo: { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lng },
        openingHoursSpecification: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: '07:00',
          closes: '22:00',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          reviewCount: '5000',
          bestRating: '5',
          worstRating: '1',
        },
        serviceType: SERVICES.map(s => s.name),
        priceRange: '€€',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/pt/' },
          { '@type': 'ListItem', position: 2, name: 'Serviços', item: 'https://vitfix.io/pt/services/' },
          { '@type': 'ListItem', position: 3, name: city.name, item: `https://vitfix.io/pt/cidade/${slug}/` },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section className="relative overflow-hidden pt-16 pb-14" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/pt/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <Link href="/pt/services/" className="hover:text-yellow transition">Serviços</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">{city.name}</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span>📍</span>
            <span className="text-dark">{city.distrito}</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Profissionais em {city.name}
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-6 leading-relaxed">
            Encontre um eletricista, canalizador, pintor ou outro profissional qualificado em {city.name} ({city.population.toLocaleString('pt-PT')} habitantes). Disponíveis rapidamente, orçamento grátis.
          </p>
          <a
            href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(`Olá VITFIX, procuro um profissional em ${city.name}. Podem ajudar-me?`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Pedir orçamento grátis
          </a>
        </div>
      </section>

      {/* SERVIÇOS DISPONÍVEIS */}
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
            Profissionais disponíveis em {city.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SERVICES.map(service => (
              <Link
                key={service.slug}
                href={`/pt/services/${service.slug}-${city.slug}/`}
                className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group"
              >
                <span className="text-3xl flex-shrink-0">{service.icon}</span>
                <div>
                  <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors block">{service.name} em {city.name}</span>
                  <span className="text-xs text-text-muted mt-0.5 block">Orçamento grátis · Disponível 7/7</span>
                </div>
                <svg className="ml-auto flex-shrink-0 text-yellow opacity-0 group-hover:opacity-100 transition-opacity" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FREGUESIAS */}
      <section className="py-14 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Freguesias cobertas em {city.name}
          </h2>
          <p className="text-text-muted mb-6">
            Os nossos profissionais intervêm em todas as freguesias de {city.name} e arredores.
          </p>
          <div className="flex flex-wrap gap-2">
            {city.freguesias.map(q => (
              <span key={q} className="px-3 py-1.5 bg-warm-gray rounded-full text-sm text-dark/70 border border-border/30">{q}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CONCELHOS PRÓXIMOS */}
      {nearbyCities.length > 0 && (
        <section className="py-14">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
              Concelhos próximos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {nearbyCities.map(nc => (
                <Link
                  key={nc.slug}
                  href={`/pt/cidade/${nc.slug}/`}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border/50 hover:border-yellow hover:bg-yellow/5 transition-all group"
                >
                  <span className="text-xl">📍</span>
                  <div>
                    <span className="font-semibold text-dark group-hover:text-yellow transition-colors">Profissionais em {nc.name}</span>
                    <span className="block text-xs text-text-muted">{nc.population.toLocaleString('pt-PT')} hab.</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* URGÊNCIA CTA */}
      <section className="py-12 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl p-8" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <span className="text-yellow font-bold text-sm uppercase tracking-wider block mb-2">⚠️ Urgência {city.name} — 24h/7</span>
                <h3 className="font-display text-xl font-bold text-white mb-1">Precisa de um profissional de urgência?</h3>
                <p className="text-white/60 text-sm">Fuga de água, avaria elétrica — intervenção rápida em {city.name}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <a
                  href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(`URGÊNCIA em ${city.name}! Preciso de um profissional imediatamente.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold rounded-full px-6 py-3 text-sm hover:bg-[#20ba59] transition-all whitespace-nowrap"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp Urgência
                </a>
                <Link
                  href="/pt/urgencia/"
                  className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-bold rounded-full px-6 py-3 text-sm hover:bg-yellow-light transition-all whitespace-nowrap"
                >
                  Serviços de urgência
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
