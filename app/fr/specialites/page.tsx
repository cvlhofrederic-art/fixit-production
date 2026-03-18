import type { Metadata } from 'next'
import Link from 'next/link'
import { PHONE_FR } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Spécialités VITFIX Marseille — Élagage palmier, débarras succession, fuite urgence',
  description: 'Pages spécialistes VITFIX : élagage palmier PACA, débroussaillage obligation légale, débarras succession, remplacement chauffe-eau, fuite urgence, rénovation salle de bain Marseille.',
  alternates: {
    canonical: 'https://vitfix.io/fr/specialites/',
  },
}

const SPECIALITES = [
  {
    icon: '🌴',
    name: 'Élagage Palmier PACA',
    slug: 'elagage-palmier',
    description: 'Taille palmier, traitement charançon rouge, taille ananas et marguerite. Spécialiste palmiers en Provence.',
    keywords: ['élagage palmier marseille', 'taille palmier la ciotat', 'charançon rouge PACA'],
  },
  {
    icon: '🔥',
    name: 'Débroussaillage Obligation PACA',
    slug: 'debroussaillage-paca',
    description: 'Obligation légale de débroussaillement (OLD) en PACA. Avant le 15 juin, 50 m autour des habitations. Évitez l\'amende.',
    keywords: ['débroussaillage obligation PACA', 'OLD marseille', 'débroussaillage légal'],
  },
  {
    icon: '📦',
    name: 'Débarras Succession Marseille',
    slug: 'debarras-succession',
    description: 'Vide maison après décès, débarras appartement succession, EHPAD. Service discret, rapide, éco-responsable.',
    keywords: ['débarras succession marseille', 'vide maison après décès', 'débarras EHPAD'],
  },
  {
    icon: '🚿',
    name: 'Remplacement Chauffe-eau Marseille',
    slug: 'chauffe-eau',
    description: 'Remplacement chauffe-eau en panne à Marseille et PACA. Thermodynamique, électrique, gaz. Intervention sous 24h.',
    keywords: ['remplacement chauffe-eau marseille', 'chauffe-eau en panne', 'chauffe-eau thermodynamique PACA'],
  },
  {
    icon: '💧',
    name: 'Fuite d\'Eau Urgence Marseille',
    slug: 'fuite-eau-urgence',
    description: 'Fuite d\'eau urgente à Marseille : plafond qui fuit, fuite cachée sous carrelage, dégât des eaux. Intervention 24h/24.',
    keywords: ['fuite eau urgence marseille', 'dégât des eaux marseille', 'fuite cachée détection'],
  },
  {
    icon: '🛁',
    name: 'Rénovation Salle de Bain Marseille',
    slug: 'renovation-salle-de-bain',
    description: 'Rénovation complète salle de bain à Marseille : plomberie, carrelage, douche italienne, PMR. Clé en main.',
    keywords: ['rénovation salle de bain marseille', 'réfection salle de bain', 'douche italienne marseille'],
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LocalBusiness',
      name: 'VITFIX — Spécialités Artisans Marseille PACA',
      description: 'Services spécialisés à Marseille et en PACA : élagage palmier, débroussaillage, débarras succession, rénovation salle de bain.',
      url: 'https://vitfix.io/fr/specialites/',
      telephone: PHONE_FR,
      areaServed: { '@type': 'AdministrativeArea', name: 'Bouches-du-Rhône' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
        { '@type': 'ListItem', position: 2, name: 'Spécialités', item: 'https://vitfix.io/fr/specialites/' },
      ],
    },
  ],
}

export default function SpecialitesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-warm-gray">
        {/* Hero */}
        <section className="pt-16 pb-12 md:pt-20 md:pb-16" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="Fil d'Ariane" className="text-sm text-text-muted mb-6">
              <Link href="/fr/" className="hover:text-yellow transition">VITFIX</Link>
              <span className="mx-2">/</span>
              <span className="text-dark font-medium">Spécialités</span>
            </nav>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-4">
              <span>⭐</span>
              <span className="text-dark">Expertise locale</span>
            </div>

            <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
              Spécialités Artisans PACA
            </h1>
            <p className="text-lg text-text-muted max-w-2xl leading-relaxed">
              Pages experts sur les interventions spécifiques à Marseille et la région PACA :
              palmiers, obligations légales, successions, urgences. Des artisans qui connaissent
              les particularités locales.
            </p>
          </div>
        </section>

        {/* Stats bar */}
        <section className="bg-dark text-white py-5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { value: '6', label: 'Spécialités' },
                { value: '24h', label: 'Intervention rapide' },
                { value: '100%', label: 'Artisans vérifiés' },
                { value: 'PACA', label: 'Région couverte' },
              ].map(stat => (
                <div key={stat.label}>
                  <span className="font-display text-2xl md:text-3xl font-extrabold text-yellow">{stat.value}</span>
                  <span className="block text-sm text-white/70 mt-0.5">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Grid spécialités */}
        <section className="py-14 md:py-18">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-8">
              <span className="text-2xl">🔧</span>
              <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-dark">
                Nos domaines d&apos;expertise
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SPECIALITES.map((spec) => (
                <Link
                  key={spec.slug}
                  href={`/fr/specialites/${spec.slug}/`}
                  className="group bg-white rounded-2xl border border-border/50 p-6 hover:border-yellow hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <span className="text-4xl block mb-4 group-hover:scale-110 transition-transform inline-block">{spec.icon}</span>
                  <h2 className="font-display text-xl font-bold text-dark mb-2 group-hover:text-yellow transition-colors">
                    {spec.name}
                  </h2>
                  <p className="text-text-muted text-sm mb-4 leading-relaxed">
                    {spec.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {spec.keywords.slice(0, 2).map((kw) => (
                      <span
                        key={kw}
                        className="text-xs bg-yellow/10 border border-yellow/25 text-dark px-2.5 py-1 rounded-full"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-border/30 flex items-center justify-between">
                    <span className="text-sm font-semibold text-yellow">Voir la page</span>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-yellow"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight mb-4">
              Vous avez un besoin spécifique ?
            </h2>
            <p className="text-text-muted mb-8 max-w-md mx-auto">
              Nos artisans PACA sont spécialisés sur chaque métier et chaque zone géographique.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/fr/services/"
                className="inline-flex items-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-8 py-4 text-base hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
              >
                Tous les services
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              <a
                href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=Bonjour%2C%20j%27ai%20besoin%20d%27un%20artisan%20sp%C3%A9cialis%C3%A9%20%C3%A0%20Marseille`}
                className="inline-flex items-center gap-2 border-2 border-dark text-dark rounded-full font-display font-bold px-8 py-4 text-base bg-transparent hover:bg-dark hover:text-white transition-all"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>💬</span> WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
