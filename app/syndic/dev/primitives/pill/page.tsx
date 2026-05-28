import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'

const KINDS: Array<{ kind?: PillKind; label: string }> = [
  { kind: undefined, label: 'défaut' },
  { kind: 'sage', label: 'sage' },
  { kind: 'gold', label: 'gold' },
  { kind: 'amber', label: 'amber' },
  { kind: 'rust', label: 'rust' },
  { kind: 'dark', label: 'dark' },
]

const sectionHeader: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--v54-gold-700)',
  fontWeight: 600,
  margin: '32px 0 16px',
}

export default function PillShowcasePage() {
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 2
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>Pill</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        Badge/étiquette. 6 kinds (défaut + sage/gold/amber/rust/dark), point indicateur 5×5 optionnel.
      </p>

      <h2 style={sectionHeader}>Avec point (défaut)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        {KINDS.map(({ kind, label }) => (
          <Pill key={label} kind={kind}>{label}</Pill>
        ))}
      </div>

      <h2 style={sectionHeader}>Sans point (noDot)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        {KINDS.map(({ kind, label }) => (
          <Pill key={label} kind={kind} noDot>{label}</Pill>
        ))}
      </div>

      <h2 style={sectionHeader}>En contexte (exemple dashboard)</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Pill kind="sage">Operação estável</Pill>
        <Pill kind="gold">Sincronizado há 2 min</Pill>
        <Pill kind="amber">6 ordens pendentes</Pill>
      </div>
    </div>
  )
}
