import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EN_SERVICE_PAGES, getEnServicePage, getAllEnServiceSlugs } from '@/lib/data/en-services-data'
import { PHONE_PT } from '@/lib/constants'
import TrustSignals from '@/components/en/TrustSignals'
import EmergencyBlock from '@/components/en/EmergencyBlock'
import QuoteRequestForm from '@/components/en/QuoteRequestForm'

// ─── Static generation ───
export function generateStaticParams() {
  return getAllEnServiceSlugs().map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = getEnServicePage(slug)
  if (!page) return { title: 'Service Not Found' }

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      type: 'website',
      siteName: 'VITFIX',
      locale: 'en_GB',
      images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
    },
    alternates: {
      canonical: `https://vitfix.io${page.canonicalPath}`,
      languages: {
        'en': `https://vitfix.io${page.canonicalPath}`,
        ...(page.ptEquivalentSlug ? { 'pt': `https://vitfix.io/pt/servicos/${page.ptEquivalentSlug}/` } : {}),
      },
    },
  }
}

export default async function EnServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = getEnServicePage(slug)
  if (!page) notFound()

  // Related pages
  const relatedPages = page.relatedEnSlugs
    .map(s => EN_SERVICE_PAGES.find(p => p.slug === s))
    .filter(Boolean)

  // Schema.org
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': page.schemaType,
        name: `VITFIX - ${page.serviceType} in Porto`,
        description: page.metaDescription,
        url: `https://vitfix.io${page.canonicalPath}`,
        areaServed: page.coverageAreas.map(city => ({ '@type': 'City', name: city })),
        serviceType: page.schemaServiceType,
        availableLanguage: ['English', 'Portuguese'],
        telephone: PHONE_PT,
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Porto',
          addressRegion: 'Porto',
          addressCountry: 'PT',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 41.1579,
          longitude: -8.6291,
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          reviewCount: '127',
          bestRating: '5',
          worstRating: '1',
        },
        priceRange: '\u20ac\u20ac',
        ...(page.isEmergency ? {
          hoursAvailable: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: '00:00',
            closes: '23:59',
          },
        } : {
          openingHoursSpecification: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: '08:00',
            closes: '20:00',
          },
        }),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/en/' },
          { '@type': 'ListItem', position: 2, name: page.serviceType, item: `https://vitfix.io${page.canonicalPath}` },
        ],
      },
      ...(page.faqs.length > 0 ? [{
        '@type': 'FAQPage',
        mainEntity: page.faqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      }] : []),
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO ── */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/en/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">{page.serviceType}</span>
          </nav>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {page.isEmergency && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 border border-red-200 text-sm font-semibold">
                <span>{'\ud83d\udea8'}</span>
                <span className="text-red-700">24/7 Emergency</span>
              </div>
            )}
            {page.isEnglishSpeaking && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-sm font-semibold">
                <span>{'\ud83c\uddec\ud83c\udde7'}</span>
                <span className="text-blue-700">English Speaking</span>
              </div>
            )}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold">
              <span>{'\u2b50'}</span>
              <span className="text-dark">4.9/5 from 127 reviews</span>
            </div>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            {page.heroTitle}
          </h1>
          <p className="text-lg text-text-muted max-w-2xl leading-relaxed mb-6">
            {page.heroSubtitle}
          </p>

          <TrustSignals variant="inline" />
        </div>
      </section>

      {/* ── EMERGENCY BLOCK (if emergency page) ── */}
      {page.isEmergency && (
        <section className="py-8 md:py-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <EmergencyBlock serviceType={page.serviceType} isEmergencyPage={true} />
          </div>
        </section>
      )}

      {/* ── FEATURES GRID ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            {page.isEnglishSpeaking ? 'Why Choose Our English Speaking Service' : 'What We Cover'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {page.features.map((feature, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-border/50 hover:border-yellow/50 transition-colors">
                <span className="text-3xl block mb-3">{feature.icon}</span>
                <h3 className="font-display font-bold text-dark mb-2">{feature.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEMS WE SOLVE ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
                Problems We Solve
              </h2>
              <ul className="space-y-3">
                {page.problemsWeSolve.map((problem, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold mt-0.5">{'\u2713'}</span>
                    <span className="text-[0.93rem] text-dark leading-relaxed">{problem}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quote Form */}
            <div>
              <h2 className="font-display text-[clamp(1.3rem,2.5vw,1.7rem)] font-bold tracking-tight mb-4">
                {page.isEmergency ? 'Request Emergency Help' : 'Get a Free Quote'}
              </h2>
              <QuoteRequestForm
                serviceType={page.serviceType}
                serviceName={page.serviceType}
                isEmergency={page.isEmergency}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── COVERAGE AREA ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{'\ud83d\udccd'}</span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
              Coverage Area
            </h2>
          </div>
          <p className="text-text-muted mb-6">
            Our verified {page.serviceType.toLowerCase()}s serve the following areas:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {page.coverageAreas.map(city => (
              <div key={city} className="p-4 bg-white rounded-2xl border border-border/50 text-center">
                <span className="font-display font-bold text-dark text-sm">{city}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      {page.faqs.length > 0 && (
        <section className="py-14 md:py-18 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {page.faqs.map((faq, i) => (
                <details key={i} className="group bg-warm-gray rounded-2xl overflow-hidden">
                  <summary className="flex items-center justify-between p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition-colors">
                    <span className="pr-4">{faq.question}</span>
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0 transition-transform group-open:rotate-180"><path d="M19 9l-7 7-7-7"/></svg>
                  </summary>
                  <div className="px-5 pb-5 text-text-muted leading-relaxed text-[0.93rem]">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── NON-EMERGENCY: Show Emergency Block ── */}
      {!page.isEmergency && (
        <section className="py-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <EmergencyBlock serviceType={page.serviceType} />
          </div>
        </section>
      )}

      {/* ── RELATED SERVICES ── */}
      {relatedPages.length > 0 && (
        <section className="py-14 md:py-18">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
              Related Services
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {relatedPages.map(related => related && (
                <Link
                  key={related.slug}
                  href={`/en/${related.slug}/`}
                  className="group p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-sm transition-all"
                >
                  <h3 className="font-display font-bold text-dark group-hover:text-yellow transition-colors mb-1">
                    {related.serviceType}
                  </h3>
                  <p className="text-xs text-text-muted line-clamp-2">{related.metaDescription.split('.')[0]}.</p>
                  <span className="text-xs font-semibold text-yellow mt-2 inline-block">Learn more &rarr;</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BOTTOM CTA ── */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            {page.isEmergency ? 'Get Emergency Help Now' : 'Ready to Get Started?'}
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            {page.isEmergency
              ? 'Our emergency team is standing by. Call or WhatsApp for immediate assistance.'
              : 'Get a free, no-obligation quote from verified professionals in Porto.'
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(`Hi VITFIX, I need ${page.serviceType} in Porto`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-[#20BD5A] hover:-translate-y-0.5 transition-all shadow-lg"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp Us
            </a>
            <a
              href={`tel:${PHONE_PT}`}
              className="inline-flex items-center justify-center gap-2 bg-dark hover:bg-dark/90 text-white font-display font-bold rounded-full px-8 py-4 text-base hover:translate-y-[-2px] transition-all"
            >
              {'\ud83d\udcde'} +351 912 014 971
            </a>
          </div>
          {/* PT cross-link */}
          {page.ptEquivalentSlug && (
            <p className="mt-6 text-sm text-text-muted">
              {'\ud83c\uddf5\ud83c\uddf9'} <Link href={`/pt/servicos/${page.ptEquivalentSlug}/`} className="text-yellow hover:underline">
                Esta p&aacute;gina tamb&eacute;m dispon&iacute;vel em Portugu&ecirc;s
              </Link>
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
