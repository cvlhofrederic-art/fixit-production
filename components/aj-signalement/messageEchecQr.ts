'use client'

// Message d'un échec d'appel pour les écrans du super admin : le texte (jamais celui du serveur), et un toast (Sonner)
// quand le réseau est coupé, en plus du message gardé à l'écran.

import { toast } from 'sonner'
import type { CodeErreurQr } from '@/lib/aj-signalement/api'
import { messageErreurTableauQr } from '@/lib/aj-signalement/affichage'

export function messageEchecQr(code: CodeErreurQr): string {
  const message = messageErreurTableauQr(code)
  if (code === 'reseau') toast.error(message)
  return message
}
