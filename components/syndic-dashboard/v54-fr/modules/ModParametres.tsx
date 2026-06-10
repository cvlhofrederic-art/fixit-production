'use client'

// Paramètres — port du ModDefinicoes du mockup v8 (FR).
// Réglages du cabinet : profil, notifications, sécurité (2FA), documents.

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Toggle } from '@/components/syndic-dashboard/v54/primitives/toggle'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'

type ParamKey = 'notifEmail' | 'notifSms' | 'twoFA' | 'autoBackup' | 'extranet' | 'signature'

/** [titre, sous-titre, icône, interrupteurs [libellé, clé]] */
type SectionRow = readonly [string, string, IconName, readonly (readonly [string, ParamKey])[]]

const SECTIONS: readonly SectionRow[] = [
  ['Profil du cabinet', 'Cabinet Delaunay · syndic judiciaire', 'team', [["Diffuser sur l'extranet", 'extranet']]],
  ['Notifications', 'Alertes échéances & messages', 'mail', [['E-mail', 'notifEmail'], ['SMS', 'notifSms']]],
  ['Sécurité & accès', 'Authentification et sauvegardes', 'shield', [['Double authentification (2FA)', 'twoFA'], ['Sauvegarde automatique', 'autoBackup']]],
  ['Documents', 'Signature & archivage', 'pencil', [['Signature électronique par défaut', 'signature']]],
]

const toggleRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--v54-line)' } as const

export default function ModParametres() {
  const { push } = useToast()
  const [s, setS] = useState<Record<ParamKey, boolean>>({ notifEmail: true, notifSms: false, twoFA: true, autoBackup: true, extranet: true, signature: false })
  return (
    <>
      <PageHead eyebrow="Système" title="Paramètres"
        lede="Réglages du cabinet, notifications, sécurité et documents."
        actions={<Button variant="gold" onClick={() => push({ kind: 'success', title: 'Paramètres enregistrés' })}><Icon name="check" />Enregistrer</Button>} />
      <div className={m.cardGrid}>
        {SECTIONS.map(([title, sub, icon, toggles], i) => (
          <Panel key={i} title={title} sub={sub} icon={icon}>
            {toggles.map(([label, key]) => (
              <div key={key} style={toggleRow}>
                <span style={{ fontSize: 13 }}>{label}</span>
                <Toggle on={s[key]} onToggle={() => setS((p) => ({ ...p, [key]: !p[key] }))} aria-label={label} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <Button variant="ghost" size="sm" onClick={() => push({ kind: 'info', title, desc: 'Configuration avancée' })}>Configurer</Button>
            </div>
          </Panel>
        ))}
      </div>
    </>
  )
}
