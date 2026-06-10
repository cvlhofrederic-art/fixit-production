import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SYNDIC_V54_FR_LIVE } from '@/lib/syndic/v54-flag'
import { v54FontVariables } from '@/components/syndic-dashboard/v54/tokens/fonts'
import '@/components/syndic-dashboard/v54/tokens/tokens.css'
import '@/components/syndic-dashboard/v54/tokens/fonts.css'
import '@/components/syndic-dashboard/v54-fr/tokens-fr.css'
import '@/components/syndic-dashboard/v54/modules/canal.css'
import '@/components/syndic-dashboard/v54/modules/planeamento.css'
import '@/components/syndic-dashboard/v54/modules/reservaesp.css'

/**
 * Route LIVE (production) du dashboard syndic judiciaire FR — /syndic/v54-fr.
 *
 * Déclinaison française « syndic judiciaire » (loi du 10 juillet 1965 / décret du
 * 17 mars 1967) du design system v54. Même mécanique que /syndic/v54 (PT) :
 *   - flag SYNDIC_V54_FR_LIVE : true → servie en prod ; false → notFound().
 *   - wrapper #syndic-dashboard-v54 : réutilise les tokens --v54-* et les fonts
 *     next/font existants (pages distinctes → aucune collision DOM avec le PT).
 *   - noindex : preview en données mock, pas d'indexation.
 *
 * Le dashboard PT (/syndic/v54) et l'ancien /syndic/dashboard ne sont PAS touchés.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

export default function SyndicV54FRLiveLayout({ children }: { children: React.ReactNode }) {
  if (!SYNDIC_V54_FR_LIVE) {
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
