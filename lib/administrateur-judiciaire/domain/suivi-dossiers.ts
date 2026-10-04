/** Suivi du temps passé et des échéances des dossiers (écran Suivi des dossiers). */

/**
 * Date de référence de l'écran (Date locale du 19/06/2026). Indépendante du mode démo/réel et différente de la date
 * de démonstration (04/06/2026) : les dates « 19/06 » écrites en dur par l'écran lui correspondent.
 */
export const DATE_REFERENCE_SUIVI_DOSSIERS = new Date(2026, 5, 19)

/**
 * « JJ/MM/AAAA » → Date locale ; null si absente ou « — ». Aucune validation des parties
 * (« 08/07 » donne une Date invalide) : ne pas remplacer par dateFrVersDate.
 */
export const parserDateEcheanceSuivi = (valeur: string | null | undefined): Date | null => {
  if (!valeur || valeur === '—') return null
  const parties = valeur.split('/').map(Number)
  return new Date(parties[2], parties[1] - 1, parties[0])
}

export type CleStatutSuiviDossier = 'retard' | 'urgent' | 'ok'

export interface StatutSuiviDossier {
  k: CleStatutSuiviDossier
  pill: 'rust' | 'amber' | 'sage'
  label: string
}

/**
 * En retard si le retard dépasse le seuil ou si l'échéance est passée ; échéance proche à 5 jours au plus ; sinon à jour.
 * Une échéance « — » ne compte pas (seul le retard joue).
 */
export const calculerStatutSuiviDossier = (
  dossier: { echeance: string | null | undefined; retard: number },
  seuilJours: number,
): StatutSuiviDossier => {
  const echeance = parserDateEcheanceSuivi(dossier.echeance),
    jours = echeance ? Math.round((echeance.getTime() - DATE_REFERENCE_SUIVI_DOSSIERS.getTime()) / 864e5) : null
  return dossier.retard > seuilJours || (jours != null && jours < 0)
    ? {
        k: 'retard',
        pill: 'rust',
        label: 'En retard',
      }
    : jours != null && jours <= 5
      ? {
          k: 'urgent',
          pill: 'amber',
          label: 'Échéance proche',
        }
      : {
          k: 'ok',
          pill: 'sage',
          label: 'À jour',
        }
}
