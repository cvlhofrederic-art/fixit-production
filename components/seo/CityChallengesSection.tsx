import type { CityData } from '@/lib/data/seo-pages-data'

interface Props {
  city: CityData
}

export function CityChallengesSection({ city }: Props) {
  if (!city.climateChallenges?.length) return null

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl p-6 md:p-10 bg-white border border-border/40">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-yellow/15 flex items-center justify-center text-2xl">
              🛠️
            </div>
            <div>
              <h2 className="font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-bold tracking-tight text-dark">
                Desafios de construção em {city.name}
              </h2>
              <p className="text-text-muted text-sm mt-1">
                Os profissionais VITFIX conhecem as especificidades locais e adaptam as soluções.
              </p>
            </div>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {city.climateChallenges.map((challenge, i) => (
              <li
                key={i}
                className="flex items-start gap-3 p-4 rounded-xl bg-warm-gray/40 border border-border/30"
              >
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-yellow/30 flex items-center justify-center text-xs font-bold text-dark">
                  {i + 1}
                </span>
                <span className="text-sm text-dark leading-relaxed">{challenge}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
