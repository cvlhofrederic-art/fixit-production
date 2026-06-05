import Link from 'next/link'

/**
 * Showcase Storybook-like des primitives v54. Sidebar gauche (liste des 17
 * primitives) + main droite (la primitive focus). Hérite du gate hostname +
 * namespace #syndic-dashboard-v54 du layout parent app/syndic/dev/layout.tsx.
 */

type PrimitiveLink = { slug: string; label: string; batch: number; ready: boolean }

const PRIMITIVES: PrimitiveLink[] = [
  { slug: 'icon', label: 'Icon', batch: 1, ready: true },
  { slug: 'pill', label: 'Pill', batch: 2, ready: true },
  { slug: 'skeleton', label: 'Skeleton', batch: 2, ready: true },
  { slug: 'pulse', label: 'Pulse', batch: 2, ready: true },
  { slug: 'toggle', label: 'Toggle', batch: 3, ready: true },
  { slug: 'segmented-control', label: 'SegmentedControl', batch: 3, ready: true },
  { slug: 'field', label: 'Field', batch: 3, ready: true },
  { slug: 'form-row', label: 'FormRow', batch: 3, ready: true },
  { slug: 'panel', label: 'Panel', batch: 4, ready: true },
  { slug: 'kpi', label: 'KPI / KPIGrid', batch: 4, ready: true },
  { slug: 'empty', label: 'Empty', batch: 4, ready: true },
  { slug: 'alert', label: 'Alert', batch: 4, ready: true },
  { slug: 'page-head', label: 'PageHead', batch: 4, ready: true },
  { slug: 'tabs', label: 'Tabs', batch: 5, ready: true },
  { slug: 'modal', label: 'Modal', batch: 6, ready: true },
  { slug: 'toast', label: 'Toast', batch: 7, ready: true },
  { slug: 'agent-chat-page', label: 'AgentChatPage', batch: 8, ready: true },
]

export default function PrimitivesShowcaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 32, alignItems: 'start' }}>
      <aside
        style={{
          position: 'sticky',
          top: 32,
          background: '#fff',
          border: '1px solid var(--v54-line)',
          borderRadius: 'var(--v54-r-lg)',
          padding: 16,
        }}
      >
        <p
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--v54-gold-700)',
            fontWeight: 600,
            margin: '0 0 12px',
          }}
        >
          Primitives v54 · {PRIMITIVES.filter((p) => p.ready).length}/{PRIMITIVES.length}
        </p>
        <nav style={{ display: 'grid', gap: 2 }}>
          {PRIMITIVES.map((p) => (
            <Link
              key={p.slug}
              href={`/syndic/dev/primitives/${p.slug}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 'var(--v54-r-sm)',
                fontSize: 13,
                color: p.ready ? 'var(--v54-navy-900)' : 'var(--v54-navy-200)',
                textDecoration: 'none',
                pointerEvents: p.ready ? 'auto' : 'none',
                background: 'transparent',
              }}
            >
              <span>{p.label}</span>
              <span
                style={{
                  fontSize: 9.5,
                  fontFamily: 'var(--v54-font-mono)',
                  color: p.ready ? 'var(--v54-sage-700)' : 'var(--v54-navy-200)',
                }}
              >
                {p.ready ? `b${p.batch}` : `b${p.batch}·…`}
              </span>
            </Link>
          ))}
        </nav>
      </aside>
      <main style={{ minWidth: 0 }}>{children}</main>
    </div>
  )
}
