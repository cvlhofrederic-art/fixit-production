'use client'

import dynamic from 'next/dynamic'
import type { ContexteConnexionQr } from '@/lib/vitfixsignal/connexion-espace'

/**
 * Charge la page de connexion de l'espace Vitfix Signal uniquement dans le navigateur, comme l'espace lui-même :
 * sa langue vient de l'adresse affichée, et aucun formulaire n'existe avant que React ne le prenne en main (un envoi
 * avant l'hydratation partirait en GET natif, e-mail et mot de passe dans l'URL). Aucune donnée de session dans le HTML.
 */
const ConnexionEspaceQr = dynamic(() => import('./ConnexionEspaceQr'), { ssr: false })

export default function ChargeurConnexionEspaceQr({ contexte }: Readonly<{ contexte: ContexteConnexionQr }>) {
  return <ConnexionEspaceQr contexte={contexte} />
}
