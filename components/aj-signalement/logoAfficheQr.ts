// ── Logo du cabinet pour une affiche PDF (carte d'une copropriété, assistant d'import) ──────────────────────────────
//
// Demande de Hugo du 13/11/2026. Les métadonnées du logo viennent des données déjà chargées (liste des cabinets du super
// admin, profil du gestionnaire) ; l'image est lue au clic par sa route publique (chargerLogoAfficheQr). Sans logo :
// null, sans lecture (l'affiche d'avant, à l'identique). Lecture impossible (réseau, logo retiré entre-temps, image
// refusée par la revérification) : null et un avertissement (toast) : l'affiche est préparée sans logo plutôt que pas
// du tout.
// Relecture de sécurité du 13/11/2026 : si jsPDF échoue AVEC le logo (image qu'il ne sait pas décoder malgré la
// revérification, mémoire…), l'affiche est refaite SANS lui, avec le même avertissement (affichesAvecRepliQr) ; avant,
// toute affiche du cabinet échouait tant que le logo était en place.

import { toast } from 'sonner'
import { chargerLogoAfficheQr } from '@/lib/aj-signalement/api'
import type { LogoAfficheQr } from '@/lib/aj-signalement/qr'
import type { LogoCabinetQr } from '@/lib/aj-signalement/types'

export async function logoPourAfficheQr(
  identifiantCabinet: string | null | undefined, logo: LogoCabinetQr | null | undefined, avertissement: string,
): Promise<LogoAfficheQr | null> {
  if (!identifiantCabinet || !logo) return null
  const r = await chargerLogoAfficheQr(identifiantCabinet, logo)
  if (r.ok) return r.logo
  toast.warning(avertissement)
  return null
}

/**
 * Affiche (ou lot d'affiches) préparée par `preparer` avec le logo ; si elle échoue AVEC le logo, une seconde fois sans
 * lui, et l'avertissement. Sans logo : un seul essai, sans avertissement ; l'échec sans logo remonte à l'écran.
 */
export async function affichesAvecRepliQr<T>(
  logo: LogoAfficheQr | null, preparer: (logo: LogoAfficheQr | null) => Promise<T>, avertissement: string,
): Promise<T> {
  if (!logo) return preparer(null)
  try {
    return await preparer(logo)
  } catch (e) {
    console.warn('[aj-signalement] affiche non préparée avec le logo : nouvel essai sans lui', e instanceof Error ? e.name : 'inconnue')
    toast.warning(avertissement)
    return preparer(null)
  }
}
