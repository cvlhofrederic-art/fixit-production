// ─── Shared Investor Landing Page Template ───
// Used across FR, NL, and ES investor pages targeting foreign property owners in Porto

import Link from 'next/link'
import type { InvestorPage } from '@/lib/data/investor-pages-data'
import { PORTO_COVERAGE_AREAS } from '@/lib/data/investor-pages-data'
import EmergencyBlock from '@/components/en/EmergencyBlock'
import { PHONE_PT } from '@/lib/constants'

// Labels per locale
const LABELS: Record<string, {
  services: string
  whyUs: string
  getQuote: string
  faq: string
  coverage: string
  coverageDesc: string
  relatedServices: string
  whatsapp: string
  phone: string
  orWhatsApp: string
  learnMore: string
}> = {
  fr: {
    services: 'Nos Services',
    whyUs: 'Pourquoi Nous Choisir',
    getQuote: 'Demander un Devis Gratuit',
    faq: 'Questions Fr\u00e9quentes',
    coverage: 'Zone de Couverture',
    coverageDesc: 'Nous intervenons dans toute la m\u00e9tropole de Porto et ses environs.',
    relatedServices: 'Services Associ\u00e9s',
    whatsapp: 'WhatsApp',
    phone: 'Appeler',
    orWhatsApp: 'Ou contactez-nous par WhatsApp',
    learnMore: 'En savoir plus',
  },
  nl: {
    services: 'Onze Diensten',
    whyUs: 'Waarom Ons Kiezen',
    getQuote: 'Vraag een Gratis Offerte Aan',
    faq: 'Veelgestelde Vragen',
    coverage: 'Servicegebied',
    coverageDesc: 'Wij bedienen de hele metropoolregio Porto en omgeving.',
    relatedServices: 'Gerelateerde Diensten',
    whatsapp: 'WhatsApp',
    phone: 'Bellen',
    orWhatsApp: 'Of neem contact op via WhatsApp',
    learnMore: 'Meer informatie',
  },
  es: {
    services: 'Nuestros Servicios',
    whyUs: 'Por Qu\u00e9 Elegirnos',
    getQuote: 'Solicite un Presupuesto Gratis',
    faq: 'Preguntas Frecuentes',
    coverage: 'Zona de Cobertura',
    coverageDesc: 'Servimos toda la zona metropolitana de Oporto y alrededores.',
    relatedServices: 'Servicios Relacionados',
    whatsapp: 'WhatsApp',
    phone: 'Llamar',
    orWhatsApp: 'O cont\u00e1ctenos por WhatsApp',
    learnMore: 'M\u00e1s informaci\u00f3n',
  },
}

// Service display names per locale
const SERVICE_NAMES: Record<string, Record<string, string>> = {
  fr: {
    'travaux-appartement-porto': 'R\u00e9novation',
    'plombier-porto': 'Plomberie',
    'electricien-porto': '\u00c9lectricit\u00e9',
    'entretien-appartement-porto': 'Entretien',
  },
  nl: {
    'appartement-renovatie-porto': 'Renovatie',
    'loodgieter-porto': 'Loodgieter',
    'elektricien-porto': 'Elektricien',
    'appartement-onderhoud-porto': 'Onderhoud',
  },
  es: {
    'reformas-apartamento-oporto': 'Reformas',
    'fontanero-oporto': 'Fontaner\u00eda',
    'electricista-oporto': 'Electricista',
    'mantenimiento-apartamento-oporto': 'Mantenimiento',
  },
}

export default function InvestorPageTemplate({ page }: { page: InvestorPage }) {
  const labels = LABELS[page.locale] || LABELS.fr
  const serviceNames = SERVICE_NAMES[page.locale] || {}
  const baseUrl = 'https://vitfix.io'

  // Build Schema.org
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': page.schemaType,
        name: 'VITFIX',
        description: page.metaDescription,
        url: `${baseUrl}${page.canonicalPath}`,
        logo: `${baseUrl}/og-image.png`,
        image: `${baseUrl}/og-image.png`,
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
        areaServed: PORTO_COVERAGE_AREAS.map(city => ({
          '@type': 'City',
          name: city,
        })),
        serviceType: page.schemaServiceTypes,
        availableLanguage: ['English', 'Portuguese', 'French', 'Spanish', 'Dutch'],
        telephone: PHONE_PT,
        priceRange: '\u20ac\u20ac',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: `${baseUrl}/${page.locale}/` },
          { '@type': 'ListItem', position: 2, name: page.heroTitle, item: `${baseUrl}${page.canonicalPath}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: page.faqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  }

  // Locale prefix for internal links
  const localePrefix = page.locale === 'fr' ? '/fr' : `/${page.locale}`

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <nav className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-sm text-text-muted">
          <li><Link href={`${localePrefix}/`} className="hover:text-yellow transition-colors">VITFIX</Link></li>
          <li><span className="mx-1">/</span></li>
          <li className="text-dark font-medium truncate">{page.heroTitle}</li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="pt-8 pb-12 md:pt-12 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            {page.heroTitle}
          </h1>
          <p className="text-lg text-text-muted max-w-2xl leading-relaxed mb-6">
            {page.heroSubtitle}
          </p>

          {/* Trust signals inline */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-yellow">&#9733;</span>
              <span className="font-semibold text-dark">4.9/5</span>
              <span className="text-text-muted">(127 avis)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>&#9989;</span>
              <span className="text-text-muted">{page.locale === 'fr' ? 'Professionnels v\u00e9rifi\u00e9s' : page.locale === 'nl' ? 'Geverifieerde vakmensen' : page.locale === 'es' ? 'Profesionales verificados' : 'Verified Professionals'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>&#9201;</span>
              <span className="text-text-muted">{page.locale === 'fr' ? 'R\u00e9ponse < 30 min' : page.locale === 'nl' ? 'Reactie < 30 min' : page.locale === 'es' ? 'Respuesta < 30 min' : 'Response < 30 min'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>&#128197;</span>
              <span className="text-text-muted">7/7</span>
            </div>
          </div>
        </div>
      </section>

      {/* Intro Text */}
      <section className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl text-text-muted leading-relaxed space-y-4">
            {page.introText.split('\n\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            {labels.services}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {page.features.map((feature, i) => (
              <div key={i} className="p-6 bg-warm-gray rounded-2xl">
                <span className="text-3xl block mb-3">{feature.icon}</span>
                <h3 className="font-display text-lg font-bold text-dark mb-2">{feature.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            {labels.whyUs}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {page.whyChooseUs.map((item, i) => (
              <div key={i} className="p-6 bg-white rounded-2xl border border-border/50">
                <div className="w-10 h-10 rounded-full bg-yellow/10 flex items-center justify-center mb-4">
                  <span className="text-yellow font-bold text-lg">{i + 1}</span>
                </div>
                <h3 className="font-display text-lg font-bold text-dark mb-2">{item.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + Contact Block */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-warm-gray rounded-3xl p-8 md:p-12 text-center">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
              {page.ctaTitle}
            </h2>
            <p className="text-text-muted mb-8 max-w-md mx-auto">
              {page.ctaText}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=Hello%20VITFIX%2C%20I%20need%20help%20with%20my%20property%20in%20Porto`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-[#20BD5A] hover:-translate-y-0.5 transition-all shadow-lg"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                {labels.whatsapp}
              </a>
              <a
                href={`tel:${PHONE_PT}`}
                className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                {labels.phone}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Coverage Area */}
      <section className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">&#128205;</span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
              {labels.coverage}
            </h2>
          </div>
          <p className="text-text-muted mb-8 max-w-2xl">{labels.coverageDesc}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {PORTO_COVERAGE_AREAS.map(city => (
              <div key={city} className="p-4 bg-white rounded-2xl text-center border border-border/30">
                <span className="text-xl block mb-1">&#127968;</span>
                <span className="font-display font-bold text-dark text-sm">{city}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            {labels.faq}
          </h2>
          <div className="space-y-4 max-w-3xl">
            {page.faqs.map((faq, i) => (
              <details key={i} className="group bg-warm-gray rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <h3 className="font-display font-bold text-dark text-left pr-4">{faq.question}</h3>
                  <svg className="w-5 h-5 text-text-muted shrink-0 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
                </summary>
                <div className="px-6 pb-6">
                  <p className="text-text-muted leading-relaxed">{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Emergency Block */}
      <section className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmergencyBlock serviceType="home repair" locale={page.locale as 'en' | 'es' | 'nl'} />
        </div>
      </section>

      {/* Related Services */}
      {page.relatedSlugs.length > 0 && (
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
              {labels.relatedServices}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {page.relatedSlugs.map(slug => {
                const name = serviceNames[slug] || slug
                const href = page.locale === 'fr' ? `${localePrefix}/${slug}/` : `/${page.locale}/${slug}/`
                return (
                  <Link
                    key={slug}
                    href={href}
                    className="group p-5 bg-warm-gray rounded-2xl hover:border-yellow border border-transparent hover:shadow-md transition-all"
                  >
                    <h3 className="font-display font-bold text-dark group-hover:text-yellow transition-colors mb-1">
                      {name}
                    </h3>
                    <span className="text-sm font-semibold text-yellow">{labels.learnMore} &rarr;</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Hreflang cross-links (hidden, for SEO crawlers that read page links) */}
      <div className="hidden" aria-hidden="true">
        {Object.entries(page.hreflangAlternates).map(([lang, path]) => (
          <Link key={lang} href={path} hrefLang={lang}>{lang}</Link>
        ))}
      </div>
    </div>
  )
}
