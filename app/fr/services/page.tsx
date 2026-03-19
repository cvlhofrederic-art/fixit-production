import type { Metadata } from 'next'
import Link from 'next/link'
import { FR_SERVICES, FR_CITIES } from '@/lib/data/fr-seo-pages-data'

export const metadata: Metadata = {
  title: 'Services artisans Marseille — Plombier, Électricien, Peintre | VITFIX',
  description: 'Tous les services d\'artisans à Marseille et dans les Bouches-du-Rhône : plombier, électricien, peintre, plaquiste. Professionnels vérifiés, devis gratuit.',
  alternates: {
    canonical: 'https://vitfix.io/fr/services/',
    languages: {
      'fr': 'https://vitfix.io/fr/services/',
      'pt': 'https://vitfix.io/pt/servicos/',
      'x-default': 'https://vitfix.io/fr/services/',
    },
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Services artisans — Marseille et PACA',
  description: 'Annuaire de services d\'artisans qualifiés à Marseille et dans les Bouches-du-Rhône.',
  url: 'https://vitfix.io/fr/services/',
  inLanguage: 'fr-FR',
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
      { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://vitfix.io/fr/services/' },
    ],
  },
}

export default function FrServicesHubPage() {
  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="py-16 md:py-20" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/fr/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Services</span>
          </nav>
          <h1 className="font-display text-[clamp(2rem,4.5vw,3rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Services artisans à Marseille<br />
            <span className="text-yellow">et dans les Bouches-du-Rhône</span>
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            Trouvez un artisan qualifié pour tous vos travaux à Marseille, Aubagne, La Ciotat, Aix-en-Provence et dans tout le 13. Plombier, électricien, peintre, plaquiste — disponibles rapidement, devis gratuit.
          </p>
        </div>
      </section>

      {/* Services grid */}
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FR_SERVICES.map(service => (
              <div key={service.slug} className="bg-white rounded-2xl border border-border/50 overflow-hidden">
                <div className="p-6 border-b border-border/30">
                  <span className="text-4xl block mb-2">{service.icon}</span>
                  <h2 className="font-display font-bold text-xl mb-2">{service.name} à Marseille</h2>
                  <p className="text-sm text-text-muted leading-relaxed">{service.metaDesc.replace('{city}', 'Marseille')}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-3">Par ville</p>
                  <div className="grid grid-cols-2 gap-2">
                    {FR_CITIES.slice(0, 6).map(city => (
                      <Link
                        key={city.slug}
                        href={`/fr/services/${service.slug}-${city.slug}/`}
                        className="flex items-center gap-1.5 text-sm text-dark hover:text-yellow transition-colors p-1"
                      >
                        <span className="text-yellow">→</span>
                        {service.name} {city.name}
                      </Link>
                    ))}
                  </div>
                  <Link
                    href={`/fr/services/${service.slug}-marseille/`}
                    className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-yellow/10 text-dark font-semibold rounded-xl text-sm hover:bg-yellow/20 transition-colors"
                  >
                    Voir {service.name} Marseille
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
