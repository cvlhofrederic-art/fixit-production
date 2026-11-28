import SyndicDashboardV54 from '@/components/syndic-dashboard/v54/SyndicDashboardV54'

/**
 * Dashboard syndic v54 — route LIVE en production (/syndic/v54), contrôlée par le
 * flag SYNDIC_V54_LIVE (cf. ./layout.tsx). Rend le composant partagé : exactement
 * le même que la sandbox dev (/syndic/dev/dashboard), servi cette fois en prod.
 */
export default function SyndicV54LivePage() {
  return <SyndicDashboardV54 />
}
