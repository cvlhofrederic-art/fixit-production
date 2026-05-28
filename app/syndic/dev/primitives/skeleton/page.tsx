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
        Placeholder de chargement, shimmer 1.6s (gradient cream→#ece4d2→cream). 3 variantes.
      </p>

      <h2 style={sectionHeader}>Text (lignes)</h2>
      <div style={{ display: 'grid', gap: 8, maxWidth: 480 }} data-testid="skeleton-text">
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="60%" />
      </div>

      <h2 style={sectionHeader}>Card</h2>
      <Skeleton variant="card" width={320} height={120} />

      <h2 style={sectionHeader}>Circle (avatar)</h2>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <Skeleton variant="circle" width={34} height={34} />
        <Skeleton variant="circle" width={48} height={48} />
        <Skeleton variant="circle" width={64} height={64} />
      </div>

      <h2 style={sectionHeader}>Composition (ex : list-row chargement)</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', maxWidth: 480 }}>
        <Skeleton variant="circle" width={40} height={40} />
        <div style={{ display: 'grid', gap: 6, flex: 1 }}>
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="text" width="80%" />
        </div>
      </div>
    </div>
  )
}
