import type { Metadata } from 'next'
import Link from 'next/link'
import QuoteRequestForm from '@/components/en/QuoteRequestForm'
import TrustSignals from '@/components/en/TrustSignals'
import { PHONE_PT } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Emergency Home Repair in Porto | Available Now | VITFIX',
  description: 'Urgent home repair needed in Porto? English-speaking professionals available 24/7. Plumbing, electrical, handyman. Free quote in 15 minutes.',
  openGraph: {
    title: 'Emergency Home Repair in Porto | VITFIX',
    description: 'English-speaking emergency repair professionals available 24/7 in Porto. Fast response guaranteed.',
    type: 'website',
    siteName: 'VITFIX',
    locale: 'en_GB',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  alternates: {
    canonical: 'https://vitfix.io/en/emergency-home-repair-porto/',
  },
}

export default function AdsLandingPage() {
  const whatsappUrl = `https://wa.me/${PHONE_PT.replace('+', '')}?text=Hi%20VITFIX%2C%20I%20need%20emergency%20home%20repair%20in%20Porto.%20Please%20help!`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name: 'Emergency Home Repair in Porto',
        description: 'Emergency plumbing, electrical and handyman services for English-speaking residents in Porto.',
        provider: {
          '@type': 'LocalBusiness',
          name: 'VITFIX',
          telephone: PHONE_PT,
          address: { '@type': 'PostalAddress', addressLocality: 'Porto', addressCountry: 'PT' },
          aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '127' },
        },
        areaServed: { '@type': 'City', name: 'Porto' },
        availableLanguage: ['English', 'Portuguese'],
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR',
          description: 'Free quote with no obligation',
        },
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Minimal header — logo only */}
      <header className="bg-white border-b border-border/30 py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/en/" className="font-display text-2xl font-extrabold text-dark">
            VIT<span className="text-yellow">FIX</span>
          </Link>
          <div className="flex items-center gap-3">
            <a
              href={`tel:${PHONE_PT}`}
              className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-dark hover:text-yellow transition"
            >
              {'\ud83d\udcde'} +351 912 014 971
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-bold rounded-full px-4 py-2 text-sm hover:bg-[#20BD5A] transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO + FORM (above the fold) ── */}
      <section className="py-10 md:py-14" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
            {/* Left: Value prop */}
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 border border-red-200 text-sm font-semibold mb-4">
                <span className="animate-pulse">{'\ud83d\udd34'}</span>
                <span className="text-red-700">Professionals Available Now</span>
              </div>

              <h1 className="font-display text-[clamp(1.8rem,4vw,2.8rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
                Emergency Home Repair in Porto
              </h1>
              <p className="text-lg text-text-muted leading-relaxed mb-6">
                Plumbing, electrical or handyman emergency? Our English-speaking professionals respond within 1 hour across Porto.
              </p>

              {/* Trust signals inline */}
              <div className="mb-6">
                <TrustSignals variant="inline" />
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-border/50">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-9 h-9 rounded-full bg-yellow/20 border-2 border-white flex items-center justify-center text-xs font-bold text-dark">
                      {['\ud83d\udc68', '\ud83d\udc69', '\ud83d\udc68\u200d\ud83d\udd27', '\ud83d\udc69\u200d\ud83d\udd27'][i-1]}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-sm font-semibold text-dark">127 verified reviews</div>
                  <div className="text-xs text-text-muted">Trusted by expats and property owners in Porto</div>
                </div>
              </div>

              {/* Quick WhatsApp CTA */}
              <div className="mt-6">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white font-display font-bold rounded-full px-8 py-4 text-base transition-all hover:-translate-y-0.5 shadow-lg w-full sm:w-auto"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp for Instant Help
                </a>
                <p className="text-xs text-text-muted mt-2 text-center sm:text-left">Or call directly: <a href={`tel:${PHONE_PT}`} className="text-dark font-semibold">{PHONE_PT}</a></p>
              </div>
            </div>

            {/* Right: Form */}
            <div>
              <h2 className="font-display text-xl font-bold text-dark mb-3">Get a Free Quote in 15 Minutes</h2>
              <QuoteRequestForm
                serviceType="Home Repair"
                serviceName="Emergency Home Repair"
                isEmergency={true}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES COVERED ── */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8 text-center">
            Emergency Services We Provide
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {[
              { icon: '\ud83d\udebf', title: 'Emergency Plumbing', desc: 'Burst pipes, flooding, blocked drains and water leaks' },
              { icon: '\u26a1', title: 'Emergency Electrical', desc: 'Power outages, sparking outlets and electrical faults' },
              { icon: '\ud83d\udd28', title: 'Emergency Handyman', desc: 'Broken locks, storm damage, urgent repairs' },
              { icon: '\ud83c\udf21\ufe0f', title: 'Heating & Boiler', desc: 'Water heater failure, gas leaks, no hot water' },
              { icon: '\ud83d\udeaa', title: 'Lock & Security', desc: 'Locked out, broken locks, security door issues' },
              { icon: '\ud83c\udf0a', title: 'Water Damage', desc: 'Flood cleanup, damp treatment, leak repair' },
            ].map((service, i) => (
              <div key={i} className="p-5 bg-warm-gray rounded-2xl text-center">
                <span className="text-3xl block mb-3">{service.icon}</span>
                <h3 className="font-display font-bold text-dark mb-1">{service.title}</h3>
                <p className="text-sm text-text-muted">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8 text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '1', title: 'Describe the Issue', desc: 'Tell us what you need help with. Add photos if possible for a faster quote.' },
              { step: '2', title: 'Get a Quote', desc: 'Receive a free quote from a verified professional within 15 minutes for emergencies.' },
              { step: '3', title: 'Problem Solved', desc: 'Our professional arrives and handles the repair. Pay only after the job is done.' },
            ].map((item, i) => (
              <div key={i} className="text-center p-6 bg-white rounded-2xl border border-border/50">
                <div className="w-12 h-12 rounded-full bg-yellow flex items-center justify-center text-dark font-display font-extrabold text-lg mx-auto mb-4">{item.step}</div>
                <h3 className="font-display font-bold text-dark mb-2">{item.title}</h3>
                <p className="text-sm text-text-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Do Not Wait &mdash; Get Help Now
          </h2>
          <p className="text-text-muted mb-8">
            Our verified professionals are ready to help. Available 24/7 for emergencies across Porto.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-[#20BD5A] hover:-translate-y-0.5 transition-all shadow-lg"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp for Instant Help
            </a>
            <a
              href={`tel:${PHONE_PT}`}
              className="inline-flex items-center justify-center gap-2 bg-dark hover:bg-dark/90 text-white font-display font-bold rounded-full px-8 py-4 text-base hover:-translate-y-0.5 transition-all"
            >
              {'\ud83d\udcde'} Call +351 912 014 971
            </a>
          </div>
          <p className="mt-6 text-sm text-text-muted">
            <Link href="/en/" className="text-yellow hover:underline">Browse all services</Link> &middot;{' '}
            <Link href="/en/plumber-porto/" className="text-yellow hover:underline">Plumber</Link> &middot;{' '}
            <Link href="/en/electrician-porto/" className="text-yellow hover:underline">Electrician</Link> &middot;{' '}
            <Link href="/en/handyman-porto/" className="text-yellow hover:underline">Handyman</Link>
          </p>
        </div>
      </section>
    </div>
  )
}
