import Link from 'next/link'

/** Index des primitives v54. Phase 1 étape b — batch 1 livre Icon. */
export default function PrimitivesIndex() {
  return (
    <div>
      <p
        style={{
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--v54-gold-700)',
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        VitFix Syndic Dashboard · V5.4 design system · étape b
      </p>
      <h1
        style={{
          fontFamily: 'var(--v54-font-serif)',
          fontWeight: 500,
          fontSize: 48,
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          margin: 0,
        }}
      >
        Primitives <span style={{ fontStyle: 'italic', color: 'var(--v54-gold-700)' }}>v54</span>
      </h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 12 }}>
        17 primitives portées en 8 batchs. Sélectionne une primitive dans la barre latérale.
        Batch 1 livré : <Link href="/syndic/dev/primitives/icon" style={{ color: 'var(--v54-gold-700)' }}>Icon</Link>.
      </p>
    </div>
  )
}
