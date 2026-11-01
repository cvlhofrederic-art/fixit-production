import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { SYNDIC_V54_CLASSIQUE_FR_LIVE } from '@/lib/syndic/v54-flag'

/**
 * Dashboard syndic → nouveau design V5.7.
 *
 * La route principale /syndic/dashboard redirige désormais vers /pt/syndic/v54,
 * ou vers /fr/syndic/v54 quand la requête arrive par /fr (en-tête x-locale posé
 * par le middleware) et que la version française est activée.
 * Aucune perte de données : l'ancien dashboard et v54 consomment EXACTEMENT les
 * mêmes endpoints (/api/syndic/immeubles, /missions, /coproprios, /artisans, /team…)
 * donc les tables syndic_* scopées cabinet_id — les données existantes suivent.
 *
 * L'ancien composant reste dans l'historique git (réversible : restaurer ce fichier
 * depuis le commit précédent suffit à revenir à l'ancien design).
 */
export default async function SyndicDashboardPage() {
  const francais = SYNDIC_V54_CLASSIQUE_FR_LIVE && (await headers()).get('x-locale') === 'fr'
  redirect(francais ? '/fr/syndic/v54' : '/pt/syndic/v54')
}
