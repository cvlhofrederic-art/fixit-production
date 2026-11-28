import Link from 'next/link'

/**
 * Index of the v54 design system sandbox. Lists the available QA surfaces.
 * Phase 1 ships /tokens (étape a) first. /primitives, /shell, /dashboard
 * arrive in étapes b/c/d.
 */
export default function SyndicV54DevIndex() {
  const links: Array<{ href: string; label: string; sub: string; available: boolean }> = [
    {
      href: '/syndic/dev/tokens',
      label: 'Tokens',
      sub: 'Couleurs, radii, ombres, typographie (étape a)',
      available: true,
    },
    {
      href: '/syndic/dev/primitives',
      label: 'Primitives',
      sub: 'Icon, Pill, Panel, KPI, Empty, Tabs… (étape b, à venir)',
      available: false,
    },
    {
      href: '/syndic/dev/shell',
      label: 'Shell',
      sub: 'Sidebar, Topbar, CommandPalette, NotifsPopover (étape c, à venir)',
      available: false,
    },
    {
      href: '/syndic/dev/dashboard',
      label: 'Painel de controlo',
      sub: 'ModDashboard pixel-perfect (étape d, à venir)',
      available: false,
    },
  ]

  return (
    <main style={{ maxWidth: 720 }}>
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
        VitFix Syndic Dashboard · V5.4 design system
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
        Sandbox <span style={{ fontStyle: 'italic', color: 'var(--v54-gold-700)' }}>v54</span>
      </h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 12, marginBottom: 32 }}>
        Espace de validation visuelle des étapes Phase 1 du redesign syndic PT.
        Accessible uniquement hors production.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {links.map((link) => {
          const card = (
            <div
              style={{
                background: '#fff',
                border: '1px solid var(--v54-line)',
                borderRadius: 'var(--v54-r-lg)',
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                opacity: link.available ? 1 : 0.55,
                transition: 'border-color var(--v54-dur) var(--v54-ease-std), transform var(--v54-dur) var(--v54-ease-std)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: 'var(--v54-font-serif)',
                    fontSize: 22,
                    fontWeight: 500,
                    color: 'var(--v54-navy-900)',
                  }}
                >
                  {link.label}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 4 }}>
                  {link.sub}
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: link.available ? 'var(--v54-sage-700)' : 'var(--v54-navy-200)',
                  fontWeight: 600,
                }}
              >
                {link.available ? 'Disponible' : 'À venir'}
              </div>
            </div>
          )
          return (
            <li key={link.href}>
              {link.available ? (
                <Link href={link.href} style={{ textDecoration: 'none' }}>
                  {card}
                </Link>
              ) : (
                card
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
