import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'

const sectionHeader: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'var(--v54-gold-700)', fontWeight: 600, margin: '32px 0 16px',
}

export default function PanelShowcasePage() {
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 4
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>Panel</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        Carte de section : header (icône + titre + sous-titre + slot droit) + corps (padding ou `flush`).
      </p>

      <h2 style={sectionHeader}>Complet</h2>
      <div style={{ maxWidth: 520 }} data-testid="panel-demo">
        <Panel
          icon="building"
          title="Edifício Central"
          sub="Rua das Flores, 12 — Porto"
          right={<span style={{ fontSize: 12, color: 'var(--v54-sage-700)' }}>● Ativo</span>}
        >
          <p style={{ margin: 0, fontSize: 13, color: 'var(--v54-navy-500)' }}>
            42 frações · próxima assembleia 14/06.
          </p>
        </Panel>
      </div>

      <h2 style={sectionHeader}>Flush (corps sans padding)</h2>
      <div style={{ maxWidth: 520 }}>
        <Panel title="Lista" flush>
          <div style={{ padding: '12px 22px', fontSize: 13, color: 'var(--v54-navy-500)', borderTop: '1px solid var(--v54-line)' }}>
            Ligne pleine largeur (flush).
          </div>
        </Panel>
      </div>
    </div>
  )
}
