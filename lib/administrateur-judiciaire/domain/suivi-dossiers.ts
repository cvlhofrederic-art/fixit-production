/** Suivi du temps passé et des échéances des dossiers (écran Suivi des dossiers). */

import { MODE_ACTIF, type Mode } from '@/lib/administrateur-judiciaire/mode'

/**
 * Date de référence de l'écran EN DÉMONSTRATION (Date locale du 19/06/2026), différente de la date de démonstration
 * générale (04/06/2026) : les dates « 19/06 » du jeu de démonstration de l'écran lui correspondent.
 * Ne vaut qu'en démonstration : en mode réel, la référence est la date système (voir calculerDateReferenceSuiviDossiers).
 */
export const DATE_REFERENCE_SUIVI_DOSSIERS = new Date(2026, 5, 19)

/**
 * Date de référence de l'écran pour un mode donné : 19/06/2026 en démonstration, minuit local de `maintenant` en
 * mode réel. Fonction pure : la date système est injectée, jamais lue ici.
 */
export const calculerDateReferenceSuiviDossiers = (mode: Mode, maintenant: Date): Date =>
  mode === 'demo'
    ? new Date(DATE_REFERENCE_SUIVI_DOSSIERS)
    : new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())

/** Date de référence de la session (le changement de mode recharge la page, comme pour DATE_DU_JOUR_ISO). */
export const DATE_REFERENCE_SUIVI_COURANTE: Date = calculerDateReferenceSuiviDossiers(MODE_ACTIF, new Date())

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

/** Jours (arrondis) de la date de référence à l'échéance « JJ/MM/AAAA » ; null si l'échéance est absente ou « — ». */
export const joursAvantEcheanceSuivi = (
  echeance: string | null | undefined,
  dateReference: Date = DATE_REFERENCE_SUIVI_COURANTE,
): number | null => {
  const date = parserDateEcheanceSuivi(echeance)
  return date ? Math.round((date.getTime() - dateReference.getTime()) / 864e5) : null
}

/**
 * En retard si le retard dépasse le seuil ou si l'échéance est passée ; échéance proche à 5 jours au plus ; sinon à jour.
 * Une échéance « — » ne compte pas (seul le retard joue).
 */
export const calculerStatutSuiviDossier = (
  dossier: { echeance: string | null | undefined; retard: number },
  seuilJours: number,
  dateReference: Date = DATE_REFERENCE_SUIVI_COURANTE,
): StatutSuiviDossier => {
  const jours = joursAvantEcheanceSuivi(dossier.echeance, dateReference)
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
