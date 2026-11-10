'use client'

import dynamic from 'next/dynamic'

/**
 * Charge l'espace AJ Signalement uniquement dans le navigateur : sa garde lit la session Supabase du navigateur et son
 * menu l'ancre de l'URL. Aucune donnée ni état de session dans le HTML rendu par le serveur.
 */
const EspaceAjSignalement = dynamic(() => import('./EspaceAjSignalement'), { ssr: false })

export default function ChargeurEspaceQr() {
  return <EspaceAjSignalement />
}
