'use client'

// ── AJ Signalement (vue super admin) ─────────────────────────────────────────
//
// Neuvième écran du portail, proposé au seul super admin : copropriétés dotées d'un QR code et
// signalements reçus par ce QR code (coordonnées obligatoires des déclarants), sans lien avec les tables
// du logiciel Syndic. Le shell lui passe le jeton du compte connecté (jetonSyndic), même quand l'espace
// affiché est celui de l'Administrateur judiciaire ; sans jeton, les cookies de session suffisent.

import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import TableauSignalementsQr from '@/components/aj-signalement/TableauSignalementsQr'

export default function EcranSignalementsQr({ jeton }: Readonly<PropsEcran>) {
  return <TableauSignalementsQr jeton={jeton} />
}
