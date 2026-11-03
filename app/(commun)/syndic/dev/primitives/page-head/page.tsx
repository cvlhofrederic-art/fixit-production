import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'

const sectionHeader: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'var(--v54-gold-700)', fontWeight: 600, margin: '32px 0 16px',
}
const btn: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8,
  border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-navy-700)', cursor: 'pointer',
}

export default function PageHeadShowcasePage() {
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 4
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>PageHead</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        En-tête de page : eyebrow (kicker gold) + titre serif + lede + slot actions à droite.
      </p>

      <h2 style={sectionHeader}>Exemple</h2>
      <div data-testid="page-head-demo">
        <PageHead
          eyebrow="Gestão · Condomínio"
          title="Painel de controlo"
          lede="Visão geral do condomínio Edifício Central — quotas, ocorrências e assembleias."
          actions={<button style={btn}>Nova ocorrência</button>}
        />
      </div>
    </div>
  )
}
