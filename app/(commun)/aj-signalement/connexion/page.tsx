import type { Metadata } from 'next'
import ChargeurConnexionEspaceQr from '@/components/aj-signalement/espace/ChargeurConnexionEspaceQr'
import { CONTEXTE_CONNEXION_GLOBAL_QR, TEXTES_CONNEXION_QR } from '@/lib/aj-signalement/connexion-espace'

// ── Connexion professionnelle de l'espace « AJ Signalement » (/fr/aj-signalement/connexion/) ─────
//
// Demande de Hugo du 11/11/2026 : e-mail et mot de passe, sans choix Particulier / Artisan / Pro ni Google. Servie par
// réécriture exacte depuis /fr/ et /pt/ (next.config.ts), sous le layout de l'espace (polices, lang="fr", noindex).
// Le middleware y envoie un visiteur sans session ou un compte sans accès, et envoie un compte admis dans l'espace
// (lib/aj-signalement/acces-espace.ts, redirectionEspaceQr). Robots redits ici : jamais indexée, même si le layout
// changeait. Sans headers() ni cookies() : page statique, formulaire rendu dans le navigateur.
export const metadata: Metadata = {
  title: TEXTES_CONNEXION_QR.titreOnglet,
  robots: { index: false, follow: false, noarchive: true },
}

export default function PageConnexionEspaceAjSignalement() {
  return <ChargeurConnexionEspaceQr contexte={CONTEXTE_CONNEXION_GLOBAL_QR} />
}
