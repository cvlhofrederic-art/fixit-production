// Absences d'une fiche, lues par le tableau de bord pro (artisan et société).
//
// La lecture publique de /api/artisan-absences ne renvoie que les dates (la prise de rendez-vous n'a besoin de rien
// d'autre). Le motif et le libellé affichés dans l'agenda ne sont rendus qu'au propriétaire de la fiche, avec sa
// session : le tableau de bord lit donc ses absences avec le jeton du compte connecté.

import { jetonAcces } from '@/lib/auth/jeton-acces'

/**
 * Lit les absences d'une fiche avec la session courante. Le jeton vient du cache partagé des tableaux de bord
 * (lecture bornée dans le temps). Sans jeton lisible, la lecture part quand même : la route répond avec les dates seules.
 */
export async function lireAbsencesArtisan(artisanId: string): Promise<Response> {
  const jeton = await jetonAcces()
  return fetch(
    `/api/artisan-absences?artisan_id=${encodeURIComponent(artisanId)}`,
    jeton ? { headers: { Authorization: `Bearer ${jeton}` } } : undefined,
  )
}
