import type { LocalPriceLine } from '@/lib/seo/service-prices'

// Tableau de prix locaux propriétaires affiché sur les pages programmatiques
// FR services × villes. Données : lib/prix-travaux-2026/data/*.ts
// (sources Tier 1 CAPEB/FFB/INSEE) + coefficient PACA 1.05.
//
// Objectif SEO 2026 : éviter le signal "thin content" sur le contenu
// programmatique en exposant des données vérifiables uniques par zone
// géographique. Cité par les Answer Engines (Perplexity, ChatGPT).

interface Props {
  readonly prices: LocalPriceLine[]
  readonly cityName: string
  readonly serviceName: string
}

const UNIT_LABEL: Record<string, string> = {
  m2: '/m²',
  ml: '/ml',
  unite: '/unité',
  forfait: 'forfait',
  jour: '/jour',
  m3: '/m³',
  heure: '/h',
}

function formatPriceRange(line: LocalPriceLine): string {
  const unit = UNIT_LABEL[line.unit] || ''
  if (line.priceMin === line.priceMax) return `${line.priceMin} € ${unit}`.trim()
  return `${line.priceMin}-${line.priceMax} € ${unit}`.trim()
}

export default function LocalPricingSection({ prices, cityName, serviceName }: Props) {
  if (prices.length === 0) return null

  // Date la plus récente de vérification parmi toutes les lignes.
  // Tri explicite via localeCompare pour fiabilité multi-locale (Sonar reliability).
  const lastVerified = [...prices.map(p => p.lastVerified)]
    .sort((a, b) => b.localeCompare(a))[0]

  // Sources uniques (déduplication par nom).
  const allSources = prices.flatMap(p => p.sources)
  const uniqueSources = Array.from(
    new Map(allSources.map(s => [s.name, s])).values(),
  ).slice(0, 6)

  return (
    <section className="py-14 md:py-18 bg-warm-gray">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-baseline justify-between flex-wrap gap-4 mb-3">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight">
            Prix indicatifs {serviceName.toLowerCase()} à {cityName} — 2026
          </h2>
          <span className="text-xs text-text-muted">
            Mis à jour {new Date(lastVerified).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <p className="text-text-muted mb-8 max-w-2xl text-sm leading-relaxed">
          Fourchettes de prix TTC indicatives ajustées à la zone PACA (coefficient
          régional CAPEB +5%). Estimations à confirmer par devis personnalisé.
        </p>

        <div className="bg-white rounded-2xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-warm-gray/60 border-b border-border/50">
              <tr>
                <th className="text-left px-5 py-3 font-display font-semibold text-dark/80">Prestation</th>
                <th className="text-right px-5 py-3 font-display font-semibold text-dark/80 whitespace-nowrap">Prix indicatif</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((line, i) => (
                <tr key={line.taskId} className={i > 0 ? 'border-t border-border/30' : ''}>
                  <td className="px-5 py-4">
                    <div className="font-medium text-dark mb-1">{line.label}</div>
                    {line.description && (
                      <div className="text-xs text-text-muted leading-relaxed line-clamp-2">{line.description}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap font-display font-bold text-dark">
                    {formatPriceRange(line)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sources — E-E-A-T 2026 : citer ses sources renforce l'autorité éditoriale. */}
        <details className="mt-4 text-xs text-text-muted">
          <summary className="cursor-pointer hover:text-dark transition select-none">
            Sources & méthodologie
          </summary>
          <ul className="mt-3 space-y-1.5 pl-4 list-disc">
            {uniqueSources.map(s => (
              <li key={s.name}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-dark underline">
                    {s.name}
                  </a>
                ) : (
                  <span>{s.name}</span>
                )}
                <span className="ml-1 text-text-muted/70">— Tier {s.tier}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-text-muted/80">
            Coefficient PACA 1.05 (CAPEB Provence-Alpes-Côte d&apos;Azur 2026). Méthodologie complète dans nos données prix-travaux-2026.
          </p>
        </details>
      </div>
    </section>
  )
}
