'use client'

// Message d'un échec d'appel pour les écrans du super admin : le texte (jamais celui du serveur), et un toast (Sonner)
// quand le réseau est coupé, en plus du message gardé à l'écran.

import { toast } from 'sonner'
import type { CodeErreurQr } from '@/lib/aj-signalement/api'
import { messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import {
  messageErreurBureauQr, messageFiltreBureauQr, messageReactivationFicheQr, messageRefusAvecBureauQr, messageRefusCoproprieteQr,
} from '@/lib/aj-signalement/affichage-gestion'

/** Le message, et un toast quand le réseau est coupé. */
function avecToastReseau(code: CodeErreurQr, message: string): string {
  if (code === 'reseau') toast.error(message)
  return message
}

export function messageEchecQr(code: CodeErreurQr): string {
  return avecToastReseau(code, messageErreurTableauQr(code))
}

/**
 * Même chose pour une action sur les bureaux d'un cabinet (migration 20261119) : base absente → « fonction pas encore
 * disponible », données changées → liste relue, 400 et 500 sans parler des signalements (messageErreurBureauQr).
 */
export function messageEchecBureauQr(code: CodeErreurQr): string {
  return avecToastReseau(code, messageErreurBureauQr(code))
}

/**
 * Écriture d'une fiche qui porte un bureau (création : E2 et import ; changement de bureau : E4) : bureau envoyé et
 * données changées → « les bureaux ont changé » (messageRefusAvecBureauQr) ; sinon le message commun.
 */
export function messageEchecAvecBureauQr(code: CodeErreurQr, bureauEnvoye: boolean): string {
  return avecToastReseau(code, messageRefusAvecBureauQr(code, bureauEnvoye))
}

/** Réactivation d'une fiche (liste E3, page profil E4) : restée dans un bureau fermé → la marche à suivre. */
export function messageEchecReactivationQr(code: CodeErreurQr): string {
  return avecToastReseau(code, messageReactivationFicheQr(code))
}

/**
 * Enregistrement d'une copropriété (fenêtre du super admin, E5) : réactivation dans un bureau fermé → la marche à suivre ;
 * bureau envoyé et données changées → « les bureaux ont changé » (messageRefusCoproprieteQr) ; sinon le message commun.
 */
export function messageEchecCoproprieteQr(code: CodeErreurQr, envoi: Readonly<{ bureauEnvoye: boolean; reactivation: boolean }>): string {
  return avecToastReseau(code, messageRefusCoproprieteQr(code, envoi))
}

/** Lecture du tableau d'un bureau (filtre « Bureau » des vues Copropriétés et Signalements, E7). */
export function messageEchecFiltreBureauQr(code: CodeErreurQr): string {
  return avecToastReseau(code, messageFiltreBureauQr(code))
}
