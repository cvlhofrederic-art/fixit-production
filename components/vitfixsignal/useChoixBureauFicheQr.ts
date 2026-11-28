'use client'

// ── Bureau d'une nouvelle fiche gestionnaire (super admin ; écran E2 et import du plan des bureaux) ──────────────────
//
// Choix 2 de l'accord du 17/11/2026 : bureau OBLIGATOIRE pour une nouvelle fiche dès que son cabinet a un bureau ouvert
// (la route le redit : 409 bureau_requis). Partagé par « Ajouter un gestionnaire » (E2) et l'étape de l'assistant
// d'import qui crée les fiches des gestionnaires inconnus, sur les bureaux lus par useBureauxCabinetQr :
//   - cabinet sans bureau ouvert (aucune clé nbBureauxOuverts : aucun bureau, ou migration absente) : aucune liste, aucune
//     requête, rien d'exigé — l'écran reste celui d'avant ;
//   - sinon : bureaux ouverts proposés, choix exigé ; tant que la liste n'est pas lue, la création attend ;
//   - refus de la route qui touche aux bureaux (refusBureauARelireQr : bureau requis, fermé, disparu) : les bureaux du
//     cabinet sont relus, même si la liste des cabinets ne lui connaissait pas encore de bureau ouvert ; un choix qui
//     n'est plus parmi les ouverts est oublié ;
//   - `actif` faux (import sans gestionnaire inconnu) : aucune requête.

import { useState } from 'react'
import { useBureauxCabinetQr, type LectureBureauxQr } from '@/components/vitfixsignal/useBureauxCabinetQr'
import { aBureauOuvertQr, refusBureauARelireQr } from '@/lib/vitfixsignal/affichage-gestion'
import type { CodeErreurQr } from '@/lib/vitfixsignal/api'
import type { BureauQr } from '@/lib/vitfixsignal/bureaux'
import type { CabinetQr } from '@/lib/vitfixsignal/types'

export interface ChoixBureauFicheQr {
  /** La liste « Bureau » est à montrer : le cabinet a un bureau ouvert, ou un refus a demandé de relire ses bureaux. */
  avecBureaux: boolean
  lecture: LectureBureauxQr
  /** Bureaux proposés : les ouverts du cabinet. */
  ouverts: BureauQr[]
  /** Bureau choisi, s'il est encore parmi les ouverts ; '' sinon (rien n'est alors envoyé). */
  bureauId: string
  choisir: (id: string) => void
  /** Liste à montrer mais pas encore lue (chargement, échec) : la création attend. */
  enAttente: boolean
  /** Un bureau est exigé et aucun n'est choisi (ou la liste n'est pas encore lue). */
  manquant: boolean
  recharger: () => void
  /** Refus de la route : relit les bureaux si l'un des codes le demande. */
  apresRefus: (codes: readonly CodeErreurQr[]) => void
  /** Autre cabinet : choix et relecture oubliés. */
  oublier: () => void
}

export function useChoixBureauFicheQr(
  cabinet: Pick<CabinetQr, 'id' | 'nbBureaux' | 'nbBureauxOuverts'> | null, actif = true,
): ChoixBureauFicheQr {
  const [choix, setChoix] = useState('')
  const [relire, setRelire] = useState(false)
  const avecBureaux = aBureauOuvertQr(cabinet) || relire
  const { lecture, ouverts, recharger } = useBureauxCabinetQr(actif && avecBureaux ? cabinet : null, { toujours: true })
  const bureauId = ouverts.some((b) => b.id === choix) ? choix : ''
  const enAttente = actif && avecBureaux && lecture.etat !== 'pret'

  const apresRefus = (codes: readonly CodeErreurQr[]) => {
    if (!codes.some((code) => refusBureauARelireQr(code, bureauId !== ''))) return
    setRelire(true)
    void recharger()
  }

  return {
    avecBureaux, lecture, ouverts, bureauId, choisir: setChoix, enAttente,
    manquant: enAttente || (ouverts.length > 0 && bureauId === ''),
    recharger: () => { void recharger() },
    apresRefus,
    oublier: () => {
      setChoix('')
      setRelire(false)
    },
  }
}
