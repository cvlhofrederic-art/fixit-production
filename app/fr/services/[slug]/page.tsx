import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllFrPageCombos, getFrPageCombo, FR_SERVICES } from '@/lib/data/fr-seo-pages-data'
import ArtisansCatalogueSection from '@/components/ArtisansCatalogueSection'
import { PHONE_FR } from '@/lib/constants'

// ── Generate all 32 static pages (4 services × 8 cities) ──
export function generateStaticParams() {
  return getAllFrPageCombos().map(p => ({ slug: p.slug }))
}

// ── Dynamic SEO metadata ──
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const combo = getFrPageCombo(slug)
  if (!combo) return {}

  const title = combo.service.metaTitle.replace('{city}', combo.city.name)
  const description = combo.service.metaDesc.replace('{city}', combo.city.name)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'VITFIX',
      locale: 'fr_FR',
      type: 'website',
      images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: {
      canonical: `https://vitfix.io/fr/services/${slug}/`,
    },
  }
}

// ── Page Component ──
export default async function FrServiceCityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const combo = getFrPageCombo(slug)
  if (!combo) notFound()

  const { service, city, nearbyCities } = combo
  const heroTitle = service.heroTitle.replace('{city}', city.name)
  const urgencyText = service.urgencyText.replace('{city}', city.name)
  const otherServices = FR_SERVICES.filter(s => s.slug !== service.slug)
  const waText = encodeURIComponent(`Bonjour VITFIX, j'ai besoin d'un ${service.name.toLowerCase()} à ${city.name}. Pouvez-vous m'aider ?`)
  const waUrgText = encodeURIComponent(`URGENCE ! J'ai besoin d'un ${service.name.toLowerCase()} immédiatement à ${city.name}. Pouvez-vous intervenir ?`)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HomeAndConstructionBusiness',
        name: `VITFIX — ${service.name} à ${city.name}`,
        description: service.metaDesc.replace('{city}', city.name),
        url: `https://vitfix.io/fr/services/${slug}/`,
        areaServed: {
          '@type': 'City',
          name: city.name,
          containedInPlace: { '@type': 'AdministrativeArea', name: city.department },
        },
        serviceType: service.name,
        priceRange: '€€',
        image: 'https://vitfix.io/og-image.png',
        logo: 'https://vitfix.io/og-image.png',
        telephone: PHONE_FR,
        inLanguage: 'fr-FR',
        address: {
          '@type': 'PostalAddress',
          addressLocality: city.name,
          addressRegion: city.region || 'Provence-Alpes-Côte d\'Azur',
          postalCode: city.slug === 'marseille' ? '13000' : '',
          addressCountry: 'FR',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: city.lat,
          longitude: city.lng,
        },
        openingHoursSpecification: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: '07:00',
          closes: '22:00',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          reviewCount: '12000',
          bestRating: '5',
          worstRating: '1',
        },
        availableLanguage: ['fr', 'en', 'pt'],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
          { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://vitfix.io/fr/services/' },
          { '@type': 'ListItem', position: 3, name: `${service.name} à ${city.name}`, item: `https://vitfix.io/fr/services/${slug}/` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: service.faqs.map(faq => ({
          '@type': 'Question',
          name: faq.question.replace(/{city}/g, city.name),
          acceptedAnswer: { '@type': 'Answer', text: faq.answer.replace(/{city}/g, city.name) },
        })),
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/fr/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <Link href="/fr/services/" className="hover:text-yellow transition">Services</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">{service.name} {city.name}</span>
          </nav>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span className="text-lg">{service.icon}</span>
            <span className="text-dark">{service.name} · {city.department}</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            {heroTitle}
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            {service.heroSubtitle.replace('{city}', city.name)}
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 mb-10">
            <a
              href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Devis WhatsApp gratuit
            </a>
            <Link
              href="/fr/services/"
              className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              Voir tous les services
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <a
              href={`tel:${PHONE_FR}`}
              className="inline-flex items-center gap-2 border-[1.5px] border-dark text-dark rounded-full font-medium px-7 py-3 text-[0.95rem] bg-transparent hover:bg-dark hover:text-white transition-all"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z"/></svg>
              Appeler maintenant
            </a>
          </div>

          {/* Trust */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Artisans certifiés &amp; de confiance</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Devis gratuit sans engagement</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Service 7j/7</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Avis clients vérifiés</span>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            Nos prestations de {service.name.toLowerCase()} à {city.name}
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

      {/* ── PROBLEMS WE SOLVE ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Problèmes résolus à {city.name}
          </h2>
          <p className="text-text-muted mb-8 max-w-2xl">
            Nos artisans règlent les problèmes les plus courants de {service.name.toLowerCase()} dans la région.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {service.problemsWeSolve.map((problem, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-border/50 hover:border-yellow/30 transition-colors">
                <span className="flex-shrink-0 text-yellow text-lg mt-0.5">{service.icon}</span>
                <span className="text-[0.93rem] text-dark">{problem}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── URGENCY CTA ── */}
      <section className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl p-8 md:p-12" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
            <div className="absolute top-0 right-0 w-56 h-56 bg-yellow/8 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow/5 rounded-full translate-y-1/2 -translate-x-1/3 pointer-events-none" />
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">⚠️</span>
                  <span className="text-yellow font-bold text-sm uppercase tracking-wider">Urgence 24h — {city.name}</span>
                </div>
                <h3 className="font-display text-xl md:text-2xl font-bold text-white mb-2">
                  Besoin d&apos;un {service.name.toLowerCase()} maintenant ?
                </h3>
                <p className="text-white/70 max-w-lg leading-relaxed text-[0.93rem]">{urgencyText}</p>
              </div>
              <div className="flex flex-col sm:flex-row md:flex-col gap-3 flex-shrink-0">
                <a
                  href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${waUrgText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_24px_rgba(37,211,102,0.4)] whitespace-nowrap"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp — Réponse rapide
                </a>
                <a
                  href={`tel:${PHONE_FR}`}
                  className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all whitespace-nowrap"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z"/></svg>
                  Appeler maintenant
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COVERAGE AREA ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Zone d&apos;intervention — {city.name}
          </h2>
          <p className="text-text-muted mb-6">
            Nos {service.name.toLowerCase()}s interviennent à {city.name} ({city.population.toLocaleString('fr-FR')} habitants) et dans tous les quartiers :
          </p>
          <div className="flex flex-wrap gap-2 mb-12">
            {city.quartiers.map(q => (
              <span key={q} className="px-3 py-1.5 bg-warm-gray rounded-full text-sm text-dark/70 border border-border/30">{q}</span>
            ))}
          </div>

          {/* Nearby cities */}
          {nearbyCities.length > 0 && (
            <>
              <h3 className="font-display text-xl font-bold mb-4">{service.name} dans les communes proches</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {nearbyCities.map(nc => (
                  <Link
                    key={nc.slug}
                    href={`/fr/services/${service.slug}-${nc.slug}/`}
                    className="flex items-center gap-3 p-4 rounded-xl border border-border/50 hover:border-yellow hover:bg-yellow/5 transition-all group"
                  >
                    <span className="text-xl">{service.icon}</span>
                    <div>
                      <span className="font-semibold text-dark group-hover:text-yellow transition-colors">{service.name} à {nc.name}</span>
                      <span className="block text-xs text-text-muted">{nc.population.toLocaleString('fr-FR')} hab.</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── OTHER SERVICES ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
            Autres services à {city.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {otherServices.map(os => (
              <Link
                key={os.slug}
                href={`/fr/services/${os.slug}-${city.slug}/`}
                className="p-6 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group text-center"
              >
                <span className="text-3xl block mb-3">{os.icon}</span>
                <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{os.name}</span>
                <span className="block text-sm text-text-muted mt-1">à {city.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── ARTISANS CATALOGUE ── */}
      <ArtisansCatalogueSection
        city={city.name}
        service={service.slug}
        waPhone={PHONE_FR.replace('+', '')}
      />

      {/* ── SIMULATEUR DEVIS BANNER ── */}
      <section className="py-10 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl border border-yellow/40 bg-gradient-to-r from-yellow/10 to-yellow/5 p-7 md:p-9 flex flex-col sm:flex-row items-center gap-6">
            <div className="text-4xl flex-shrink-0">🧮</div>
            <div className="flex-1 text-center sm:text-left">
              <p className="font-display font-extrabold text-dark text-lg mb-1">Combien va coûter votre {service.name.toLowerCase()} à {city.name} ?</p>
              <p className="text-sm text-text-muted">Estimez le tarif en 2 minutes avec notre simulateur de devis 2025 — tarifs PACA actualisés.</p>
            </div>
            <Link
              href="/fr/simulateur-devis"
              className="flex-shrink-0 inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-6 py-3 text-[0.9rem] hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_4px_16px_rgba(255,214,0,0.35)] whitespace-nowrap"
            >
              Estimer mon devis →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Questions fréquentes — {service.name} à {city.name}
          </h2>
          <p className="text-text-muted mb-8">
            Réponses aux questions les plus posées sur nos services de {service.name.toLowerCase()}.
          </p>
          <div className="space-y-4">
            {service.faqs.map((faq, i) => (
              <details key={i} className="group rounded-2xl border border-border/50 bg-warm-gray overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                  <span className="text-[0.95rem]">{faq.question.replace(/{city}/g, city.name)}</span>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">
                  {faq.answer.replace(/{city}/g, city.name)}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Besoin d&apos;un {service.name.toLowerCase()} à {city.name} ?
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Contactez-nous par WhatsApp pour un devis gratuit. Réponse sous 30 minutes, artisans vérifiés.
          </p>
          <a
            href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Demander un devis gratuit — WhatsApp
          </a>
        </div>
      </section>
    </div>
  )
}
