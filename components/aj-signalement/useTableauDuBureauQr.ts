'use client'

// ── Tableau d'un bureau : filtre « Bureau » des vues Copropriétés et Signalements du super admin (écran E7) ────────────
//
// Bureaux des cabinets (migration 20261119), BROUILLON soumis avant fusion. GET /tableau?bureau=<id> : les copropriétés du
// bureau et leurs signalements. Le serveur rend les signalements les plus récents de CES copropriétés : un filtre posé à
// l'écran sur le tableau complet en perdrait de plus anciens.
//   - Aucun bureau choisi : aucune requête, lecture null (les vues montrent le tableau complet, comme avant).
//   - Un bureau choisi : « chargement » jusqu'à sa réponse (jamais le tableau d'un autre bureau), puis le tableau, ou
//     l'échec avec son message (base absente → fonction pas encore disponible ; réseau coupé → toast en plus).
//   - `version` change (tableau complet relu ou modifié ici : copropriété enregistrée ou supprimée, statut changé) : le
//     tableau du bureau est relu, celui affiché restant en place pendant la relecture.
//   - Une réponse dépassée par une plus récente (autre bureau, relecture, « Tous les bureaux ») est ignorée.
// Rien n'est gardé dans le navigateur.

import { useCallback, useEffect, useRef, useState } from 'react'
import { chargerTableauQr, type ResultatTableauQr } from '@/lib/aj-signalement/api'
import { messageEchecFiltreBureauQr } from '@/components/aj-signalement/messageEchecQr'
import type { TableauQr } from '@/lib/aj-signalement/types'

export type LectureTableauBureauQr =
  | { etat: 'chargement' }
  | { etat: 'pret'; tableau: TableauQr }
  /** Message déjà choisi (messageEchecFiltreBureauQr). */
  | { etat: 'erreur'; message: string }

export interface TableauDuBureauQr {
  /** null : aucun bureau choisi (le tableau complet). */
  lecture: LectureTableauBureauQr | null
  /** Relit le tableau du bureau choisi (après un échec). */
  reessayer: () => void
}

const CHARGEMENT: LectureTableauBureauQr = { etat: 'chargement' }

/** Lecture en cours ou en échec : la liste du bureau n'est pas encore là (les vues montrent l'attente ou l'erreur). */
export const lectureBureauEnAttenteQr = (
  lecture: LectureTableauBureauQr | null,
): lecture is Exclude<LectureTableauBureauQr, { etat: 'pret' }> => lecture?.etat === 'chargement' || lecture?.etat === 'erreur'

export function useTableauDuBureauQr(jeton: string | null, bureau: string, version: unknown): TableauDuBureauQr {
  const [lu, setLu] = useState<{ bureau: string; lecture: LectureTableauBureauQr } | null>(null)
  const [essai, setEssai] = useState(0)
  // Numéro de la dernière lecture demandée : une réponse plus ancienne n'écrase jamais une plus récente.
  const derniere = useRef(0)

  /** Réponse de la lecture n° `numero` du bureau `b`, posée seulement si aucune plus récente n'a été demandée depuis. */
  const poser = useCallback((b: string, numero: number, r: ResultatTableauQr) => {
    if (numero !== derniere.current) return
    setLu({ bureau: b, lecture: r.ok ? { etat: 'pret', tableau: r.tableau } : { etat: 'erreur', message: messageEchecFiltreBureauQr(r.code) } })
  }, [])

  // Bureau choisi, tableau complet changé, « Réessayer » : l'état n'est posé qu'à la réponse (asynchrone).
  useEffect(() => {
    derniere.current += 1
    if (!bureau) return
    const numero = derniere.current
    void chargerTableauQr(jeton, fetch, { bureau }).then((r) => poser(bureau, numero, r))
  }, [jeton, bureau, version, essai, poser])

  const reessayer = useCallback(() => {
    setLu({ bureau, lecture: CHARGEMENT })
    setEssai((n) => n + 1)
  }, [bureau])

  let lecture: LectureTableauBureauQr | null = null
  if (bureau) lecture = lu?.bureau === bureau ? lu.lecture : CHARGEMENT
  return { lecture, reessayer }
}
