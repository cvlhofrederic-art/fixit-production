'use client'

import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { AgentChatPage } from '@/components/administrateur-judiciaire/modules/agents-ia/AgentChatPage'

/** Léa — Comptable (agent IA, réponses simulées du domaine « compta ») : bouton Documents, sans alerte. */
export function LeaComptableModule() {
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
        options: DEMO_NOMS_COPROPRIETES,
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
