'use client'

// ── Dashboard Skeleton / Loading Shell ────────────────────────────
// Displayed while lazy-loaded dashboard sections are being fetched.
// Used as the `loading` fallback for next/dynamic imports.
// Styled to match v22 design system.

const shimmer = {
  background: 'linear-gradient(90deg, var(--v22-border, #E8E8E4) 25%, var(--v22-surface, #FFFFFF) 50%, var(--v22-border, #E8E8E4) 75%)',
  backgroundSize: '200% 100%',
  animation: 'v22-shimmer 1.5s infinite',
  borderRadius: 4,
} as const

const DashboardSkeleton = () => (
  <div role="status" aria-label="Chargement" style={{ padding: 24, background: 'var(--v22-bg, #F7F7F5)' }}>
    {/* Page header skeleton */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--v22-border, #E8E8E4)' }}>
      <div style={{ ...shimmer, width: 180, height: 22 }} />
      <div style={{ ...shimmer, width: 140, height: 14 }} />
    </div>

    {/* Stats skeleton */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--v22-border, #E8E8E4)', border: '1px solid var(--v22-border, #E8E8E4)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ background: i === 1 ? 'var(--v22-yellow, #FFD600)' : 'var(--v22-surface, #FFFFFF)', padding: '14px 16px' }}>
          <div style={{ ...shimmer, width: 80, height: 10, marginBottom: 8, opacity: i === 1 ? 0.4 : 1 }} />
          <div style={{ ...shimmer, width: 50, height: 22, marginBottom: 4, opacity: i === 1 ? 0.4 : 1 }} />
          <div style={{ ...shimmer, width: 60, height: 11, opacity: i === 1 ? 0.4 : 1 }} />
        </div>
      ))}
    </div>

    {/* Cards skeleton */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 16 }}>
      <div style={{ background: 'var(--v22-surface, #FFFFFF)', border: '1px solid var(--v22-border, #E8E8E4)', borderRadius: 4 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--v22-border, #E8E8E4)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ ...shimmer, width: 120, height: 12 }} />
          <div style={{ ...shimmer, width: 70, height: 16, marginLeft: 'auto', borderRadius: 2 }} />
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < 4 ? '1px solid var(--v22-border, #E8E8E4)' : 'none' }}>
            <div style={{ ...shimmer, width: 32, height: 32, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <div style={{ ...shimmer, width: '60%', height: 12, marginBottom: 4 }} />
              <div style={{ ...shimmer, width: '80%', height: 10 }} />
            </div>
            <div style={{ ...shimmer, width: 50, height: 16, borderRadius: 2 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--v22-surface, #FFFFFF)', border: '1px solid var(--v22-border, #E8E8E4)', borderRadius: 4 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--v22-border, #E8E8E4)' }}>
            <div style={{ ...shimmer, width: 100, height: 12 }} />
          </div>
          <div style={{ padding: 14 }}>
            {[1, 2].map(i => (
              <div key={i} style={{ borderLeft: '2px solid var(--v22-yellow, #FFD600)', background: 'var(--v22-yellow-light, #FFFBE6)', borderRadius: '0 2px 2px 0', padding: '8px 10px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ ...shimmer, width: 38, height: 12 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...shimmer, width: '70%', height: 12, marginBottom: 3 }} />
                  <div style={{ ...shimmer, width: '50%', height: 10 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--v22-surface, #FFFFFF)', border: '1px solid var(--v22-border, #E8E8E4)', borderRadius: 4 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--v22-border, #E8E8E4)' }}>
            <div style={{ ...shimmer, width: 60, height: 12 }} />
          </div>
          <div style={{ padding: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderLeft: `3px solid ${i === 1 ? 'var(--v22-red, #C0392B)' : i === 2 ? 'var(--v22-amber, #8A6000)' : 'var(--v22-yellow, #FFD600)'}`, background: i === 1 ? 'var(--v22-red-light, #FDECEA)' : i === 2 ? 'var(--v22-amber-light, #FFF8E1)' : 'var(--v22-yellow-light, #FFFBE6)', borderRadius: '0 3px 3px 0', marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...shimmer, width: '80%', height: 12, marginBottom: 3 }} />
                  <div style={{ ...shimmer, width: '60%', height: 10 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    <span className="sr-only">Chargement en cours...</span>

    <style>{`
      @keyframes v22-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  </div>
)

export default DashboardSkeleton
