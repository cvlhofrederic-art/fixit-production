import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { enregistrerMode } from '@/lib/administrateur-judiciaire/mode'

/** Vidage de la base locale et bascule entre le mode démonstration et le mode données réelles. */

/** Vide toutes les tables de la base locale « vitfix-administrateur-judiciaire ». */
export async function viderBaseLocale(): Promise<void> {
  await Promise.all(ajDb.tables.map((table) => table.clear()))
}

/**
 * Passe en mode réel : base vidée, mode enregistré, puis rechargement de la page
 * (qui recalcule MODE_ACTIF et les dates du module mode.ts).
 */
export async function passerEnModeReel(): Promise<void> {
  await viderBaseLocale()
  enregistrerMode('reel')
  window.location.reload()
}

/** Revient à la démonstration : base vidée (le seed la remplira au rechargement), mode enregistré, rechargement. */
export async function restaurerDemonstration(): Promise<void> {
  await viderBaseLocale()
  enregistrerMode('demo')
  window.location.reload()
}
