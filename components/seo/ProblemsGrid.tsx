// Grid de problèmes résolus utilisée dans les templates programmatiques
// services × villes. Évite duplication entre locales (Sonar CPD).

interface Props {
  readonly title: string
  readonly intro: string
  readonly problems: readonly string[]
  readonly serviceIcon: string
}

export default function ProblemsGrid({ title, intro, problems, serviceIcon }: Props) {
  return (
    <section className="py-14 md:py-18 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-3">
          {title}
        </h2>
        <p className="text-text-muted mb-8 max-w-2xl">{intro}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {problems.map((problem, i) => (
            <div key={`${i}-${problem.slice(0, 16)}`} className="flex items-start gap-3 p-4 rounded-xl border border-border/50 hover:border-yellow/30 transition-colors">
              <span className="flex-shrink-0 text-yellow text-lg mt-0.5">{serviceIcon}</span>
              <span className="text-[0.93rem] text-dark">{problem}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
