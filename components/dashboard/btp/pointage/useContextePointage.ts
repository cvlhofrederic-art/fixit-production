'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { jetonAcces } from '@/lib/auth/jeton-acces'
import type { ContextePointage, PointageEcran } from '@/lib/btp/pointage-regles'

// Données de l'écran Pointage pour le compte connecté (GET /api/btp/pointage) et envoi des pointages (POST).

export type CorpsPointage =
  | { action: 'arrivee'; chantierId: string; mode: 'geo_auto' | 'manuel'; observeA?: number }
  | { action: 'depart'; chantierId?: string; mode: 'geo_auto' | 'manuel'; observeA?: number; derniereVue?: number }
  | { action: 'reglage_auto'; actif: boolean; confirmation?: boolean }
  // Téléphone en poche (appli Vitfix Pro) : enregistrer ce téléphone, ou le retirer (lui seul).
  | { action: 'appareil'; plateforme: 'android' | 'ios' }
  | { action: 'appareil_retirer'; appareil: string }

export type ResultatEnvoi =
  // donnees : la réponse entière (jeton et adresse d'envoi d'un téléphone enregistré, par exemple).
  | { ok: true; pointage: PointageEcran | null; donnees?: Record<string, unknown> }
  | { ok: false; code: string; status: number }

/** Envoi vers /api/btp/pointage, tel que les onglets le reçoivent. */
export type EnvoyerPointage = (corps: CorpsPointage) => Promise<ResultatEnvoi>

const URL_POINTAGE = '/api/btp/pointage'

/** En-tête d'authentification des appels aux routes BTP (partagé avec l'écran Outillage). */
export async function enTetes(): Promise<Record<string, string>> {
  const jeton = await jetonAcces()
  return jeton ? { Authorization: `Bearer ${jeton}` } : {}
}

/** Fuseau horaire du téléphone (l'heure du pointage est l'heure locale du chantier). */
export function fuseauDuTelephone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    // Intl incomplet (très vieux navigateur) : le serveur retient le fuseau de la France métropolitaine.
    return ''
  }
}

export function useContextePointage() {
  const [contexte, setContexte] = useState<ContextePointage | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const fuseau = useMemo(fuseauDuTelephone, [])
  const monte = useRef(true)

  const recharger = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${URL_POINTAGE}?fuseau=${encodeURIComponent(fuseau)}`, { headers: await enTetes() })
      const corps = await res.json().catch(() => null) as (ContextePointage & { error?: string }) | null
      if (!monte.current) return
      if (!res.ok || !corps) {
        setErreur(res.status === 403 ? 'acces' : 'chargement')
        return
      }
      setContexte(corps)
      setErreur(null)
    } catch (err) {
      console.warn('[btp/pointage] chargement impossible :', err instanceof Error ? err.message : err)
      if (monte.current) setErreur('reseau')
    } finally {
      if (monte.current) setChargement(false)
    }
  }, [fuseau])

  const envoyer = useCallback(async (corps: CorpsPointage): Promise<ResultatEnvoi> => {
    try {
      const res = await fetch(URL_POINTAGE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await enTetes()) },
        body: JSON.stringify({ ...corps, fuseau }),
      })
      const reponse = await res.json().catch(() => null) as ({ pointage?: PointageEcran; error?: string } & Record<string, unknown>) | null
      if (!res.ok) return { ok: false, code: reponse?.error ?? 'erreur', status: res.status }
      return { ok: true, pointage: reponse?.pointage ?? null, donnees: reponse ?? {} }
    } catch (err) {
      console.warn('[btp/pointage] envoi impossible :', err instanceof Error ? err.message : err)
      return { ok: false, code: 'reseau', status: 0 }
    }
  }, [fuseau])

  useEffect(() => {
    monte.current = true
    void recharger()
    return () => { monte.current = false }
  }, [recharger])

  return { contexte, chargement, erreur, recharger, envoyer }
}
