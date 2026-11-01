import { Empty } from '@/components/syndic-dashboard/v54/primitives/empty'
import { EMPTY_ILLUSTRATIONS } from '@/lib/syndic/empty-illustrations'

const sectionHeader: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'var(--v54-gold-700)', fontWeight: 600, margin: '32px 0 16px',
}

const NAMES = Object.keys(EMPTY_ILLUSTRATIONS) as Array<keyof typeof EMPTY_ILLUSTRATIONS>

export default function EmptyShowcasePage() {
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 4
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>Empty</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        État vide : illustration SVG (port bundle) ou badge-circle + icône en fallback.
      </p>

      <h2 style={sectionHeader}>Fallback badge-circle</h2>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }} data-testid="empty-badge">
        <div style={{ minWidth: 240, border: '1px solid var(--v54-line)', borderRadius: 12 }}>
          <Empty icon="check" kind="sage" title="Tudo em ordem" desc="Nenhuma ocorrência aberta." />
        </div>
        <div style={{ minWidth: 240, border: '1px solid var(--v54-line)', borderRadius: 12 }}>
          <Empty icon="bell" kind="gold" title="Sem notificações" desc="Está tudo lido." />
        </div>
      </div>

      <h2 style={sectionHeader}>Illustrations du bundle ({NAMES.length})</h2>
      <div
        data-testid="empty-illus-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}
      >
        {NAMES.map((name) => (
          <div key={name} style={{ border: '1px solid var(--v54-line)', borderRadius: 12 }}>
            <Empty illustration={name} title={name} desc={`illustration: ${name}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
