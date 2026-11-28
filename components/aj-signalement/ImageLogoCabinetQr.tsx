// ── Logo d'un cabinet client dans une page (AJ Signalement) ─────────────────────────────────────────────────────────
//
// Demande de Hugo du 13/11/2026 (brouillon soumis à Frédéric) : le logo du cabinet dans l'espace du cabinet (connexion,
// suivi, invitation, confirmation d'adresse) et sur la page publique ouverte par le QR code, toujours sur un fond BLANC
// (un logo sombre serait illisible sur le bleu nuit). Image de la route publique versionnée (lib/aj-signalement/logo.ts,
// PNG revérifié, jamais de SVG) ; texte alternatif : nom du cabinet ; attributs width et height calculés dans le cadre
// demandé (proportions gardées, jamais agrandie) : la place est réservée avant le chargement. Aucune adresse d'origine
// transmise (referrerPolicy no-referrer : le chemin de la page publique porte le jeton du QR code). Composant sans état,
// rendu à l'identique par le serveur et le navigateur.

import { dimensionsLogoQr, type BoiteLogoQr, type LogoPageQr } from '@/lib/aj-signalement/logo'

/** Cadre d'une carte blanche (connexion, invitation, confirmation d'adresse) et du bandeau de la page publique. */
export const BOITE_LOGO_CARTE_QR: BoiteLogoQr = { largeur: 240, hauteur: 48 }
/** Cadre de l'en-tête de l'espace de suivi (à gauche du nom de la vue). */
export const BOITE_LOGO_ENTETE_QR: BoiteLogoQr = { largeur: 160, hauteur: 40 }

export interface PropsImageLogoCabinetQr {
  logo: LogoPageQr
  boite: BoiteLogoQr
  /**
   * Affichage et placement (« block max-w-full », « hidden shrink-0 sm:block »…) : ajoutés à h-auto, qui garde les
   * proportions quand la largeur est bornée. Aucun affichage imposé ici : deux classes d'affichage se contrediraient.
   */
  className: string
}

export default function ImageLogoCabinetQr({ logo, boite, className }: Readonly<PropsImageLogoCabinetQr>) {
  const { largeur, hauteur } = dimensionsLogoQr(logo.largeur, logo.hauteur, boite)
  return (
    // eslint-disable-next-line @next/next/no-img-element -- image de la route publique du logo, versionnée : aucune optimisation à faire
    <img
      src={logo.src} alt={logo.alt} width={largeur} height={hauteur} decoding="async" referrerPolicy="no-referrer"
      className={`h-auto ${className}`}
    />
  )
}
