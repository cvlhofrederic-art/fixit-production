import type { CityData } from '@/lib/data/seo-pages-data'

interface Props {
  city: CityData
}

export function CitySpecialtySection({ city }: Props) {
  if (!city.specialty) return null

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-10">
          <div className="md:w-1/3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-xs font-semibold text-dark mb-3">
              <span>📍</span>
              <span>Identidade local</span>
            </span>
            <h2 className="font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-bold tracking-tight text-dark leading-tight">
              {city.name}, na sua essência
            </h2>
          </div>
          <div className="md:w-2/3">
            <p className="text-text-muted text-base leading-relaxed">{city.specialty}</p>
            {city.localEconomy ? (
              <p className="mt-4 text-sm text-text-muted/80 leading-relaxed">
                <span className="font-semibold text-dark">Economia local : </span>
                {city.localEconomy}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
