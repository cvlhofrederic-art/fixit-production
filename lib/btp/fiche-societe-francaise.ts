/**
 * Société BTP traitée en société française par les correctifs du BTP pro : « Mon profil » (envoi des seuls champs
 * changés), adresse publique de la fiche (posée une seule fois), attestation d'assurance déposée (champs vides
 * seulement) et décision KYC du panneau d'administration.
 *
 * Critère : la fiche n'est pas en portugais. Une fiche sans langue posée (null, ou colonne absente de la lecture) est
 * donc celle d'une société française. Une société inscrite au Portugal (fiche en portugais) garde le comportement
 * d'avant : le Portugal est hors de ces correctifs.
 *
 * Un seul critère, lu par le navigateur (hooks/dashboard/useSettings.ts) comme par le serveur (app/api/artisan-settings,
 * app/api/wallet-scan, app/api/admin/kyc) : une même société est traitée de la même façon des deux côtés.
 * Le rôle (compte pro_societe, ou dossier KYC fr_btp) reste vérifié par l'appelant : cette fonction ne lit que la
 * langue de la fiche.
 */
export function ficheSocieteFrancaise(fiche: { readonly language?: unknown }): boolean {
  return fiche.language !== 'pt'
}
