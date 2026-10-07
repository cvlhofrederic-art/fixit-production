import SyndicDashboardV54 from '@/components/syndic-dashboard/v54/SyndicDashboardV54'
import { V54LocaleProvider } from '@/lib/syndic/v54/i18n/context'

/**
 * Sandbox dev de la version française du dashboard syndic classique (gated par
 * app/syndic/dev/layout.tsx → 404 hors localhost).
 * La sandbox PT (/syndic/dev/dashboard) reste en portugais quel que soit le
 * préfixe d'URL : les specs E2E l'ouvrent par /fr/syndic/dev/dashboard/ et
 * vérifient des textes PT.
 */
export default function DevDashboardFrPage() {
  return (
    <V54LocaleProvider locale="fr-FR">
      <SyndicDashboardV54 />
    </V54LocaleProvider>
  )
}
