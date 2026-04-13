'use client'

import { useThemeVars } from './useThemeVars'

// ── Dashboard Skeleton / Loading Shell ────────────────────────────
// Displayed while lazy-loaded dashboard sections are being fetched.
// Used as the `loading` fallback for next/dynamic imports.
// Styled to match v22 design system.

const DashboardSkeleton = () => {
  const isV5 = false
  const tv = useThemeVars(isV5)

  const shimmer = {
    background: `linear-gradient(90deg, ${tv.border} 25%, ${tv.surface} 50%, ${tv.border} 75%)`,
    backgroundSize: '200% 100%',
    animation: 'v22-shimmer 1.5s infinite',
    borderRadius: 4,
  } as const

  return (
  <div role="status" aria-label="Chargement" style={{ padding: 24, background: tv.bg }}>
    {/* Page header skeleton */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${tv.border}` }}>
      <div style={{ ...shimmer, width: 180, height: 22 }} />
      <div style={{ ...shimmer, width: 140, height: 14 }} />
    </div>

    {/* Stats skeleton */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: tv.border, border: `1px solid ${tv.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ background: i === 1 ? tv.primary : tv.surface, padding: '14px 16px' }}>
          <div style={{ ...shimmer, width: 80, height: 10, marginBottom: 8, opacity: i === 1 ? 0.4 : 1 }} />
          <div style={{ ...shimmer, width: 50, height: 22, marginBottom: 4, opacity: i === 1 ? 0.4 : 1 }} />
          <div style={{ ...shimmer, width: 60, height: 11, opacity: i === 1 ? 0.4 : 1 }} />
        </div>
      ))}
    </div>

    {/* Cards skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 mb-4">
      <div style={{ background: tv.surface, border: `1px solid ${tv.border}`, borderRadius: 4 }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${tv.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ ...shimmer, width: 120, height: 12 }} />
          <div style={{ ...shimmer, width: 70, height: 16, marginLeft: 'auto', borderRadius: 2 }} />
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < 4 ? `1px solid ${tv.border}` : 'none' }}>
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
        <div style={{ background: tv.surface, border: `1px solid ${tv.border}`, borderRadius: 4 }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${tv.border}` }}>
            <div style={{ ...shimmer, width: 100, height: 12 }} />
          </div>
          <div style={{ padding: 14 }}>
            {[1, 2].map(i => (
              <div key={i} style={{ borderLeft: `2px solid ${tv.primary}`, background: tv.primaryLight, borderRadius: '0 2px 2px 0', padding: '8px 10px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ ...shimmer, width: 38, height: 12 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...shimmer, width: '70%', height: 12, marginBottom: 3 }} />
                  <div style={{ ...shimmer, width: '50%', height: 10 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: tv.surface, border: `1px solid ${tv.border}`, borderRadius: 4 }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${tv.border}` }}>
            <div style={{ ...shimmer, width: 60, height: 12 }} />
          </div>
          <div style={{ padding: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderLeft: `3px solid ${i === 1 ? tv.red : i === 2 ? tv.primary : tv.primary}`, background: i === 1 ? tv.redBg : i === 2 ? tv.primaryLight : tv.primaryLight, borderRadius: '0 3px 3px 0', marginBottom: 6 }}>
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
}

export default DashboardSkeleton
