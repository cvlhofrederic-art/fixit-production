'use client'

import dynamic from 'next/dynamic'
import type { CabinetEspaceQr } from '@/components/vitfixsignal/espace/useAccesEspaceQr'

/**
 * Charge l'espace Vitfix Signal uniquement dans le navigateur : sa garde lit la session Supabase du navigateur et son
 * menu l'ancre de l'URL. Aucune donnée ni état de session dans le HTML rendu par le serveur. `cabinet` : espace d'un
 * cabinet (vitfix.io/<identifiant>/suivi/, PR 2), passé par la page serveur (identifiant et nom, sérialisables).
 */
const EspaceVitfixSignal = dynamic(() => import('./EspaceVitfixSignal'), { ssr: false })

export default function ChargeurEspaceQr({ cabinet }: Readonly<{ cabinet?: CabinetEspaceQr }> = {}) {
  return <EspaceVitfixSignal cabinet={cabinet} />
}
