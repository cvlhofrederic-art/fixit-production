import { Skeleton } from '@/components/syndic-dashboard/v54/primitives/skeleton'

const sectionHeader: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--v54-gold-700)',
  fontWeight: 600,
  margin: '32px 0 16px',
}

export default function SkeletonShowcasePage() {
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 2
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>Skeleton</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        Placeholder de chargement, shimmer 1.6s (gradient cream→#ece4d2→cream). Atome `.vfx-skeleton` +
        conteneurs card / row / kpi du bundle V5.7.
      </p>

      <h2 style={sectionHeader}>Barres (atome)</h2>
      <div data-testid="skeleton-bars" style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
        <Skeleton width="100%" height={12} />
        <Skeleton width="80%" height={12} />
        <Skeleton width="60%" height={12} />
      </div>

      <h2 style={sectionHeader}>Card</h2>
      <div style={{ maxWidth: 360 }}>
        <Skeleton variant="card" data-testid="skeleton-card">
          <div style={{ display: 'grid', gap: 10 }}>
            <Skeleton width="40%" height={12} />
            <Skeleton width="100%" height={10} />
            <Skeleton width="90%" height={10} />
            <Skeleton width="70%" height={10} />
          </div>
        </Skeleton>
      </div>

      <h2 style={sectionHeader}>Row (ligne de liste)</h2>
      <div style={{ maxWidth: 480 }}>
        {[0, 1].map((i) => (
          <Skeleton key={i} variant="row">
            <Skeleton width={40} height={40} radius="50%" />
            <div style={{ flex: 1, display: 'grid', gap: 6 }}>
              <Skeleton width="50%" height={10} />
              <Skeleton width="80%" height={10} />
            </div>
          </Skeleton>
        ))}
      </div>

      <h2 style={sectionHeader}>KPI</h2>
      <div style={{ display: 'flex', gap: 16 }}>
        <Skeleton
          variant="kpi"
          data-testid="skeleton-kpi"
          style={{ minWidth: 160, border: '1px solid var(--v54-line)', borderRadius: 'var(--v54-r-md)' }}
        >
          <Skeleton width="50%" height={10} />
          <Skeleton width="70%" height={26} style={{ marginTop: 12 }} />
        </Skeleton>
        <Skeleton
          variant="kpi"
          style={{ minWidth: 160, border: '1px solid var(--v54-line)', borderRadius: 'var(--v54-r-md)' }}
        >
          <Skeleton width="60%" height={10} />
          <Skeleton width="50%" height={26} style={{ marginTop: 12 }} />
        </Skeleton>
      </div>
    </div>
  )
}
