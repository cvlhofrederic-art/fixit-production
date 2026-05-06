// Grid de features de service réutilisée à travers les pages programmatiques
// (services, urgência/urgence, perto-de-mim/pres-de-chez-moi). Évite la
// duplication de markup identique entre locales et templates.

interface Props {
  readonly title: string
  readonly features: readonly string[]
  readonly className?: string
  readonly bgClassName?: string
}

export default function ServiceFeaturesGrid({ title, features, className, bgClassName }: Props) {
  return (
    <section className={`py-14 md:py-18 ${bgClassName ?? ''}`}>
      <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${className ?? ''}`}>
        <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
          {title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((feature, i) => (
            <div key={`${i}-${feature.slice(0, 16)}`} className="flex items-start gap-3 p-4 bg-white rounded-xl border border-border/50">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold mt-0.5">✓</span>
              <span className="text-[0.93rem] text-dark leading-relaxed">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
