'use client'

// ── Bureaux d'un cabinet client (migration 20261119, super admin seul) ───────────────────────────────────────────────
//
// Crochet partagé par la fenêtre « Bureaux » de la vue Cabinets (E1) et par les listes « Bureau » des autres écrans du
// super admin (fiche gestionnaire, copropriété, import) : GET /cabinets/[id]/bureaux.
//   - Tant que le cabinet n'annonce aucun bureau (clé nbBureaux absente : aucun bureau, ou migration absente), AUCUNE
//     requête : liste vide tout de suite, les écrans restent ceux d'avant. `toujours` force la lecture (fenêtre E1 : créer
//     le premier bureau, dire que la fonction n'est pas encore disponible).
//   - 503 base_absente → « indisponible » ; autre échec → « erreur » avec son code (message à l'écran qui l'affiche) ;
//     réseau coupé : en plus, un toast, une seule fois, à la réponse (messageEchecLectureBureauxQr), comme les autres
//     lectures de l'espace ; jamais pour une réponse dépassée.
//   - Autre cabinet : « chargement » jusqu'à sa réponse, jamais les bureaux du précédent ; une réponse dépassée par une
//     plus récente (changement de cabinet, recharger) est ignorée.
//   - recharger() relit et rend la lecture ; la liste affichée reste en place pendant la relecture.
// Rien n'est gardé dans le navigateur.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { messageEchecLectureBureauxQr } from '@/components/vitfixsignal/messageEchecQr'
import { chargerBureauxCabinetQr, type CodeErreurQr, type ResultatBureauxQr } from '@/lib/vitfixsignal/api'
import { bureauxOuvertsQr, nbBureauxCabinetQr } from '@/lib/vitfixsignal/affichage-gestion'
import type { BureauQr } from '@/lib/vitfixsignal/bureaux'
import type { CabinetQr } from '@/lib/vitfixsignal/types'

export type LectureBureauxQr =
  | { etat: 'chargement' }
  | { etat: 'pret'; bureaux: BureauQr[] }
  /** 503 base_absente : migration 20261119 non appliquée (fonction pas encore disponible). */
  | { etat: 'indisponible' }
  | { etat: 'erreur'; code: CodeErreurQr }

export interface BureauxCabinetQr {
  lecture: LectureBureauxQr
  /** Bureaux lus, ouverts et fermés ([] tant que la lecture n'est pas prête). */
  bureaux: BureauQr[]
  /** Bureaux ouverts : ceux où l'on peut rattacher une fiche ou une copropriété. */
  ouverts: BureauQr[]
  /** Relit les bureaux du cabinet ; tenue avec la nouvelle lecture, jamais rejetée. */
  recharger: () => Promise<LectureBureauxQr>
}

const AUCUNE_LISTE: BureauQr[] = []
const AUCUN_BUREAU: LectureBureauxQr = { etat: 'pret', bureaux: AUCUNE_LISTE }
const CHARGEMENT: LectureBureauxQr = { etat: 'chargement' }

function lectureDepuis(r: ResultatBureauxQr): LectureBureauxQr {
  if (r.ok) return { etat: 'pret', bureaux: r.bureaux }
  return r.code === 'base_absente' ? { etat: 'indisponible' } : { etat: 'erreur', code: r.code }
}

export function useBureauxCabinetQr(
  cabinet: Pick<CabinetQr, 'id' | 'nbBureaux'> | null, options: Readonly<{ toujours?: boolean }> = {},
): BureauxCabinetQr {
  // Cabinet à lire : null tant qu'il n'annonce aucun bureau (sauf `toujours`).
  const cle = cabinet && (options.toujours === true || nbBureauxCabinetQr(cabinet) > 0) ? cabinet.id : null
  const [lu, setLu] = useState<{ cle: string; lecture: LectureBureauxQr } | null>(null)
  // Numéro de la dernière lecture demandée : une réponse plus ancienne n'écrase jamais une plus récente.
  const derniere = useRef(0)

  /**
   * Lecture n° `numero` du cabinet `id`, posée seulement si aucune plus récente n'a été demandée depuis ; posée en échec
   * sur un réseau coupé : le toast.
   */
  const poser = useCallback((id: string, numero: number, r: ResultatBureauxQr): LectureBureauxQr => {
    const lecture = lectureDepuis(r)
    if (numero !== derniere.current) return lecture
    setLu({ cle: id, lecture })
    if (!r.ok) messageEchecLectureBureauxQr(r.code)
    return lecture
  }, [])

  // Première lecture, et à chaque autre cabinet : l'état n'est posé qu'à la réponse (asynchrone).
  useEffect(() => {
    if (!cle) return
    derniere.current += 1
    const numero = derniere.current
    void chargerBureauxCabinetQr(cle).then((r) => poser(cle, numero, r))
  }, [cle, poser])

  const recharger = useCallback(async (): Promise<LectureBureauxQr> => {
    if (!cle) return AUCUN_BUREAU
    derniere.current += 1
    const numero = derniere.current
    return poser(cle, numero, await chargerBureauxCabinetQr(cle))
  }, [cle, poser])

  let lecture = AUCUN_BUREAU
  if (cle) lecture = lu?.cle === cle ? lu.lecture : CHARGEMENT
  const bureaux = lecture.etat === 'pret' ? lecture.bureaux : AUCUNE_LISTE
  const ouverts = useMemo(() => bureauxOuvertsQr(bureaux), [bureaux])
  return { lecture, bureaux, ouverts, recharger }
}
