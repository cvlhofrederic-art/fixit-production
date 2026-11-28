import { KPI, KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'

const sectionHeader: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'var(--v54-gold-700)', fontWeight: 600, margin: '32px 0 16px',
}

export default function KPIShowcasePage() {
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 4
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>KPI / KPIGrid</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        Indicateur clé (nombre serif + devise/suffixe, accent, tendance, pastille, visuel central) et grille
        auto-fit minmax(180px).
      </p>

      <h2 style={sectionHeader}>KPIGrid (auto-fit) — 4 accents + tendances</h2>
      <div data-testid="kpi-grid-demo">
        <KPIGrid
          items={[
            { icon: 'building', num: '12', lbl: 'Condomínios', sub: '+2 este mês', accent: 'gold' },
            { icon: 'coin', num: '48 320', cur: '€', lbl: 'Quotas recebidas', accent: 'sage', trend: { kind: 'ok', label: '+8%' } },
            { icon: 'alert', num: '6', lbl: 'Ocorrências abertas', accent: 'rust', trend: { kind: 'bad', label: '+3' } },
            { icon: 'calendar', num: '3', lbl: 'Assembleias', accent: 'amber', trend: { kind: 'warn', label: '2 esta semana' } },
          ]}
        />
      </div>

      <h2 style={sectionHeader}>Toutes les props</h2>
      <div data-testid="kpi-props" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <KPI icon="chart" num="100" lbl="Basique" sub="icon · num · lbl · sub" />
        <KPI num="75" suffix="%" lbl="suffix" accent="sage" />
        <KPI dot="rust" num="3" lbl="dot (pastille)" sub="sans icône" />
        <KPI icon="coin" num="1 250" cur="€" lbl="cur (devise)" trend={{ kind: 'flat', label: '=' }} />
        <KPI num="A+" lblFirst lbl="lblFirst" sub="label avant le num" />
        <KPI icon="users" lbl="numChildren" numChildren={<span style={{ fontSize: 16 }}>12 / 20</span>} subChildren={<em style={{ fontSize: 11 }}>slots custom</em>} />
        <KPI icon="bell" num="∞" lbl="centerVisual" centerVisual={<div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid var(--v54-sage-500)' }} />} />
      </div>
    </div>
  )
}
