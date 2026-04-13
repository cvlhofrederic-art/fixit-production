import type { Metadata } from 'next'
import Link from 'next/link'
import { NL_INVESTOR_PAGES } from '@/lib/data/investor-pages-data'
import EmergencyBlock from '@/components/en/EmergencyBlock'
import { PHONE_PT } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Vastgoeddiensten Porto | Voor Nederlandse Investeerders | VITFIX',
  description: 'Renovatie, loodgieter, elektricien en onderhoud voor Nederlandse en Belgische vastgoedeigenaren in Porto. Geverifieerde vakmensen, gratis offerte, begeleiding op afstand.',
  openGraph: {
    title: 'Vastgoeddiensten Porto | VITFIX',
    description: 'Geverifieerde vakmensen voor al uw vastgoedbehoeften in Porto. Gratis offerte.',
    type: 'website',
    siteName: 'VITFIX',
    locale: 'nl_NL',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vastgoeddiensten Porto | VITFIX',
    description: 'Geverifieerde vakmensen voor al uw vastgoedbehoeften in Porto. Gratis offerte.',
  },
  alternates: {
    canonical: 'https://vitfix.io/nl/',
    languages: {
      'fr': 'https://vitfix.io/fr/',
      'pt': 'https://vitfix.io/pt/',
      'en': 'https://vitfix.io/en/',
      'nl': 'https://vitfix.io/nl/',
      'es': 'https://vitfix.io/es/',
      'x-default': 'https://vitfix.io/',
    },
  },
}

const SERVICE_ICONS: Record<string, string> = {
  renovation: '\ud83c\udfd7\ufe0f',
  plumbing: '\ud83d\udebf',
  electrical: '\u26a1',
  maintenance: '\ud83d\udd11',
}

export default function NlHubPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Vastgoeddiensten Porto - VITFIX',
        description: 'Renovatie, loodgieter, elektricien en onderhoud voor Nederlandse investeerders in Porto.',
        url: 'https://vitfix.io/nl/',
        inLanguage: 'nl',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/nl/' },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-4">
            <span>{'\ud83c\uddf3\ud83c\uddf1'}</span>
            <span className="text-dark">Nederlandse Service</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Vastgoeddiensten in Porto
          </h1>
          <p className="text-lg text-text-muted max-w-2xl leading-relaxed mb-6">
            Betrouwbare vakmensen voor renovatie, loodgieterwerk, elektra en onderhoud van uw vastgoed in Porto. Speciaal voor Nederlandse en Belgische investeerders.
          </p>

          {/* Trust signals */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-yellow">&#9733;</span>
              <span className="font-semibold text-dark">4.9/5</span>
              <span className="text-text-muted">(127 beoordelingen)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>&#9989;</span>
              <span className="text-text-muted">Geverifieerde vakmensen</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>&#9201;</span>
              <span className="text-text-muted">Reactie &lt; 30 min</span>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Onze Diensten
          </h2>
          <p className="text-text-muted mb-8 max-w-2xl">
            Selecteer een dienst voor meer informatie en een gratis offerte van geverifieerde vakmensen.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {NL_INVESTOR_PAGES.map(page => (
              <Link
                key={page.slug}
                href={`/nl/${page.slug}/`}
                className="group p-6 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all"
              >
                <span className="text-4xl block mb-4">{SERVICE_ICONS[page.serviceKey] || '\ud83d\udd27'}</span>
                <h3 className="font-display text-xl font-bold text-dark group-hover:text-yellow transition-colors mb-2">
                  {page.heroTitle}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed mb-4">
                  {page.heroSubtitle.split('.')[0]}.
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-border/30">
                  <span className="text-sm font-semibold text-yellow">Gratis offerte</span>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-yellow"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Emergency Block */}
      <section className="py-14 md:py-18 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmergencyBlock serviceType="home repair" locale="nl" />
        </div>
      </section>

      {/* Coverage Area */}
      <section className="py-14 md:py-18">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{'\ud83d\udccd'}</span>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
              Servicegebied
            </h2>
          </div>
          <p className="text-text-muted mb-8 max-w-2xl">
            Wij bedienen de hele metropoolregio Porto en omgeving.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {['Porto', 'Vila Nova de Gaia', 'Matosinhos', 'Maia', 'Gondomar', 'Valongo', 'Marco de Canaveses', 'Penafiel'].map(city => (
              <div key={city} className="p-4 bg-white rounded-2xl text-center border border-border/30">
                <span className="text-xl block mb-1">{'\ud83c\udfe0'}</span>
                <span className="font-display font-bold text-dark text-sm">{city}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
            Vraag Vandaag een Gratis Offerte Aan
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Beschrijf wat u nodig heeft en ontvang een vrijblijvende offerte van geverifieerde vakmensen binnen 24 uur.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/nl/appartement-renovatie-porto/"
              className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              Offerte Aanvragen
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <a
              href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=Hallo%20VITFIX%2C%20ik%20heb%20hulp%20nodig%20met%20mijn%20vastgoed%20in%20Porto`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-[#20BD5A] hover:-translate-y-0.5 transition-all shadow-lg"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
