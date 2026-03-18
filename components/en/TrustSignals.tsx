// ─── Trust Signals for EN service pages ───
// Server Component — no 'use client' needed

interface TrustSignalsProps {
  variant?: 'inline' | 'grid'
}

export default function TrustSignals({ variant = 'inline' }: TrustSignalsProps) {
  const signals = [
    { icon: '\u2b50', label: '4.9/5', sublabel: '127 reviews' },
    { icon: '\u2705', label: 'Verified', sublabel: 'Professionals' },
    { icon: '\u23f1\ufe0f', label: '< 30 min', sublabel: 'Response time' },
    { icon: '\ud83d\udcc5', label: '7/7', sublabel: 'Available' },
  ]

  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {signals.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 text-center border border-border/50">
            <span className="text-2xl block mb-2">{s.icon}</span>
            <span className="font-display font-bold text-dark block">{s.label}</span>
            <span className="text-xs text-text-muted">{s.sublabel}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-4 md:gap-6">
      {signals.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-lg">{s.icon}</span>
          <span className="text-sm font-semibold text-dark">{s.label}</span>
          <span className="text-xs text-text-muted hidden sm:inline">{s.sublabel}</span>
        </div>
      ))}
    </div>
  )
}
