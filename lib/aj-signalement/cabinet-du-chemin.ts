// ── AJ Signalement : cabinet du chemin, pour les pages de l'espace d'un cabinet (PR 2, lot 4) ─────────────────────
//
// Pages internes /cabinet/<identifiant>/connexion/ et /cabinet/<identifiant>/suivi/ (servies par réécriture depuis
// vitfix.io/<identifiant>/…, next.config.ts) : composants serveur seulement. Lecture partagée par generateMetadata et la
// page dans un même rendu (cache de React), avec la clé service (lib/aj-signalement/serveur.ts).
// - identifiant invalide ou réservé → 404, sans lecture ;
// - cabinet inconnu (migration du 11/11/2026 absente comprise : aucun cabinet ne peut alors exister) → le même 404 ;
// - erreur de base → exception (page d'erreur de Next) : jamais un faux 404 qui ferait croire à un cabinet inconnu, jamais
//   le détail de l'erreur à l'écran (journalisée côté serveur, code seulement).

import { cache } from 'react'
import { notFound } from 'next/navigation'
import { validerIdentifiantCabinetQr } from '@/lib/aj-signalement/chemin-cabinet'
import { lireCabinetDuCheminQr } from '@/lib/aj-signalement/serveur'

export interface CabinetDeLaPageQr {
  identifiant: string
  nom: string
}

export const cabinetDeLaPageQr = cache(async (identifiant: string): Promise<CabinetDeLaPageQr> => {
  if (!validerIdentifiantCabinetQr(identifiant).ok) notFound()
  const lecture = await lireCabinetDuCheminQr(identifiant)
  if (!lecture.ok) throw new Error('AJ Signalement : lecture du cabinet impossible')
  if (!lecture.cabinet) notFound()
  return lecture.cabinet
})
