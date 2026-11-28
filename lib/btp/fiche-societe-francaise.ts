/**
 * Société BTP traitée en société française par la décision KYC du panneau d'administration (app/api/admin/kyc).
 *
 * Critère : la fiche n'est pas en portugais. Une fiche sans langue posée (null, ou colonne absente de la lecture) est
 * donc celle d'une société française.
 *
 * Les autres correctifs du BTP pro qui le lisaient (« Mon profil » : envoi des seuls champs changés ; adresse publique
 * de la fiche posée une seule fois ; attestation d'assurance déposée : champs vides seulement) valent depuis le
 * 22/11/2026 pour toute société BTP, quelle que soit la langue de sa fiche.
 * Le rôle (dossier KYC fr_btp) reste vérifié par l'appelant : cette fonction ne lit que la langue de la fiche.
 */
export function ficheSocieteFrancaise(fiche: { readonly language?: unknown }): boolean {
  return fiche.language !== 'pt'
}
