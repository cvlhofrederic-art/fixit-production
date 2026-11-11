import ChargeurEspaceQr from '@/components/aj-signalement/espace/ChargeurEspaceQr'

// ── Espace « AJ Signalement » (/fr/aj-signalement/) ───────────────────────────
//
// Espace indépendant du super admin (demande de Hugo du 10/11/2026) : copropriétés dotées d'un QR code et
// signalements reçus. Accès contrôlé par le middleware (lib/aj-signalement/acces-espace.ts) puis par la garde du
// navigateur ; les données ne viennent que des routes /api/aj-signalement/* (super admin). Sans headers() ni cookies() :
// l'application est entièrement cliente (vues par ancre #signalements…).
export default function PageEspaceAjSignalement() {
  return <ChargeurEspaceQr />
}
