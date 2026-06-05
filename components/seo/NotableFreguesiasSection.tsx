import type { CityData } from '@/lib/data/seo-pages-data'

interface Props {
  city: CityData
}

export function NotableFreguesiasSection({ city }: Props) {
  const enriched = city.notableFreguesias ?? []
  const allFreguesias = city.freguesias

  return (
    <section className="py-14 md:py-18 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
          Freguesias de {city.name}
        </h2>
        <p className="text-text-muted mb-6">
          Os nossos profissionais atuam em todas as {allFreguesias.length} freguesias do concelho de {city.name}.
        </p>

        {enriched.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {enriched.map(f => (
              <article
                key={f.name}
                className="p-5 rounded-2xl bg-warm-gray/40 border border-border/40 hover:border-yellow/40 transition-colors"
              >
                <h3 className="font-display font-bold text-dark mb-2">{f.name}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{f.context}</p>
              </article>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {allFreguesias.map(f => (
            <span key={f} className="px-3 py-1.5 bg-warm-gray rounded-full text-sm text-dark/70 border border-border/30">
              {f}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
