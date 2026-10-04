'use client'

import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { AgentChatPage } from '@/components/administrateur-judiciaire/modules/agents-ia/AgentChatPage'

/**
 * Max — Expert juridique (agent IA, réponses simulées du domaine « juridique »). L'apostrophe courbe de
 * « Notification de l’ordonnance » est celle de la maquette (les autres apostrophes sont droites).
 */
export function MaxJuridiqueModule() {
  return (
    <AgentChatPage
      mascot="max"
      domain="juridique"
      conversations={[
        {
          id: 'x1',
          title: 'Majorité pour désigner le syndic',
          bucket: 'hier',
        },
        {
          id: 'x2',
          title: 'Notification de l’ordonnance',
          bucket: 'cette-semaine',
        },
        {
          id: 'x3',
          title: 'Taxation des honoraires',
          bucket: 'plus-anciennes',
        },
      ]}
      name="Max — Expert juridique"
      title="Droit de la copropriété (loi 1965 · décret 1967) et procédures judiciaires"
      intro="Bonjour, je suis Max."
      introDetail="Posez-moi vos questions sur le mandat judiciaire, les majorités d'AG, les délais et obligations du syndic."
      alert={{
        kind: 'info',
        icon: 'scale',
        title:
          "Réponses fondées sur la loi du 10 juillet 1965 et le décret du 17 mars 1967 — à vérifier au regard de l'ordonnance.",
      }}
      contextSelector={{
        label: 'Copropriété',
        options: DEMO_NOMS_COPROPRIETES,
      }}
      suggestions={[
        'Quelle majorité pour désigner le syndic en AG ?',
        "Délai de notification de l'ordonnance aux copropriétaires ?",
        "Comment fixer mes honoraires d'auxiliaire de justice ?",
        'Durée maximale de ma mission ?',
      ]}
    />
  )
}
