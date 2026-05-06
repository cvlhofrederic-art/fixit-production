import Link from 'next/link'

// Grid des villes proches utilisée dans les templates services × villes.
// Centralise le pattern dupliqué entre fr/services, fr/pres-de-chez-moi,
// pt/servicos, pt/perto-de-mim.

interface NearbyCity {
  slug: string
  name: string
  population: number
}

interface Props {
  readonly title: string
  readonly cities: readonly NearbyCity[]
  readonly serviceSlug: string
  readonly serviceName: string
  readonly serviceIcon: string
  readonly hrefPrefix: string // ex: '/fr/services' ou '/fr/pres-de-chez-moi'
  readonly localeForCount: 'fr-FR' | 'pt-PT'
  readonly inhabitantsLabel: string // 'hab.' ou 'hab.'
  readonly comboPrefix: string // 'à' ou 'em'
  readonly bgClassName?: string
}

export default function NearbyCitiesGrid({
  title,
  cities,
  serviceSlug,
  serviceName,
  serviceIcon,
  hrefPrefix,
  localeForCount,
  inhabitantsLabel,
  comboPrefix,
  bgClassName,
}: Props) {
  if (cities.length === 0) return null
  return (
    <section className={`py-14 ${bgClassName ?? ''}`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6">
          {title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {cities.map(nc => (
            <Link
              key={nc.slug}
              href={`${hrefPrefix}/${serviceSlug}-${nc.slug}/`}
              className="flex items-center gap-3 p-4 rounded-xl border border-border/50 hover:border-yellow hover:bg-yellow/5 transition-all group"
            >
              <span className="text-xl">{serviceIcon}</span>
              <div>
                <span className="font-semibold text-dark group-hover:text-yellow transition-colors">{serviceName} {comboPrefix} {nc.name}</span>
                <span className="block text-xs text-text-muted">{nc.population.toLocaleString(localeForCount)} {inhabitantsLabel}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
