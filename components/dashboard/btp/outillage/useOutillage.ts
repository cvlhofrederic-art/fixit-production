'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ContexteOutillage, LigneVerifieeSaisie, OutilSaisi } from '@/lib/btp/outillage-regles'
// Mêmes en-têtes et même fuseau que le pointage : le vendredi est celui du téléphone (Portugal ou France).
import { enTetes, fuseauDuTelephone } from '../pointage/useContextePointage'

// Données de l'écran Outillage et véhicules pour le compte connecté (GET /api/btp/outillage) et envois (POST).

export type CorpsOutillage =
  | { action: 'creer'; outil: OutilSaisi }
  | { action: 'modifier'; id: string; outil: OutilSaisi }
  | { action: 'retirer'; id: string }
  | { action: 'valider'; chantierId: string; lignes: LigneVerifieeSaisie[]; observations: string | null }

export type ResultatOutillage = { ok: true } | { ok: false; code: string; status: number }

export type EnvoyerOutillage = (corps: CorpsOutillage) => Promise<ResultatOutillage>

const URL_OUTILLAGE = '/api/btp/outillage'

export function useOutillage() {
  const [contexte, setContexte] = useState<ContexteOutillage | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const fuseau = useMemo(fuseauDuTelephone, [])
  const monte = useRef(true)

  const recharger = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${URL_OUTILLAGE}?fuseau=${encodeURIComponent(fuseau)}`, { headers: await enTetes(), cache: 'no-store' })
      const corps = await res.json().catch(() => null) as (ContexteOutillage & { error?: string }) | null
      if (!monte.current) return
      if (!res.ok || !corps) {
        setErreur(res.status === 403 ? (corps?.error ?? 'acces_refuse') : 'chargement')
        return
      }
      setContexte(corps)
      setErreur(null)
    } catch (err) {
      console.warn('[btp/outillage] chargement impossible :', err instanceof Error ? err.message : err)
      if (monte.current) setErreur('reseau')
    } finally {
      if (monte.current) setChargement(false)
    }
  }, [fuseau])

  const envoyer = useCallback<EnvoyerOutillage>(async (corps) => {
    try {
      const res = await fetch(URL_OUTILLAGE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await enTetes()) },
        body: JSON.stringify(corps.action === 'valider' ? { ...corps, fuseau } : corps),
      })
      const reponse = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) return { ok: false, code: reponse?.error ?? 'erreur', status: res.status }
      return { ok: true }
    } catch (err) {
      console.warn('[btp/outillage] envoi impossible :', err instanceof Error ? err.message : err)
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
