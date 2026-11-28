'use client'

import { AgentChatPage } from '@/components/administrateur-judiciaire/modules/agents-ia/AgentChatPage'
import { useNomsCoproprietesSelonMode } from '@/lib/administrateur-judiciaire/db/hooks'

/**
 * Léa — Comptable (agent IA, réponses simulées du domaine « compta ») : bouton Documents, sans alerte. Copropriétés du
 * sélecteur selon le mode, pour suivre la copropriété choisie en haut de page, en mode réel aussi.
 */
export function LeaComptableModule() {
  const nomsCoproprietes = useNomsCoproprietesSelonMode()
  return (
    <AgentChatPage
      mascot="lea"
      domain="compta"
      conversations={[
        {
          id: 'l1',
          title: 'Anomalies comptables — mai',
          bucket: 'hier',
        },
        {
          id: 'l2',
          title: 'Reddition de comptes Les Tilleuls',
          bucket: 'cette-semaine',
        },
        {
          id: 'l3',
          title: 'Fonds de travaux par copropriété',
          bucket: 'plus-anciennes',
        },
      ]}
      name="Léa — Comptable"
      title="Comptabilité du syndicat, compte séparé et reddition de comptes"
      intro="Bonjour, je suis Léa."
      introDetail="Je contrôle les écritures du compte bancaire séparé, prépare la reddition de comptes et détecte les anomalies."
      contextSelector={{
        label: 'Copropriété',
        options: nomsCoproprietes,
      }}
      showDocsBtn
      suggestions={[
        'Quelles anomalies as-tu détectées ce mois-ci ?',
        'Prépare la reddition de comptes des Tilleuls',
        'État du fonds de travaux par copropriété',
        'Rapproche les appels de fonds et les encaissements',
      ]}
    />
  )
}
