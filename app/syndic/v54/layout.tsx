import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SYNDIC_V54_LIVE } from '@/lib/syndic/v54-flag'
import { v54FontVariables } from '@/components/syndic-dashboard/v54/tokens/fonts'
import '@/components/syndic-dashboard/v54/tokens/tokens.css'
import '@/components/syndic-dashboard/v54/tokens/fonts.css'
import '@/components/syndic-dashboard/v54/modules/canal.css'
import '@/components/syndic-dashboard/v54/modules/planeamento.css'
import '@/components/syndic-dashboard/v54/modules/reservaesp.css'

/**
 * Route LIVE (production) du dashboard syndic v54 — /syndic/v54.
 *
 * Contrairement à /syndic/dev/* (gated localhost → 404 en prod), cette route est
 * servie en production, contrôlée par le feature flag SYNDIC_V54_LIVE :
 *   - true  → rend le dashboard v54 (design system, données mock).
 *   - false → notFound() → rollback (la route disparaît de la prod).
 *
 * L'ancien dashboard /syndic/dashboard (vraies données, agents IA réels) n'est PAS
 * touché : cette route vit à côté. Wrap dans #syndic-dashboard-v54 pour activer
 * les variables --v54-* et les fonts next/font, comme la sandbox dev.
 *
 * noindex : on n'indexe pas une preview en données mock.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

export default function SyndicV54LiveLayout({ children }: { children: React.ReactNode }) {
  if (!SYNDIC_V54_LIVE) {
    notFound()
  }
  return (
    <div
      id="syndic-dashboard-v54"
      className={v54FontVariables}
      style={{
        minHeight: '100vh',
        background: 'var(--v54-paper)',
        color: 'var(--v54-ink)',
        fontFamily: 'var(--v54-font-sans)',
        padding: '32px',
      }}
    >
      {children}
    </div>
  )
}
