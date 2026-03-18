import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FR_SERVICES, FR_CITIES, getFrServiceBySlug, getFrCityBySlug, type FrServiceData, type FrCityData } from '@/lib/data/fr-seo-pages-data'
import { PHONE_FR } from '@/lib/constants'

// ──────────────────────────────────────────────────────────────────────────────
// Slug resolver
// Patterns:
//   plombier            → service générique (pas de ville)
//   plombier-marseille  → service + ville
//   electricien-aubagne → service + ville
// Total: 4 génériques + 32 service×ville = 36 slugs
// ──────────────────────────────────────────────────────────────────────────────

interface Resolved {
  service: FrServiceData
  city: FrCityData | null
}

function resolveSlug(slug: string): Resolved | null {
  // 1. Direct service match (generic)
  const directService = getFrServiceBySlug(slug)
  if (directService) return { service: directService, city: null }

  // 2. service-city: iterate services and check prefix
  for (const service of FR_SERVICES) {
    const prefix = `${service.slug}-`
    if (slug.startsWith(prefix)) {
      const citySlug = slug.slice(prefix.length)
      const city = getFrCityBySlug(citySlug)
      if (city) return { service, city }
    }
  }

  return null
}

// ── Generate all 36 static params ──
export function generateStaticParams() {
  const params: { slug: string }[] = []

  // 4 generic service slugs
  for (const service of FR_SERVICES) {
    params.push({ slug: service.slug })
  }

  // 32 service × city slugs
  for (const service of FR_SERVICES) {
    for (const city of FR_CITIES) {
      params.push({ slug: `${service.slug}-${city.slug}` })
    }
  }

  return params
}

// ── Metadata ──
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const resolved = resolveSlug(slug)
  if (!resolved) return {}

  const { service, city } = resolved
  const cityLabel = city ? ` à ${city.name}` : ' près de chez moi'
  const title = `${service.name}${cityLabel} — Artisan disponible rapidement | VITFIX`
  const description = city
    ? `Vous cherchez un ${service.name.toLowerCase()} à ${city.name} ? Artisan disponible rapidement dans votre quartier. Devis gratuit, 7j/7.`
    : `Vous cherchez un ${service.name.toLowerCase()} près de chez vous ? Artisans vérifiés disponibles à Marseille et dans les Bouches-du-Rhône. Devis gratuit.`

  return {
    title,
    description,
    alternates: { canonical: `https://vitfix.io/fr/pres-de-chez-moi/${slug}/` },
    openGraph: { title, description, siteName: 'VITFIX', locale: 'fr_FR', type: 'website' },
  }
}

// ── Page ──
export default async function FrPresDeChezMoiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const resolved = resolveSlug(slug)
  if (!resolved) notFound()

  const { service, city } = resolved
  const cityLabel = city ? ` à ${city.name}` : ' près de chez vous'
  const cityName = city?.name ?? 'Marseille et alentours'
  const waText = encodeURIComponent(`Bonjour VITFIX, je cherche un ${service.name.toLowerCase()}${city ? ` à ${city.name}` : ' près de chez moi'}. Pouvez-vous m'aider ?`)

  const nearbyCities = city
    ? (city.nearbyCities
        .map(n => FR_CITIES.find(c => c.name === n))
        .filter((c): c is FrCityData => c !== undefined))
    : FR_CITIES.slice(0, 5)

  const otherServices = FR_SERVICES.filter(s => s.slug !== service.slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        name: `VITFIX — ${service.name}${cityLabel}`,
        description: city
          ? `${service.name} à ${city.name} et ses quartiers. Intervention rapide.`
          : `${service.name} disponible dans tout Marseille et les Bouches-du-Rhône.`,
        url: `https://vitfix.io/fr/pres-de-chez-moi/${slug}/`,
        telephone: PHONE_FR,
        areaServed: city
          ? { '@type': 'City', name: city.name }
          : { '@type': 'AdministrativeArea', name: 'Bouches-du-Rhône' },
        ...(city && {
          geo: { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lng },
          address: {
            '@type': 'PostalAddress',
            addressLocality: city.name,
            addressRegion: 'Bouches-du-Rhône',
            addressCountry: 'FR',
          },
        }),
        openingHoursSpecification: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: '08:00',
          closes: '20:00',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
          { '@type': 'ListItem', position: 2, name: 'Près de chez moi', item: 'https://vitfix.io/fr/pres-de-chez-moi/' },
          { '@type': 'ListItem', position: 3, name: `${service.name}${cityLabel}`, item: `https://vitfix.io/fr/pres-de-chez-moi/${slug}/` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `Comment trouver un ${service.name.toLowerCase()} près de chez moi à ${cityName} ?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Contactez VITFIX via WhatsApp ou par téléphone. Nous avons des ${service.name.toLowerCase()}s disponibles ${city ? `à ${city.name} et dans ses quartiers` : 'dans tout Marseille et le département 13'}. Nous vous mettons en relation rapidement avec un professionnel vérifié.`,
            },
          },
          {
            '@type': 'Question',
            name: `Quel est le délai d'intervention d'un ${service.name.toLowerCase()} à ${cityName} ?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Le délai d'intervention varie selon la disponibilité et votre localisation. En urgence, nos ${service.name.toLowerCase()}s peuvent intervenir en 30 à 60 minutes. Pour un devis ou une intervention planifiée, nous répondons dans la journée.`,
            },
          },
          ...service.faqs.slice(0, 2),
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/fr/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <span className="hover:text-yellow transition cursor-default">Près de chez moi</span>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">{service.name}{city ? ` ${city.name}` : ''}</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span className="text-lg">{service.icon}</span>
            <span className="text-dark">📍 {service.name} près de chez vous</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            {service.name}{cityLabel} —<br />
            <span className="text-yellow">Artisan disponible rapidement</span>
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            {city
              ? `Vous cherchez un ${service.name.toLowerCase()} à ${city.name} ? Nos artisans interviennent dans tous les quartiers. Devis gratuit, réponse sous 30 minutes.`
              : `Vous cherchez un ${service.name.toLowerCase()} près de chez vous ? Nous avons des artisans vérifiés à Marseille, Aubagne, La Ciotat, Aix-en-Provence et dans tout le 13.`
            }
          </p>

          <div className="flex flex-wrap gap-3 mb-10">
            <a
              href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Trouver un {service.name.toLowerCase()} maintenant
            </a>
            <a
              href={`tel:${PHONE_FR}`}
              className="inline-flex items-center gap-2 border-[1.5px] border-dark text-dark rounded-full font-medium px-7 py-3 text-[0.95rem] bg-transparent hover:bg-dark hover:text-white transition-all"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z"/></svg>
              Appeler
            </a>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Artisans vérifiés</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Devis gratuit</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> 7j/7</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Réponse sous 30 min</span>
          </div>
        </div>
      </section>

      {/* ── CITY DETAILS (if city) ── */}
      {city && (
        <section className="py-14 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
              {service.name} dans votre quartier à {city.name}
            </h2>
            <p className="text-text-muted mb-6">
              Nos artisans couvrent l&apos;ensemble de {city.name} ({city.population.toLocaleString('fr-FR')} habitants) — tous les quartiers sont couverts :
            </p>
            <div className="flex flex-wrap gap-2 mb-8">
              {city.quartiers.map(q => (
                <span key={q} className="px-3 py-1.5 bg-warm-gray rounded-full text-sm text-dark/70 border border-border/30">{q}</span>
              ))}
            </div>
            <Link
              href={`/fr/services/${service.slug}-${city.slug}/`}
              className="inline-flex items-center gap-2 text-yellow font-semibold hover:underline text-sm"
            >
              Voir la page complète {service.name} {city.name}
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </section>
      )}

      {/* ── FEATURES ── */}
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            Ce que nos {service.name.toLowerCase()}s font près de chez vous
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

      {/* ── NEARBY CITIES ── */}
      <section className="py-14 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
            {service.name} dans les communes proches
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {nearbyCities.map(nc => (
              <Link
                key={nc.slug}
                href={`/fr/pres-de-chez-moi/${service.slug}-${nc.slug}/`}
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
        </div>
      </section>

      {/* ── OTHER SERVICES ── */}
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
            Autres artisans{city ? ` à ${city.name}` : ' près de chez vous'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {otherServices.map(os => (
              <Link
                key={os.slug}
                href={`/fr/pres-de-chez-moi/${os.slug}${city ? `-${city.slug}` : ''}/`}
                className="p-6 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group text-center"
              >
                <span className="text-3xl block mb-3">{os.icon}</span>
                <span className="font-display font-bold text-dark group-hover:text-yellow transition-colors">{os.name}</span>
                {city && <span className="block text-sm text-text-muted mt-1">à {city.name}</span>}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            Questions fréquentes
          </h2>
          <div className="space-y-4">
            <details className="group rounded-2xl border border-border/50 bg-warm-gray overflow-hidden">
              <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                <span className="text-[0.95rem]">Comment trouver un {service.name.toLowerCase()} près de chez moi à {cityName} ?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
              </summary>
              <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">
                Contactez VITFIX via WhatsApp ou par téléphone. Nos {service.name.toLowerCase()}s sont disponibles {city ? `à ${city.name} et dans ses quartiers` : 'dans tout Marseille et le département 13'}. Nous vous mettons en relation rapidement avec un professionnel vérifié, disponible rapidement.
              </div>
            </details>
            {service.faqs.map((faq, i) => (
              <details key={i} className="group rounded-2xl border border-border/50 bg-warm-gray overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                  <span className="text-[0.95rem]">{faq.question.replace(/\{city\}/g, cityName)}</span>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">
                  {faq.answer.replace(/\{city\}/g, cityName)}
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
            Votre {service.name.toLowerCase()} {city ? `à ${city.name}` : 'près de chez vous'}, disponible maintenant
          </h2>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Devis gratuit, sans engagement. Réponse sous 30 minutes.
          </p>
          <a
            href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-8 py-4 text-base hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Contacter par WhatsApp — Devis gratuit
          </a>
        </div>
      </section>
    </div>
  )
}
