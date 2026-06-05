import SyndicDashboardV54 from '@/components/syndic-dashboard/v54/SyndicDashboardV54'

/**
 * Sandbox dev (gated par app/syndic/dev/layout.tsx → 404 hors localhost).
 * Rend le dashboard v54 partagé. Le MÊME composant est servi en prod sur
 * /syndic/dashboard via le feature flag (lib/syndic/v54-flag.ts).
 */
export default function DevDashboardPage() {
  return <SyndicDashboardV54 />
}
