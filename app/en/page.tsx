import type { Metadata } from 'next'
import Link from 'next/link'
import { EN_SERVICE_PAGES } from '@/lib/data/en-services-data'
import TrustSignals from '@/components/en/TrustSignals'
import EmergencyBlock from '@/components/en/EmergencyBlock'
import { PHONE_PT } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Home Services in Porto | English Speaking Professionals | VITFIX',
  description: 'Find verified, English-speaking home service professionals in Porto. Plumbers, electricians, handymen, property maintenance and more. Free quotes, fast response.',
  openGraph: {
    title: 'Home Services in Porto | VITFIX',
    description: 'Verified, English-speaking professionals for all your home service needs in Porto. Free quotes.',
    type: 'website',
    siteName: 'VITFIX',
    locale: 'en_GB',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  alternates: {
    canonical: 'https://vitfix.io/en/',
  },
}

const SERVICE_ICONS: Record<string, string> = {
  'Plumber': '\ud83d\udebf',
  'Emergency Plumber': '\ud83d\udea8',
  'Electrician': '\u26a1',
  'Handyman': '\ud83d\udd28',
  'Home Repair': '\ud83c\udfe0',
  'Property Maintenance': '\ud83d\udd11',
  'English Speaking Plumber': '\ud83c\uddec\ud83c\udde7',
  'English Speaking Electrician': '\ud83c\uddec\ud83c\udde7',
}

export default function EnHubPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Home Services in Porto - VITFIX',
        description: 'Find verified, English-speaking home service professionals in Porto.',
        url: 'https://vitfix.io/en/',
        inLanguage: 'en',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/en/' },
        ],
      },
    ],
  }

  // Group services for display
  const mainServices = EN_SERVICE_PAGES.filter(p => !p.isEmergency && !p.isEnglishSpeaking)
  const emergencyServices = EN_SERVICE_PAGES.filter(p => p.isEmergency)
  const englishSpeaking = EN_SERVICE_PAGES.filter(p => p.isEnglishSpeaking)

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-4">
            <span>{'\ud83c\uddec\ud83c\udde7'}</span>
            <span className="text-dark">English Speaking Service</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Home Services in Porto
          </h1>
          <p className="text-lg text-text-muted max-w-2xl leading-relaxed mb-6">
            Find verified, English-speaking professionals for plumbing, electrical, handyman and property maintenance services across the Porto metropolitan area.
          </p>

          <TrustSignals variant="inline" />
        </div>
      </section>

      {/* Main Services Grid */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Our Services
          </h2>
          <p className="text-text-muted mb-8 max-w-2xl">
            Select a service to learn more and get a free quote from verified professionals.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {mainServices.map(page => (
              <Link
                key={page.slug}
                href={`/en/${page.slug}/`}
                className="group p-6 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all"
              >
                <span className="text-4xl block mb-4">{SERVICE_ICONS[page.serviceType] || '\ud83d\udd27'}</span>
                <h3 className="font-display text-xl font-bold text-dark group-hover:text-yellow transition-colors mb-2">
                  {page.serviceType} in Porto
                </h3>
                <p className="text-sm text-text-muted leading-relaxed mb-4">
                  {page.metaDescription.split('.')[0]}.
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-border/30">
                  <span className="text-sm font-semibold text-yellow">Get free quote</span>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-yellow"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Emergency Services */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{'\ud83d\udea8'}</span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
              Emergency Services
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {emergencyServices.map(page => (
              <Link
                key={page.slug}
                href={`/en/${page.slug}/`}
                className="group p-6 bg-orange-50 rounded-2xl border border-orange-200 hover:border-yellow hover:shadow-md transition-all"
              >
                <span className="text-3xl block mb-3">{SERVICE_ICONS[page.serviceType] || '\ud83d\udea8'}</span>
                <h3 className="font-display text-lg font-bold text-dark group-hover:text-yellow transition-colors mb-2">
                  {page.heroTitle}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed mb-3">
                  24/7 availability. Average response time under 1 hour.
                </p>
                <span className="text-sm font-semibold text-yellow">Call or WhatsApp now &rarr;</span>
              </Link>
            ))}
          </div>

          <EmergencyBlock serviceType="home repair" />
        </div>
      </section>

      {/* English Speaking Specialists */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{'\ud83c\uddec\ud83c\udde7'}</span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
              English Speaking Specialists
            </h2>
          </div>
          <p className="text-text-muted mb-8 max-w-2xl">
            Professionals who communicate fully in English. Perfect for expats, tourists and international property owners in Porto.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {englishSpeaking.map(page => (
              <Link
                key={page.slug}
                href={`/en/${page.slug}/`}
                className="group p-6 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{'\ud83c\uddec\ud83c\udde7'}</span>
                  <h3 className="font-display text-lg font-bold text-dark group-hover:text-yellow transition-colors">
                    {page.serviceType}
                  </h3>
                </div>
                <p className="text-sm text-text-muted leading-relaxed mb-3">
                  {page.heroSubtitle.split('.')[0]}.
                </p>
                <span className="text-sm font-semibold text-yellow">Learn more &rarr;</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage Area */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{'\ud83d\udccd'}</span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
              Service Coverage Area
            </h2>
          </div>
          <p className="text-text-muted mb-8 max-w-2xl">
            We serve the entire Porto metropolitan area and surrounding regions.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {['Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Valongo', 'Marco de Canaveses', 'Penafiel'].map(city => (
              <div key={city} className="p-4 bg-warm-gray rounded-2xl text-center">
                <span className="text-xl block mb-1">{'\ud83c\udfe0'}</span>
                <span className="font-display font-bold text-dark text-sm">{city}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Get a Free Quote Today
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Describe what you need and receive a no-obligation quote from verified professionals within 24 hours.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/en/plumber-porto/"
              className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              Request a Quote
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <a
              href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=Hi%20VITFIX%2C%20I%20need%20help%20with%20home%20services%20in%20Porto`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-[#20BD5A] hover:-translate-y-0.5 transition-all shadow-lg"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp Us
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
