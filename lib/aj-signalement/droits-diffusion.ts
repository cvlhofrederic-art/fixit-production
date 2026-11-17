// ── AJ Signalement — diffusion : droit « diffuser » d'un profil sur une copropriété (PR 3, décision H11) ─────────────
//
// Décision de Hugo du 11/11/2026 (cahier PR 3 § 4.3 et § 14, H11) : un gestionnaire ne diffuse que sur les copropriétés
// qui lui sont attribuées NOMMÉMENT ; jamais sur une copropriété « attribuée à tous », même si elle lui est AUSSI
// attribuée nommément (la copropriété de test ne diffuse que par le super admin). Le super admin diffuse partout, sur
// instruction écrite du cabinet (HF4, exigée par la route d'envoi).
// Module pur, sur la portée relue en base à chaque appel (porteeGestionnaireQr, lib/aj-signalement/acces-espace.ts :
// fiche active, copropriétés de SON cabinet seulement) et sur les colonnes de droits de la copropriété. Il ne donne aucun
// droit par lui-même : les routes de diffusion (D-R1 à D-R7) l'appliquent AVANT toute autre lecture
// (controlerDroitDiffuserQr, lib/aj-signalement/serveur-diffusion.ts), et la base refait la même règle à l'écriture
// (signalements_qr_diffusion_gestionnaire_autorise, migration 20261113 : 42501 → 403).
// Ce droit est le cinquième de la matrice des droits (« diffuser ») ; il vit ici tant que droitsSurCoproprieteQr
// (acces-espace.ts) ne le porte pas.

import type { CoproDroitsQr, PorteeQr, ProfilDroitsQr } from '@/lib/aj-signalement/types'

/**
 * Décision pour une copropriété :
 * - « autorise » : le profil peut diffuser (aperçu, envoi, reprise, historique, détail, opposition écrite) ;
 * - « hors_portee » : la copropriété n'est pas dans sa portée (collègue, autre cabinet, sans cabinet, inconnue) — la
 *   route répond 404, comme pour une copropriété qui n'existe pas (rien ne dit qu'elle existe) ;
 * - « lecture_seule » : il la voit (« attribuée à tous ») mais n'y diffuse pas — la route répond 403 lecture_seule.
 */
export type DroitDiffuserQr = 'autorise' | 'hors_portee' | 'lecture_seule'

/**
 * Droit « diffuser » (H11) : super admin, toujours ; gestionnaire, seulement sur une copropriété visible de SA portée,
 * attribuée nommément (portee.modifiables) et non « attribuée à tous » ; tout autre profil, ou copropriété inconnue
 * (null), hors portée.
 */
export function droitDiffuserQr(profil: ProfilDroitsQr, copro: CoproDroitsQr | null, portee: PorteeQr): DroitDiffuserQr {
  if (profil === 'super_admin') return 'autorise'
  if (profil !== 'gestionnaire' || !copro || !portee.visibles.has(copro.id)) return 'hors_portee'
  if (copro.attribueeATous || !portee.modifiables.has(copro.id)) return 'lecture_seule'
  return 'autorise'
}
