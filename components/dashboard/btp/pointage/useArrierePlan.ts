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
// celui du compte. Il retire ses zones quand le serveur ne le désigne plus : autre téléphone activé, ou téléphone retiré
// (mode coupé par le gérant, fiche absente, inactive ou changée d'adresse, compte quitté : le serveur le retire, au
// plus tard à son envoi suivant). Une réponse incertaine (panne passagère) ne retire jamais rien.

/**
 * indisponible : hors de l'appli (ou appli sans le module), mode coupé par le gérant, fiche non reliée ;
 * sans_autorisation : activé ici, mais la position « Toujours » a été retirée depuis (rien n'est pointé) ;
 * zones_indisponibles : activé ici, mais le téléphone ne surveille pas toutes les zones (localisation coupée…).
 */
export type EtatArrierePlan = 'indisponible' | 'inactif' | 'ailleurs' | 'actif' | 'sans_autorisation' | 'zones_indisponibles'

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

/** Ce que sait l'appli de ce téléphone : autorisation relue et zones vraiment surveillées (null : pas encore lu). */
interface EtatIci {
  autorisation: AutorisationArrierePlan | null
  surveillees: number | null
  voulues: number
}

export function etatArrierePlan(possible: boolean, ici: boolean, appareilDuCompte: string | null, lu: EtatIci): EtatArrierePlan {
  if (!possible) return 'indisponible'
  if (!ici) return appareilDuCompte === null ? 'inactif' : 'ailleurs'
  if (lu.autorisation === 'partielle' || lu.autorisation === 'refusee') return 'sans_autorisation'
  return lu.surveillees !== null && lu.surveillees < lu.voulues ? 'zones_indisponibles' : 'actif'
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
  const [surveillees, setSurveillees] = useState<number | null>(null)
  const contexteVu = useRef(contexte)
  useEffect(() => { contexteVu.current = contexte }, [contexte])
  const retours = useRetoursDansLAppli(natif)

  const membreId = contexte.rattachement === 'relie' ? (contexte.moi?.id ?? null) : null
  const possible = natif && contexte.pointageAutoActive && membreId !== null
  const baseDisponible = contexte.arrierePlanDisponible !== false
  // Réglage ou téléphones illisibles côté serveur (panne passagère) : rien n'est sûr, ce téléphone garde son réglage.
  const incertain = contexte.arrierePlanIncertain === true
  // Ce que dit l'écran ; juste après une activation ou une coupure faite ici, ce qu'a répondu le serveur, tant que
  // l'écran n'a pas été relu (relecture impossible, réseau coupé : on ne défait pas ce qui vient d'être fait).
  const reponduIci = reponse?.contexte === contexte ? reponse.appareilId : (contexte.appareilArrierePlan ?? null)
  const appareilDuCompte = incertain ? (config?.appareilId ?? null) : reponduIci
  const ici = possible && config !== null && config.membreId === membreId && config.appareilId === appareilDuCompte
  const zones = useMemo(() => zonesVoulues(chantiers).length, [chantiers])
  const etat = etatArrierePlan(possible, ici, appareilDuCompte, { autorisation: autorisationIci, surveillees, voulues: zones })

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

  // Zones et autorisation revues à chaque lecture de l'écran et à chaque retour dans l'appli. Zones retirées ici
  // seulement quand le serveur ne désigne plus ce téléphone (jamais sur une réponse incertaine : un rattachement ou
  // un mode lus pendant une panne passagère ne sont pas sûrs) ; rien pendant une action en cours.
  useEffect(() => {
    if (!natif || config === null || occupe || incertain) return
    let annule = false
    const tenir = async () => {
      try {
        if (appareilDuCompte !== config.appareilId) {
          await arreterSurCeTelephone()
          if (!annule) oublier()
          return
        }
        if (!ici) return
        const accord = await lireAutorisationActuelle()
        if (!annule) setAutorisationIci(accord)
        const maintenant = Date.now()
        const reposer = plateformeNative() === 'android' && maintenant - (config.reposeLe ?? 0) > REPOSE_ANDROID_MS
        const enPlace = await synchroniserZones(chantiers, config.signature, reposer)
        if (annule) return
        setSurveillees(enPlace.surveillees)
        if (reposer || enPlace.signature !== config.signature) {
          const misAJour = reposer ? { ...config, signature: enPlace.signature, reposeLe: maintenant } : { ...config, signature: enPlace.signature }
          ecrireConfig(misAJour)
          setConfig(misAJour)
        }
      } catch (err) {
        console.warn('[btp/pointage] zones du téléphone en poche :', raison(err))
        if (!annule) {
          setSurveillees(0)
          toast.warning(isPt
            ? 'As zonas do registo com o telemóvel no bolso não foram atualizadas.'
            : 'Les zones du pointage téléphone en poche n’ont pas été mises à jour.')
        }
      }
    }
    void tenir()
    return () => { annule = true }
  }, [natif, config, occupe, incertain, appareilDuCompte, ici, chantiers, oublier, isPt, retours])

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
      const enPlace = await synchroniserZones(chantiers, null, true)
      const nouvelle = { membreId, appareilId: appareil, signature: enPlace.signature, reposeLe: maintenant }
      ecrireConfig(nouvelle)
      setConfig(nouvelle)
      setAutorisationIci(accord)
      setSurveillees(enPlace.surveillees)
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

  return { etat, ici, occupe, autorisation, zones, surveillees, baseDisponible, activer, couper, reglages }
}
