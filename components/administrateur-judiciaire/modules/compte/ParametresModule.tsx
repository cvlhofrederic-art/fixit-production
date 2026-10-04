'use client'

import { useState } from 'react'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Toggle } from '@/components/administrateur-judiciaire/ui/Toggle'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/** Clés des réglages activables par interrupteur. */
export type CleParametre = 'notifEmail' | 'notifSms' | 'twoFA' | 'autoBackup' | 'extranet' | 'signature'

/** État des réglages (non persisté). */
export type EtatParametres = Record<CleParametre, boolean>

/** Groupe de réglages : [titre, sous-titre, icône, [[libellé, clé]…]]. */
export type GroupeParametres = [
  titre: string,
  sousTitre: string,
  icone: string,
  reglages: ReadonlyArray<[libelle: string, cle: CleParametre]>,
]

/** Valeurs initiales des réglages. */
const PARAMETRES_PAR_DEFAUT: EtatParametres = {
  notifEmail: true,
  notifSms: false,
  twoFA: true,
  autoBackup: true,
  extranet: true,
  signature: false,
}

/** Groupes de réglages affichés, un panneau par groupe (définis dans le rendu de la maquette, hissés ici). */
export const GROUPES_PARAMETRES: readonly GroupeParametres[] = [
  ['Profil du cabinet', 'Cabinet Delaunay · syndic judiciaire', 'team', [["Diffuser sur l'extranet", 'extranet']]],
  [
    'Notifications',
    'Alertes échéances & messages',
    'mail',
    [
      ['E-mail', 'notifEmail'],
      ['SMS', 'notifSms'],
    ],
  ],
  [
    'Sécurité & accès',
    'Authentification et sauvegardes',
    'shield',
    [
      ['Double authentification (2FA)', 'twoFA'],
      ['Sauvegarde automatique', 'autoBackup'],
    ],
  ],
  ['Documents', 'Signature & archivage', 'pencil', [['Signature électronique par défaut', 'signature']]],
]

/**
 * Paramètres (surtitre « Système ») : réglages du cabinet par interrupteurs, sans persistance.
 * « Configurer » ouvre un toast d'information ; « Enregistrer » affiche un toast « Simulation ».
 */
export function ParametresModule() {
  const { push } = useToast()
  const [parametres, setParametres] = useState<EtatParametres>({ ...PARAMETRES_PAR_DEFAUT })

  return (
    <>
      <PageHead
        eyebrow="Système"
        title="Paramètres"
        lede="Réglages du cabinet, notifications, sécurité et documents."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'success',
                title: 'Simulation',
                desc: 'Les paramètres ne sont pas enregistrés dans cette version.',
              })
            }
          >
            <Icon name="check" />
            Enregistrer
          </button>
        }
      />
      <div className="card-grid cols-2">
        {GROUPES_PARAMETRES.map(([titre, sousTitre, icone, reglages], index) => (
          <Panel title={titre} sub={sousTitre} icon={icone} key={index}>
            {reglages.map(([libelle, cle]) => (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 0',
                  borderBottom: '1px solid var(--line)',
                }}
                key={cle}
              >
                <span
                  style={{
                    fontSize: 13,
                  }}
                >
                  {libelle}
                </span>
                <Toggle
                  on={parametres[cle]}
                  onToggle={() =>
                    setParametres((precedents) => ({
                      ...precedents,
                      [cle]: !precedents[cle],
                    }))
                  }
                />
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 10,
              }}
            >
              <button
                className="btn ghost sm"
                onClick={() =>
                  push({
                    kind: 'info',
                    title: titre,
                    desc: 'Configuration avancée',
                  })
                }
              >
                Configurer
              </button>
            </div>
          </Panel>
        ))}
      </div>
    </>
  )
}
