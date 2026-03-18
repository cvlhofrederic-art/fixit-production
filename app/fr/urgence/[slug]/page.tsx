import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllFrUrgencyCombos, getFrUrgencyCombo, FR_SERVICES } from '@/lib/data/fr-seo-pages-data'
import { PHONE_FR } from '@/lib/constants'

export function generateStaticParams() {
  return getAllFrUrgencyCombos().map(c => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const combo = getFrUrgencyCombo(slug)
  if (!combo) return {}

  const title = combo.service.urgencyData.urgencyMetaTitle.replace('{city}', combo.city.name)
  const description = combo.service.urgencyData.urgencyMetaDesc.replace('{city}', combo.city.name)

  return {
    title,
    description,
    openGraph: { title, description, siteName: 'VITFIX', locale: 'fr_FR', type: 'website' },
    alternates: { canonical: `https://vitfix.io/fr/urgence/${slug}/` },
  }
}

export default async function FrUrgenceCityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const combo = getFrUrgencyCombo(slug)
  if (!combo) notFound()

  const { service, city } = combo
  const waText = encodeURIComponent(`URGENCE ! J'ai besoin d'un ${service.name.toLowerCase()} immédiatement à ${city.name}. Pouvez-vous intervenir ?`)
  const otherServices = FR_SERVICES.filter(s => s.slug !== service.slug && ['plombier', 'electricien'].includes(s.slug))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EmergencyService',
        name: `VITFIX — ${service.name} urgence à ${city.name}`,
        description: service.urgencyData.urgencyMetaDesc.replace('{city}', city.name),
        url: `https://vitfix.io/fr/urgence/${slug}/`,
        image: 'https://vitfix.io/og-image.png',
        logo: 'https://vitfix.io/og-image.png',
        telephone: PHONE_FR,
        areaServed: { '@type': 'City', name: city.name },
        address: {
          '@type': 'PostalAddress',
          addressLocality: city.name,
          addressRegion: city.region || 'Provence-Alpes-Côte d\'Azur',
          addressCountry: 'FR',
        },
        openingHoursSpecification: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: '00:00',
          closes: '23:59',
        },
        geo: { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lng },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          reviewCount: '12000',
          bestRating: '5',
          worstRating: '1',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
          { '@type': 'ListItem', position: 2, name: 'Urgence', item: 'https://vitfix.io/fr/urgence/' },
          { '@type': 'ListItem', position: 3, name: `${service.name} urgence ${city.name}`, item: `https://vitfix.io/fr/urgence/${slug}/` },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO URGENCE ── */}
      <section className="relative overflow-hidden py-16 md:py-20" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
        <div className="absolute top-0 right-0 w-72 h-72 bg-yellow/6 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-white/50">
            <Link href="/fr/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <Link href="/fr/urgence/" className="hover:text-yellow transition">Urgence</Link>
            <span className="mx-2">/</span>
            <span className="text-white/80">{service.name} {city.name}</span>
          </nav>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">⚠️</span>
            <span className="text-yellow font-bold text-sm uppercase tracking-wider">{service.urgencyData.schedule}</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-white mb-4">
            {service.name} Urgence à {city.name}<br />
            <span className="text-yellow">Intervention {service.urgencyData.avgResponseTime}</span>
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mb-8 leading-relaxed">
            {service.urgencyData.urgencyMetaDesc.replace('{city}', city.name)}
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_24px_rgba(37,211,102,0.5)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp — Réponse immédiate
            </a>
            <a
              href={`tel:${PHONE_FR}`}
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z"/></svg>
              Appeler maintenant
            </a>
          </div>
        </div>
      </section>

      {/* ── QUAND APPELER ── */}
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Gestes immédiats */}
            <div className="bg-white rounded-2xl border border-border/50 overflow-hidden">
              <div className="p-5 bg-yellow/10 border-b border-yellow/20">
                <h2 className="font-display font-bold text-lg flex items-center gap-2">
                  <span>🛡️</span> Gestes d&apos;urgence — {city.name}
                </h2>
                <p className="text-sm text-text-muted mt-1">En attendant l&apos;intervention de notre {service.name.toLowerCase()}</p>
              </div>
              <ol className="p-5 space-y-3">
                {service.urgencyData.immediateSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow flex items-center justify-center text-dark font-bold text-xs">{i + 1}</span>
                    <span className="text-[0.87rem] text-dark/80 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Quand appeler */}
            <div className="bg-white rounded-2xl border border-border/50 overflow-hidden">
              <div className="p-5 bg-red-50 border-b border-red-100">
                <h2 className="font-display font-bold text-lg flex items-center gap-2">
                  <span>🔴</span> Quand appeler en urgence ?
                </h2>
                <p className="text-sm text-text-muted mt-1">Ces situations nécessitent une intervention immédiate</p>
              </div>
              <ul className="p-5 space-y-3">
                {service.urgencyData.whenToCall.map((situation, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 text-red-500 font-bold text-lg mt-0.5">!</span>
                    <span className="text-[0.87rem] text-dark/80 leading-relaxed">{situation}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── ZONE + QUARTIERS ── */}
      <section className="py-14 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-xl font-bold mb-4">Zone d&apos;intervention urgence — {city.name}</h2>
          <p className="text-text-muted mb-6">
            Nos {service.name.toLowerCase()}s interviennent en urgence dans tous les quartiers de {city.name} ({city.population.toLocaleString('fr-FR')} habitants).
          </p>
          <div className="flex flex-wrap gap-2 mb-8">
            {city.quartiers.map(q => (
              <span key={q} className="px-3 py-1.5 bg-warm-gray rounded-full text-sm text-dark/70 border border-border/30">{q}</span>
            ))}
          </div>

          {/* Autres services urgence */}
          {otherServices.length > 0 && (
            <>
              <h3 className="font-display text-lg font-bold mb-4">Autres urgences à {city.name}</h3>
              <div className="flex flex-wrap gap-3">
                {otherServices.map(os => (
                  <Link
                    key={os.slug}
                    href={`/fr/urgence/${os.slug}-urgence-${city.slug}/`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 text-sm hover:border-yellow hover:bg-yellow/5 transition-all"
                  >
                    <span>{os.icon}</span>
                    {os.name} urgence {city.name}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl p-8" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h3 className="font-display text-xl font-bold text-white mb-2">
                  {service.name} urgence à {city.name} — {service.urgencyData.avgResponseTime}
                </h3>
                <p className="text-white/60 text-sm">{service.urgencyData.schedule}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <a
                  href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${waText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold rounded-full px-6 py-3 text-sm hover:bg-[#20ba59] transition-all whitespace-nowrap"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp Urgence
                </a>
                <a
                  href={`tel:${PHONE_FR}`}
                  className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-bold rounded-full px-6 py-3 text-sm hover:bg-yellow-light transition-all whitespace-nowrap"
                >
                  Appeler maintenant
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
