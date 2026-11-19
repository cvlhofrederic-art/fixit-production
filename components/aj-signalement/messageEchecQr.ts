'use client'

// Message d'un échec d'appel pour les écrans du super admin : le texte (jamais celui du serveur), et un toast (Sonner)
// quand le réseau est coupé, en plus du message gardé à l'écran.

import { toast } from 'sonner'
import type { CodeErreurQr } from '@/lib/aj-signalement/api'
import { messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import { messageErreurBureauQr } from '@/lib/aj-signalement/affichage-gestion'

export function messageEchecQr(code: CodeErreurQr): string {
  const message = messageErreurTableauQr(code)
  if (code === 'reseau') toast.error(message)
  return message
}

/**
 * Même chose pour une action sur les bureaux d'un cabinet (migration 20261119) : base absente → « fonction pas encore
 * disponible », données changées → liste relue, 400 et 500 sans parler des signalements (messageErreurBureauQr).
 */
export function messageEchecBureauQr(code: CodeErreurQr): string {
  const message = messageErreurBureauQr(code)
  if (code === 'reseau') toast.error(message)
  return message
}
