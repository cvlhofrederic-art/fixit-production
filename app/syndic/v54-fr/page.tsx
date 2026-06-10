import SyndicDashboardV54FR from '@/components/syndic-dashboard/v54-fr/SyndicDashboardV54FR'

/**
 * Dashboard syndic judiciaire FR — route LIVE en production (/syndic/v54-fr),
 * contrôlée par le flag SYNDIC_V54_FR_LIVE (cf. ./layout.tsx).
 */
export default function SyndicV54FRLivePage() {
  return <SyndicDashboardV54FR />
}
