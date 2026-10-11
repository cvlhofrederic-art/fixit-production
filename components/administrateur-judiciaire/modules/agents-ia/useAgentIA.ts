'use client'

import { useCallback } from 'react'
import { DEMO_AUTOMATISATIONS } from '@/components/administrateur-judiciaire/data/automatisations'
import {
  DEMO_DERNIERS_APPELS_COMPTABILITE,
  DEMO_ECRITURES_COMPTABILITE,
  DEMO_EXERCICES_COMPTABLES,
} from '@/components/administrateur-judiciaire/data/comptabilite'
import { DEMO_ORDRES_DE_SERVICE } from '@/components/administrateur-judiciaire/data/ordres-de-service'
import { useDonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import { construireContexteAgent, type AgentAJ } from '@/lib/administrateur-judiciaire/ia/contexte-agent'
import { AUJOURDHUI_ISO, MODE_ACTIF } from '@/lib/administrateur-judiciaire/mode'

export interface TourConversationIA {
  role: 'user' | 'assistant'
  content: string
}

export interface OptionsAgentIA {
  historique?: TourConversationIA[]
  /** Copropriété choisie à l'écran ; ignorée si elle n'existe pas dans la base (sélecteur de démo en mode réel). */
  copropriete?: string
  /** État d'écran de démonstration hors base (ex. automatisations de Tempo, modifiées dans le Tableau). */
  donneesEcran?: Record<string, unknown>
  /** Annulation (nouvelle conversation pendant l'attente). */
  signal?: AbortSignal
}

/**
 * Appel d'un agent IA de la succursale (Claude, via /api/administrateur-judiciaire/agent) avec le contexte de la base
 * locale : copropriétés et mandats, débiteurs, échéances, tâches, contrats… tels qu'affichés à l'écran. Rejette en cas
 * d'échec (réseau, IA indisponible, annulation) : l'appelant garde son comportement de démonstration.
 */
export function useAgentIA() {
  const donnees = useDonneesLocales()
  return useCallback(
    async (agent: AgentAJ, message: string, options: OptionsAgentIA = {}) => {
      const coproprieteConnue = donnees.copros.some((copro) => copro.nom === options.copropriete)
      const reponse = await fetch('/api/administrateur-judiciaire/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: options.signal,
        body: JSON.stringify({
          agent,
          message,
          historique: (options.historique ?? []).slice(-20).map((tour) => ({ ...tour, content: tour.content.slice(0, 6000) })),
          contexte: construireContexteAgent({
            aujourdhui: AUJOURDHUI_ISO,
            mode: MODE_ACTIF,
            coproprieteSelectionnee: coproprieteConnue ? (options.copropriete ?? '') : '',
            copros: donnees.copros,
            lots: donnees.lots,
            coproprietaires: donnees.coproprietaires,
            prestataires: donnees.prestataires,
            echeances: donnees.echeances,
            taches: donnees.taches,
            notifications: donnees.notifications,
            contrats: donnees.contrats,
            impayes: donnees.impayes,
            // Écrans de démonstration non branchés sur la base (envoyés en mode démo seulement).
            ecransDemo: {
              ordresDeService: DEMO_ORDRES_DE_SERVICE,
              automatisations: DEMO_AUTOMATISATIONS,
              comptabilite: {
                derniersAppelsDeFonds: DEMO_DERNIERS_APPELS_COMPTABILITE,
                ecritures: DEMO_ECRITURES_COMPTABILITE,
                exercices: DEMO_EXERCICES_COMPTABLES,
              },
              ...options.donneesEcran,
            },
          }),
        }),
      })
      const corps = (await reponse.json().catch(() => null)) as { text?: unknown } | null
      if (!reponse.ok || typeof corps?.text !== 'string' || !corps.text.trim()) {
        throw new Error(`Agent IA indisponible (HTTP ${reponse.status})`)
      }
      return corps.text
    },
    [donnees],
  )
}
