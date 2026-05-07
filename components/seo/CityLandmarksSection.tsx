import type { CityData } from '@/lib/data/seo-pages-data'

interface Props {
  city: CityData
}

export function CityLandmarksSection({ city }: Props) {
  if (!city.landmarks?.length) return null

  return (
    <section className="py-12 md:py-16 bg-warm-gray/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-bold tracking-tight text-dark mb-2">
          Pontos de referência em {city.name}
        </h2>
        <p className="text-text-muted text-sm mb-6 max-w-2xl">
          Trabalhamos perto destes locais, com tempos de resposta otimizados para toda a área urbana.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {city.landmarks.map((landmark, i) => (
            <div
              key={i}
              className="px-4 py-3 rounded-xl bg-white border border-border/40 text-sm text-dark/85 flex items-center gap-2.5"
            >
              <span className="text-yellow text-base shrink-0">◆</span>
              <span className="leading-snug">{landmark}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
