'use client'

// ── AJ Signalement — diffusion : suite d'un envoi par l'écran et messages d'échec (PR 3, lot 8, BROUILLON) ──────────
//
// Cahier PR 3 § 5.5 et § 7.2 (point 10) : un appel D-R3 ou D-R4 envoie au plus 5 lots ; l'écran ENCHAÎNE la reprise
// (D-R4) tant que reste > 0, avec une pause entre deux appels (1 s par défaut, le débit de Resend est commun à tout
// VitFix), et s'arrête :
//   - sur un arrêt rendu par le serveur (limite ou quota du service d'e-mail, lot traité par une autre requête, issue
//     inconnue, réseau, clé absente, base) : le filet de reprise (D-C1, toutes les 5 minutes) prend le relais ;
//   - quand un appel n'a rien fait avancer (lot d'une autre requête en cours, pas encore « interrompu ») : jamais de
//     boucle ; le filet de reprise ou « Reprendre l'envoi » de l'historique termine ;
//   - sur un refus (409 diffusion_inactive, a_confirmer, 410 perime…) ou une coupure du réseau ;
//   - quand la fenêtre est fermée (navigation) : le filet de reprise termine l'envoi.
// Messages d'échec : jamais le texte du serveur ; vue d'un gestionnaire : ses propres textes (aucun profil, aucune
// migration nommés) ; réseau coupé : toast (Sonner) en plus du message gardé à l'écran.

import { toast } from 'sonner'
import { remplir } from '@/lib/coproprietaire/textes'
import { reprendreDiffusionQr, type CodeErreurQr, type EtatEnvoiDiffusionQr } from '@/lib/aj-signalement/api'
import { messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import { messageErreurGestionnaireQr } from '@/lib/aj-signalement/affichage-gestionnaire'
import {
  TEXTES_ECRAN_DIFFUSION_QR as TD, bilanEnvoiDiffusionQr, messageArretEnvoiQr, personnesQr, type ProfilDiffusionQr,
} from '@/lib/aj-signalement/affichage-ecran-diffusion'

/** Pause entre deux reprises automatiques (cahier § 5.5 : 1 s entre deux lots). */
export const DELAI_REPRISE_DIFFUSION_MS = 1000

/**
 * Message d'un échec d'appel des écrans de la diffusion (D-R1 à D-R8), selon le profil ; toast quand le réseau est
 * coupé. 503 base_absente : la migration de la diffusion (20261113) n'est pas appliquée → « Fonction pas encore
 * activée. » pour les deux profils (cahier § 9 ; relecture 3), jamais le message du tableau, qui demande d'exécuter la
 * migration de la PR 1, déjà appliquée.
 */
export function messageEchecDiffusionQr(code: CodeErreurQr, profil: ProfilDiffusionQr): string {
  const vu: CodeErreurQr = code === 'base_absente' ? 'configuration_incomplete' : code
  const message = profil === 'gestionnaire' ? messageErreurGestionnaireQr(vu) : messageErreurTableauQr(vu)
  if (code === 'reseau') toast.error(message)
  return message
}

/** Issue de la suite d'un envoi : totaux connus à la fin, et ce qui l'a arrêté. */
export type IssueEnvoiDiffusionQr =
  | { type: 'termine'; envoyes: number; refuses: number }
  | { type: 'interrompu'; envoyes: number; refuses: number; reste: number; arret: NonNullable<EtatEnvoiDiffusionQr['arret']> | 'sans_progres' }
  | { type: 'refus'; envoyes: number; refuses: number; reste: number; code: CodeErreurQr }

export interface SuiteEnvoiDiffusionQr {
  diffusionId: string
  /** Totaux rendus par l'appel qui vient de répondre (D-R3, ou une première reprise). */
  depart: EtatEnvoiDiffusionQr
  /** Message écrit il y a plus d'une heure, contenu confirmé à jour par l'auteur (D-R4 l'exige à chaque appel). */
  confirmeContenuAJour?: boolean
  delaiMs: number
  /** Faux dès que la fenêtre est fermée : la suite s'arrête (le filet de reprise termine). */
  actif: () => boolean
  onProgres: (etat: EtatEnvoiDiffusionQr) => void
}

const attendre = (ms: number) => new Promise<void>((resoudre) => { setTimeout(resoudre, ms) })

/** Enchaîne D-R4 tant que reste > 0 (voir l'en-tête) ; ne lève jamais. */
export async function poursuivreEnvoiDiffusionQr(s: SuiteEnvoiDiffusionQr): Promise<IssueEnvoiDiffusionQr> {
  let etat = s.depart
  while (etat.reste > 0 && etat.arret === null) {
    if (s.delaiMs > 0) await attendre(s.delaiMs)
    if (!s.actif()) return { type: 'interrompu', envoyes: etat.envoyes, refuses: etat.refuses, reste: etat.reste, arret: 'sans_progres' }
    const r = await reprendreDiffusionQr(s.diffusionId, s.confirmeContenuAJour ? { confirmeContenuAJour: true } : {})
    if (!r.ok) return { type: 'refus', envoyes: etat.envoyes, refuses: etat.refuses, reste: etat.reste, code: r.code }
    const progres = r.envoyes + r.refuses > etat.envoyes + etat.refuses || r.reste < etat.reste
    etat = { envoyes: r.envoyes, refuses: r.refuses, reste: r.reste, arret: r.arret }
    s.onProgres(etat)
    if (!progres && etat.reste > 0 && etat.arret === null) {
      return { type: 'interrompu', envoyes: etat.envoyes, refuses: etat.refuses, reste: etat.reste, arret: 'sans_progres' }
    }
  }
  if (etat.reste > 0) return { type: 'interrompu', envoyes: etat.envoyes, refuses: etat.refuses, reste: etat.reste, arret: etat.arret ?? 'sans_progres' }
  return { type: 'termine', envoyes: etat.envoyes, refuses: etat.refuses }
}

/**
 * Lignes affichées pour une issue (calculées UNE fois, au moment où l'issue est connue : un réseau coupé fait un seul
 * toast). Terminé : le bilan (envoyés, oppositions arrivées depuis l'aperçu, adresses refusées) ; sinon « Envoi
 * interrompu : n en attente. », la raison, et ce qui est déjà parti.
 */
export function lignesIssueEnvoiDiffusionQr(issue: IssueEnvoiDiffusionQr, profil: ProfilDiffusionQr, ecartOppositions = 0): string[] {
  if (issue.type === 'termine') return [bilanEnvoiDiffusionQr({ envoyes: issue.envoyes, refuses: issue.refuses, ecartOppositions })]
  const lignes = [remplir(TD.fin.interrompu, { n: issue.reste })]
  lignes.push(issue.type === 'refus' ? messageEchecDiffusionQr(issue.code, profil) : messageArretEnvoiQr(issue.arret, profil))
  if (issue.envoyes > 0) lignes.push(remplir(TD.fin.dejaEnvoye, { personnes: personnesQr(issue.envoyes) }))
  return lignes
}
