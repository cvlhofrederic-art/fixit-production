'use client'

// ── Profil du gestionnaire connecté dans l'espace de son cabinet (PR 2, lot 5) ─────────────────────────────────
//
// Après la garde (useAccesEspaceQr : rôle et repère de routage, qui ne donnent aucun droit), GET /api/aj-signalement/moi
// relit la FICHE côté serveur : nom, cabinet et domaines e-mail. Rien n'est gardé dans le navigateur.
//   - fiche désactivée, bloquée ou absente (403 acces_retire) : « Votre accès a été retiré par le cabinet. » ;
//   - fiche d'un autre cabinet que celui de la page (repère faux), ou profil super admin : « Cet espace n'est pas
//     accessible avec votre compte. » (le serveur refuserait de toute façon chaque appel hors de sa portée) ;
//   - migration à appliquer (503), serveur, réseau : message et « Réessayer » ; réseau coupé : toast en plus.

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { chargerMoiQr, type CodeErreurQr } from '@/lib/aj-signalement/api'
import { messageErreurGestionnaireQr } from '@/lib/aj-signalement/affichage-gestionnaire'

export interface ProfilCabinetQr {
  nom: string | null
  cabinet: { identifiant: string; nom: string; domaines: string[] }
}

export type EtatProfilCabinetQr =
  | { statut: 'chargement' }
  | { statut: 'pret'; profil: ProfilCabinetQr }
  | { statut: 'retire' }
  | { statut: 'autre_espace' }
  | { statut: 'erreur'; code: CodeErreurQr }

/** `actif` : false tant que la garde n'a pas autorisé un gestionnaire (aucun appel). */
export function useProfilCabinetQr(identifiantCabinet: string | null | undefined, actif: boolean): { etat: EtatProfilCabinetQr; reessayer: () => void } {
  const [etat, setEtat] = useState<EtatProfilCabinetQr>({ statut: 'chargement' })
  const [essai, setEssai] = useState(0)

  useEffect(() => {
    if (!actif) return undefined
    let vivant = true
    void chargerMoiQr().then((r) => {
      if (!vivant) return
      if (!r.ok) {
        if (r.code === 'reseau') toast.error(messageErreurGestionnaireQr('reseau'))
        setEtat(r.code === 'acces_retire' ? { statut: 'retire' } : { statut: 'erreur', code: r.code })
        return
      }
      if (r.moi.profil !== 'gestionnaire' || r.moi.cabinet.identifiant !== identifiantCabinet) {
        setEtat({ statut: 'autre_espace' })
        return
      }
      setEtat({ statut: 'pret', profil: { nom: r.moi.nom, cabinet: r.moi.cabinet } })
    })
    return () => { vivant = false }
  }, [actif, identifiantCabinet, essai])

  const reessayer = useCallback(() => {
    setEtat({ statut: 'chargement' })
    setEssai((n) => n + 1)
  }, [])

  return { etat, reessayer }
}
