// ── AJ Signalement : budget d'e-mails (RG-06 ter, SPEC § 1.7.2) ───────────────────────────────────────────────
//
// Un dépôt public produit un message par destinataire. Une copropriété « attribuée à tous » (copropriété de test) et
// ses gestionnaires confirmés multiplieraient les messages d'un même QR code : au plus 60 messages par heure et par
// copropriété, 300 par heure et par cabinet (Q6, retenue par Hugo le 10/11/2026). Au-delà, le signalement est
// ENREGISTRÉ (jamais perdu) et seul l'e-mail est retenu ; le super admin est alerté une fois, et le prochain e-mail de
// la copropriété mentionne les signalements retenus.
// La décision est prise en base, et seulement là (signalements_qr_reserver_emails, sous verrou du cabinet : identique
// sur tous les isolats du Worker ; son texte est contrôlé par tests/migrations/signalements_qr_gestionnaires.test.ts).
// Ce module porte les plafonds passés à la fonction et les textes (relecture 10 : plus de copie TypeScript de la règle).

export const BUDGET_EMAILS_COPRO_HEURE = 60
export const BUDGET_EMAILS_CABINET_HEURE = 300

/**
 * Une seule alerte au super admin : au premier dépôt retenu depuis le dernier e-mail parti de la copropriété
 * (`retenus` rendu par la réservation ne compte pas le dépôt en cours).
 */
export const alerteBudgetEmailsQr = (reservation: { accorde: boolean; retenus: number }): boolean =>
  !reservation.accorde && reservation.retenus === 0

/** Mention ajoutée au prochain e-mail parti, sans le contenu des signalements retenus ; null s'il n'y en a aucun. */
export function mentionSignalementsRetenusQr(retenus: number): string | null {
  if (!Number.isInteger(retenus) || retenus <= 0) return null
  return retenus === 1
    ? '1 autre signalement reçu pendant la limite d’envoi : à consulter dans AJ Signalement.'
    : `${retenus} autres signalements reçus pendant la limite d’envoi : à consulter dans AJ Signalement.`
}

/** email_erreur du signalement retenu (affiché au tableau). */
export const ERREUR_LIMITE_ENVOI_QR = 'Limite d’envoi atteinte : e-mail non envoyé.'

/** Alerte à ADMIN_EMAIL(_2) : ni nom de copropriété, ni coordonnées, ni adresse. */
export const ALERTE_LIMITE_ENVOI_QR = {
  objet: 'AJ Signalement — limite d’envoi atteinte',
  texte: 'Limite d’envoi atteinte sur une copropriété : signalements à consulter dans AJ Signalement.',
} as const
