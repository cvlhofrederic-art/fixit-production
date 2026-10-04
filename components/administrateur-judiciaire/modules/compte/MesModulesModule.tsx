'use client'

import { useState } from 'react'
import { CATALOGUE_MODULES } from '@/components/administrateur-judiciaire/data/catalogue-modules'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Toggle } from '@/components/administrateur-judiciaire/ui/Toggle'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/** État d'activation des modules, indexé par id de module. */
export type ActivationModules = Record<string, boolean>

/** État initial : chaque module du catalogue prend sa valeur « activé par défaut ». */
function activationParDefaut(): ActivationModules {
  const activation: ActivationModules = {}
  CATALOGUE_MODULES.forEach((entree) => {
    activation[entree[0]] = entree[4]
  })
  return activation
}

/**
 * Mes modules (surtitre « Système ») : catalogue de modules activables par interrupteur.
 * L'activation n'est pas persistée et n'a aucun effet sur la navigation (démonstration).
 * Le toast de bascule se fonde sur l'état AVANT la bascule : « <module> désactivé » si le module était actif,
 * sinon « <module> activé ».
 */
export function MesModulesModule() {
  const { push } = useToast()
  const [activation, setActivation] = useState<ActivationModules>(activationParDefaut)
  const nombreActifs = Object.values(activation).filter(Boolean).length

  return (
    <>
      <PageHead
        eyebrow="Système"
        title="Mes modules"
        lede="Activez ou désactivez les modules de la plateforme selon vos besoins."
      />
      <Kpis
        items={[
          {
            icon: 'grid',
            num: nombreActifs,
            lbl: 'Modules actifs',
            accent: 'sage',
          },
          {
            icon: 'grid',
            num: CATALOGUE_MODULES.length,
            lbl: 'Disponibles',
          },
          {
            icon: 'sparkle',
            num: 'IA',
            lbl: 'Assistants inclus',
            accent: 'gold',
          },
        ]}
      />
      <Panel title="Catalogue de modules" icon="grid">
        <div className="card-grid cols-3">
          {CATALOGUE_MODULES.map(([id, titre, description, icone]) => (
            <div
              style={{
                padding: 16,
                border: '1px solid var(--line)',
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: activation[id] ? 'var(--sage-50)' : 'transparent',
              }}
              key={id}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 600,
                    fontSize: 13.5,
                  }}
                >
                  <Icon name={icone} width="18" height="18" />
                  {titre}
                </span>
                <Toggle
                  on={activation[id]}
                  onToggle={() => {
                    setActivation((precedente) => ({
                      ...precedente,
                      [id]: !precedente[id],
                    }))
                    push({
                      kind: 'info',
                      title: activation[id] ? `${titre} désactivé` : `${titre} activé`,
                    })
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--navy-500)',
                }}
              >
                {description}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
