import { redirect } from 'next/navigation'

/**
 * Dashboard syndic → nouveau design V5.7 (PT).
 *
 * La route principale /syndic/dashboard redirige désormais vers /pt/syndic/v54.
 * Aucune perte de données : l'ancien dashboard et v54 consomment EXACTEMENT les
 * mêmes endpoints (/api/syndic/immeubles, /missions, /coproprios, /artisans, /team…)
 * donc les tables syndic_* scopées cabinet_id — les données existantes suivent.
 *
 * L'ancien composant reste dans l'historique git (réversible : restaurer ce fichier
 * depuis le commit précédent suffit à revenir à l'ancien design).
 */
export default function SyndicDashboardPage() {
  redirect('/pt/syndic/v54')
}
