'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ChantierPointable } from '@/lib/btp/pointage-geo'
import type { ContextePointage } from '@/lib/btp/pointage-regles'
import type { EnvoyerPointage } from './useContextePointage'
import {
  REPOSE_ANDROID_MS,
  appliNative,
  arreterSurCeTelephone,
  configurer,
  demanderAutorisation,
  ecrireConfig,
  lireAutorisationActuelle,
  lireConfig,
  ouvrirReglages,
  plateformeNative,
  retirerZonesOrphelines,
  synchroniserZones,
  zonesVoulues,
  type AutorisationArrierePlan,
  type ConfigArrierePlan,
} from './arrierePlan'
import { messageArrierePlanActive, messageArrierePlanCoupe, messageArrierePlanEchec, messageErreurPointage } from './textes'

// Pointage « téléphone en poche » (appli Vitfix Pro) : activation par l'employé (autorisation « Toujours », téléphone
// enregistré, zones des chantiers confiées au système), coupure, zones et autorisation revues à chaque lecture de
// l'écran et à chaque retour dans l'appli. Ce téléphone pointe tant que le serveur désigne son enregistrement comme
// celui du compte. Sinon (autre téléphone activé, mode coupé par le gérant, compte retiré de la société ou fiche
// changée d'adresse, autre compte ou autre fiche sur ce téléphone), il retire ses zones à la lecture suivante.

/**
 * indisponible : hors de l'appli (ou appli sans le module), mode coupé par le gérant, fiche non reliée ;
 * sans_autorisation : activé ici, mais la position « Toujours » a été retirée depuis (rien n'est pointé).
 */
export type EtatArrierePlan = 'indisponible' | 'inactif' | 'ailleurs' | 'actif' | 'sans_autorisation'

interface Options {
  contexte: ContextePointage
  chantiers: ChantierPointable[]
  envoyer: EnvoyerPointage
  recharger: () => Promise<void>
  isPt: boolean
}

/** Téléphone du compte d'après la dernière réponse du serveur à une action faite ici, valable pour ce contexte-là. */
interface Reponse {
  contexte: ContextePointage
  appareilId: string | null
}

export function etatArrierePlan(
  possible: boolean, ici: boolean, appareilDuCompte: string | null, autorisationIci: AutorisationArrierePlan | null,
): EtatArrierePlan {
  if (!possible) return 'indisponible'
  if (ici) return autorisationIci === 'partielle' || autorisationIci === 'refusee' ? 'sans_autorisation' : 'actif'
  return appareilDuCompte === null ? 'inactif' : 'ailleurs'
}

const raison = (err: unknown) => (err instanceof Error ? err.message : err)

/** Retour dans l'appli (après les réglages du téléphone, par exemple) : compteur qui fait revoir zones et autorisation. */
function useRetoursDansLAppli(actif: boolean): number {
  const [retours, setRetours] = useState(0)
  useEffect(() => {
    if (!actif) return
    const auRetour = () => { if (document.visibilityState === 'visible') setRetours(n => n + 1) }
    document.addEventListener('visibilitychange', auRetour)
    return () => document.removeEventListener('visibilitychange', auRetour)
  }, [actif])
  return retours
}

export function useArrierePlan({ contexte, chantiers, envoyer, recharger, isPt }: Options) {
  const natif = useMemo(appliNative, [])
  const [config, setConfig] = useState<ConfigArrierePlan | null>(() => (natif ? lireConfig() : null))
  const [reponse, setReponse] = useState<Reponse | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [autorisation, setAutorisation] = useState<AutorisationArrierePlan | null>(null)
  const [autorisationIci, setAutorisationIci] = useState<AutorisationArrierePlan | null>(null)
  const contexteVu = useRef(contexte)
  useEffect(() => { contexteVu.current = contexte }, [contexte])
  const retours = useRetoursDansLAppli(natif)

  const membreId = contexte.rattachement === 'relie' ? (contexte.moi?.id ?? null) : null
  const possible = natif && contexte.pointageAutoActive && membreId !== null
  const baseDisponible = contexte.arrierePlanDisponible !== false
  // Ce que dit l'écran ; juste après une activation ou une coupure faite ici, ce qu'a répondu le serveur, tant que
  // l'écran n'a pas été relu (relecture impossible, réseau coupé : on ne défait pas ce qui vient d'être fait).
  const appareilDuCompte = reponse?.contexte === contexte ? reponse.appareilId : (contexte.appareilArrierePlan ?? null)
  const ici = possible && config !== null && config.membreId === membreId && config.appareilId === appareilDuCompte
  const etat = etatArrierePlan(possible, ici, appareilDuCompte, autorisationIci)
  const zones = useMemo(() => zonesVoulues(chantiers).length, [chantiers])

  const oublier = useCallback(() => {
    ecrireConfig(null)
    setConfig(null)
  }, [])

  // Sans réglage, ce téléphone ne suit rien : des zones restées là (données du site effacées, retrait précédent en
  // échec) sont retirées. « Désactivé » à l'écran veut dire qu'aucune zone n'est surveillée. Les opérations passant
  // une à une, ce contrôle ne voit jamais les zones d'une activation lancée après lui.
  const sansReglage = config === null
  useEffect(() => {
    if (!natif || !sansReglage) return
    retirerZonesOrphelines().catch((err: unknown) => console.warn('[btp/pointage] zones restées sur le téléphone :', raison(err)))
  }, [natif, sansReglage])

  // Zones et autorisation revues à chaque lecture de l'écran et à chaque retour dans l'appli ; tout retiré ici si ce
  // téléphone ne pointe plus pour ce compte. Rien pendant une action en cours.
  useEffect(() => {
    if (!natif || config === null || occupe) return
    let annule = false
    const tenir = async () => {
      try {
        if (!ici) {
          await arreterSurCeTelephone()
          if (!annule) oublier()
          return
        }
        const accord = await lireAutorisationActuelle()
        if (!annule) setAutorisationIci(accord)
        const maintenant = Date.now()
        const reposer = plateformeNative() === 'android' && maintenant - (config.reposeLe ?? 0) > REPOSE_ANDROID_MS
        const signature = await synchroniserZones(chantiers, config.signature, reposer)
        if (!annule && (reposer || signature !== config.signature)) {
          const misAJour = reposer ? { ...config, signature, reposeLe: maintenant } : { ...config, signature }
          ecrireConfig(misAJour)
          setConfig(misAJour)
        }
      } catch (err) {
        console.warn('[btp/pointage] zones du téléphone en poche :', raison(err))
        if (!annule) {
          toast.warning(isPt
            ? 'As zonas da marcação com o telemóvel no bolso não foram atualizadas.'
            : 'Les zones du pointage téléphone en poche n’ont pas été mises à jour.')
        }
      }
    }
    void tenir()
    return () => { annule = true }
  }, [natif, config, occupe, ici, chantiers, oublier, isPt, retours])

  const activer = useCallback(async () => {
    const plateforme = plateformeNative()
    if (!possible || !baseDisponible || plateforme === null || membreId === null || occupe) return
    setOccupe(true)
    let enregistre: string | null = null
    try {
      const accord = await demanderAutorisation()
      setAutorisation(accord)
      if (accord !== 'accordee') return
      const resultat = await envoyer({ action: 'appareil', plateforme })
      if (!resultat.ok) {
        toast.error(messageErreurPointage(resultat.code, isPt))
        await recharger()
        return
      }
      const { appareil, jeton, url } = resultat.donnees ?? {}
      if (typeof appareil === 'string') enregistre = appareil
      if (typeof appareil !== 'string' || typeof jeton !== 'string' || typeof url !== 'string') {
        throw new Error('réponse du serveur incomplète')
      }
      await configurer(url, jeton)
      const maintenant = Date.now()
      const nouvelle = { membreId, appareilId: appareil, signature: await synchroniserZones(chantiers, null, true), reposeLe: maintenant }
      ecrireConfig(nouvelle)
      setConfig(nouvelle)
      setAutorisationIci(accord)
      setReponse({ contexte: contexteVu.current, appareilId: appareil })
      toast.success(messageArrierePlanActive(isPt))
      await recharger()
    } catch (err) {
      console.warn('[btp/pointage] activation du téléphone en poche :', raison(err))
      toast.error(messageArrierePlanEchec(isPt))
      // Rien ne reste à moitié en place : zones et envois en attente retirés, ce téléphone retiré du serveur.
      await arreterSurCeTelephone().catch(e => console.warn('[btp/pointage] zones non retirées :', raison(e)))
      oublier()
      if (enregistre !== null && (await envoyer({ action: 'appareil_retirer', appareil: enregistre })).ok) {
        setReponse({ contexte: contexteVu.current, appareilId: null })
      }
      await recharger()
    } finally {
      setOccupe(false)
    }
  }, [possible, baseDisponible, membreId, occupe, envoyer, isPt, recharger, chantiers, oublier])

  const couper = useCallback(async () => {
    if (occupe || config === null) return
    const appareil = config.appareilId
    setOccupe(true)
    try {
      // Zones retirées d'abord ; en cas d'échec, le jeton retiré suffit à faire ignorer les envois de ce téléphone.
      await arreterSurCeTelephone().catch(e => console.warn('[btp/pointage] zones non retirées :', raison(e)))
      oublier()
      // Ce téléphone seulement : un autre téléphone activé depuis (écran pas encore relu ici) n'est jamais retiré.
      const resultat = await envoyer({ action: 'appareil_retirer', appareil })
      if (resultat.ok) {
        setReponse({ contexte: contexteVu.current, appareilId: null })
        toast.success(messageArrierePlanCoupe(isPt))
      } else {
        toast.error(messageErreurPointage(resultat.code, isPt))
      }
      await recharger()
    } finally {
      setOccupe(false)
    }
  }, [occupe, config, oublier, envoyer, isPt, recharger])

  const reglages = useCallback(async () => {
    try {
      await ouvrirReglages()
    } catch (err) {
      console.warn('[btp/pointage] réglages du téléphone :', raison(err))
      toast.error(isPt ? 'Abra as definições do telemóvel manualmente.' : 'Ouvrez les réglages du téléphone à la main.')
    }
  }, [isPt])

  return { etat, ici, occupe, autorisation, zones, baseDisponible, activer, couper, reglages }
}
