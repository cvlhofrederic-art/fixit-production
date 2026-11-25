// Champs lus dans `devis` et `factures` pour reconstruire la liste des documents du tableau de bord.
//
// Partagés par les DEUX lectures, qui doivent rendre exactement la même forme de ligne : celle du navigateur pour un
// titulaire (lib/document-sync.ts) et celle du serveur pour un sous-compte de société (app/api/pro/documents). Une
// forme qui diverge donnerait deux objets différents pour un même document, que la fusion du tableau de bord
// (dedupeDocsByIdentity) ne saurait plus reconnaître comme le même.
//
// `raw_data` (migration 074) porte le payload complet du formulaire : c'est lui qui rend le devis entier (corps
// d'état BTP, étapes, médiateur, notes) sur n'importe quel appareil. Une base qui ne l'a pas encore fait retomber la
// lecture sur les champs sommaires — d'où les deux listes et le test d'erreur qui les sépare.
//
// Ce fichier n'importe rien : il est lu aussi bien par du code du navigateur que par une route serveur.

/** Lecture complète : le payload du formulaire est rendu tel qu'il a été enregistré. */
export const CHAMPS_DOCUMENT_COMPLET =
  'id,numero,client_name,status,chantier_id,created_at,total_ht_cents,raw_data'

/** Lecture sommaire, quand la colonne `raw_data` n'existe pas encore dans ce schéma. */
export const CHAMPS_DOCUMENT_SOMMAIRE =
  'id,numero,client_name,status,chantier_id,created_at,total_ht_cents'

/** Vrai quand l'erreur de lecture dit que `raw_data` n'existe pas : il faut relire en sommaire. */
export function colonneRawDataAbsente(message: string | null | undefined): boolean {
  return /column .*raw_data.* does not exist/i.test(message || '')
}
