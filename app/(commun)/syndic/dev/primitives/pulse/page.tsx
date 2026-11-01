import { Pulse } from '@/components/syndic-dashboard/v54/primitives/pulse'
import { Icon } from '@/components/syndic-dashboard/v54/primitives/icon'

const sectionHeader: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--v54-gold-700)',
  fontWeight: 600,
  margin: '32px 0 16px',
}

export default function PulseShowcasePage() {
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 2
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>Pulse</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', maxWidth: 640, marginTop: 8 }}>
        Point indicateur animé 7×7 #ef4444, halo paper, pulsation 2.4s. Nu : positionné par le consommateur.
      </p>

      <h2 style={sectionHeader}>Nu</h2>
      <Pulse />

      <h2 style={sectionHeader}>En contexte (bell badge — positionné en absolute par le consommateur)</h2>
      <button
        type="button"
        aria-label="Voir les notifications (3 non lues)"
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          display: 'grid',
          placeItems: 'center',
          border: '1px solid var(--v54-line)',
          borderRadius: 'var(--v54-r-md)',
          background: '#fff',
          color: 'var(--v54-navy-600)',
          cursor: 'pointer',
        }}
      >
        <Icon name="bell" style={{ width: 16, height: 16 }} />
        <Pulse style={{ position: 'absolute', top: 7, right: 7 }} />
      </button>
    </div>
  )
}
