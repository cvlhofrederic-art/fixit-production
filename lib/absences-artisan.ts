// Absences d'une fiche, lues par le tableau de bord pro (artisan et société).
//
// La lecture publique de /api/artisan-absences ne renvoie que les dates (la prise de rendez-vous n'a besoin de rien
// d'autre). Le motif et le libellé affichés dans l'agenda ne sont rendus qu'au propriétaire de la fiche, avec sa
// session : le tableau de bord lit donc ses absences avec le jeton du compte connecté.

import { jetonAcces } from '@/lib/auth/jeton-acces'
import type { Absence } from '@/lib/types'

/**
 * Lit les absences d'une fiche avec la session courante. Le jeton vient du cache partagé des tableaux de bord
 * (lecture bornée dans le temps). Sans jeton lisible, la lecture part quand même : la route répond avec les dates
 * seules, que l'appelant écarte par absencesDetaillees.
 */
export async function lireAbsencesArtisan(artisanId: string): Promise<Response> {
  const jeton = await jetonAcces()
  return fetch(
    `/api/artisan-absences?artisan_id=${encodeURIComponent(artisanId)}`,
    jeton ? { headers: { Authorization: `Bearer ${jeton}` } } : undefined,
  )
}

/**
 * Absences que l'agenda peut afficher à la place de celles qu'il montre déjà, d'après le champ `data` de la réponse :
 * la liste reçue quand chaque ligne porte le détail du propriétaire (motif présent, même vide) ou qu'elle est vide ;
 * null sinon. Une réponse « dates seules » (session illisible ou non reconnue) ne remplace donc jamais des absences
 * détaillées : l'appelant garde ce qu'il affiche, et le détail revient à la prochaine lecture reconnue.
 */
export function absencesDetaillees(donnees: unknown): Absence[] | null {
  if (!Array.isArray(donnees)) return null
  const avecDetail = donnees.every((ligne) => typeof ligne === 'object' && ligne !== null && 'reason' in ligne)
  return avecDetail ? (donnees as Absence[]) : null
}
