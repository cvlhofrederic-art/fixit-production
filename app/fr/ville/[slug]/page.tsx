import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FR_CITIES, FR_SERVICES, getFrCityBySlug } from '@/lib/data/fr-seo-pages-data'
import { PHONE_FR } from '@/lib/constants'

export function generateStaticParams() {
  return FR_CITIES.map(city => ({ slug: city.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const city = getFrCityBySlug(slug)
  if (!city) return {}

  const title = `Artisans à ${city.name} — Plombier, Électricien, Peintre | VITFIX`
  const description = `Trouvez un artisan qualifié à ${city.name} (${city.department}) : plombier, électricien, peintre, plaquiste. Devis gratuit, disponibles 7j/7.`

  return {
    title,
    description,
    alternates: { canonical: `https://vitfix.io/fr/ville/${slug}/` },
    openGraph: { title, description, siteName: 'VITFIX', locale: 'fr_FR', type: 'website', images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }] },
  }
}

export default async function FrVillePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const city = getFrCityBySlug(slug)
  if (!city) notFound()

  const nearbyCities = city.nearbyCities
    .map(n => FR_CITIES.find(c => c.name === n))
    .filter((c): c is typeof FR_CITIES[0] => c !== undefined)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HomeAndConstructionBusiness',
        name: `VITFIX — Artisans à ${city.name}`,
        description: `Services artisans à ${city.name} : plombier, électricien, peintre, serrurier, chauffagiste. Professionnels vérifiés, devis gratuit, réponse en 2h.`,
        url: `https://vitfix.io/fr/ville/${slug}/`,
        image: 'https://vitfix.io/og-image.png',
        logo: 'https://vitfix.io/og-image.png',
        areaServed: { '@type': 'City', name: city.name },
        telephone: PHONE_FR,
        address: {
          '@type': 'PostalAddress',
          addressLocality: city.name,
          addressRegion: city.region || 'Provence-Alpes-Côte d\'Azur',
          addressCountry: 'FR',
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
          reviewCount: '12000',
          bestRating: '5',
          worstRating: '1',
        },
        serviceType: [
          'Plomberie', 'Électricité', 'Serrurerie', 'Peinture', 'Plaquiste',
          'Chauffage', 'Climatisation', 'Menuiserie', 'Maçonnerie', 'Carrelage',
        ],
        priceRange: '€€',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
          { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://vitfix.io/fr/services/' },
          { '@type': 'ListItem', position: 3, name: city.name, item: `https://vitfix.io/fr/ville/${slug}/` },
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
            <Link href="/fr/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <Link href="/fr/services/" className="hover:text-yellow transition">Services</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">{city.name}</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span>📍</span>
            <span className="text-dark">{city.department} · {city.region}</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Artisans à {city.name}
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-6 leading-relaxed">
            Trouvez un plombier, électricien, peintre ou plaquiste qualifié à {city.name} ({city.population.toLocaleString('fr-FR')} habitants). Disponibles rapidement, devis gratuit.
          </p>
          <a
            href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${encodeURIComponent(`Bonjour VITFIX, je cherche un artisan à ${city.name}. Pouvez-vous m'aider ?`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Demander un devis gratuit
          </a>
        </div>
      </section>

      {/* SERVICES DISPONIBLES */}
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
            Artisans disponibles à {city.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FR_SERVICES.map(service => (
              <Link
                key={service.slug}
                href={`/fr/services/${service.slug}-${city.slug}/`}
                className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group"
              >
                <span className="text-3xl flex-shrink-0">{service.icon}</span>
                <div>
                  <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors block">{service.name} à {city.name}</span>
                  <span className="text-xs text-text-muted mt-0.5 block">Devis gratuit · Disponible 7j/7</span>
                </div>
                <svg className="ml-auto flex-shrink-0 text-yellow opacity-0 group-hover:opacity-100 transition-opacity" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* QUARTIERS */}
      <section className="py-14 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
            Quartiers couverts à {city.name}
          </h2>
          <p className="text-text-muted mb-6">
            Nos artisans interviennent dans tous les quartiers de {city.name} et ses environs.
          </p>
          <div className="flex flex-wrap gap-2">
            {city.quartiers.map(q => (
              <span key={q} className="px-3 py-1.5 bg-warm-gray rounded-full text-sm text-dark/70 border border-border/30">{q}</span>
            ))}
          </div>
        </div>
      </section>

      {/* VILLES PROCHES */}
      {nearbyCities.length > 0 && (
        <section className="py-14">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
              Communes proches
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {nearbyCities.map(nc => (
                <Link
                  key={nc.slug}
                  href={`/fr/ville/${nc.slug}/`}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border/50 hover:border-yellow hover:bg-yellow/5 transition-all group"
                >
                  <span className="text-xl">📍</span>
                  <div>
                    <span className="font-semibold text-dark group-hover:text-yellow transition-colors">Artisans {nc.name}</span>
                    <span className="block text-xs text-text-muted">{nc.population.toLocaleString('fr-FR')} hab.</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* URGENCE CTA */}
      <section className="py-12 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl p-8" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <span className="text-yellow font-bold text-sm uppercase tracking-wider block mb-2">⚠️ Urgence {city.name} — 24h/7j</span>
                <h3 className="font-display text-xl font-bold text-white mb-1">Besoin d&apos;un artisan en urgence ?</h3>
                <p className="text-white/60 text-sm">Fuite d&apos;eau, panne électrique — intervention rapide à {city.name}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <a
                  href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${encodeURIComponent(`URGENCE à ${city.name} ! J'ai besoin d'un artisan immédiatement.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold rounded-full px-6 py-3 text-sm hover:bg-[#20ba59] transition-all whitespace-nowrap"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp Urgence
                </a>
                <Link
                  href="/fr/urgence/"
                  className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-bold rounded-full px-6 py-3 text-sm hover:bg-yellow-light transition-all whitespace-nowrap"
                >
                  Services urgence
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
