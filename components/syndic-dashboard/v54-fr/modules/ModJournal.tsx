'use client'

// Journal d'activité (traçabilité / audit) — port byte-exact du ModJournal du
// mockup v8 (route « journal »). Journal horodaté par copropriété, exportable
// pour la reddition de comptes et tout contentieux.

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import CoproSelect from '../shared/CoproSelect'
import { byCode } from '../data/mock'

interface JournalEntry {
  dt: string
  who: string
  act: string
}

const ENTRIES: Record<string, JournalEntry[]> = {
  LM: [
    { dt: '04/06/2026 09:12', who: 'A. Diallo', act: "Validation de l'ordre de service OS-2026-051" },
    { dt: '03/06/2026 16:40', who: 'J. Marchand', act: 'Rapprochement bancaire du compte séparé' },
    { dt: '01/06/2026 11:05', who: 'C. Noël', act: 'Dépôt de la requête en taxation des honoraires' },
    { dt: '24/05/2026 10:22', who: 'Secrétariat', act: "Notification du PV de l'AG (LRAR, 40 destinataires)" },
    { dt: '18/05/2026 18:30', who: 'Cabinet Delaunay', act: "Tenue de l'assemblée générale" },
  ],
  CV: [
    { dt: '02/06/2026 14:10', who: 'A. Diallo', act: "Création de l'OS fuite colonne EU" },
    { dt: '28/05/2026 09:00', who: 'C. Noël', act: 'Préparation de la convocation AG élective' },
  ],
  TL: [
    { dt: '02/06/2026 15:30', who: 'C. Noël', act: 'Signification de la mise en demeure — SCI Belvédère' },
    { dt: '21/05/2026 17:00', who: 'J. Marchand', act: "Mise à jour du plan d'apurement des créanciers" },
  ],
  VM: [
    { dt: '28/05/2026 10:00', who: 'Secrétariat', act: "Préparation de la notification d'ordonnance" },
  ],
}

export default function ModJournal() {
  const { push } = useToast()
  const [code, setCode] = useState('LM')
  const list = ENTRIES[code] || []
  const c = byCode(code)
  return (
    <>
      <PageHead
        eyebrow="Pilotage judiciaire"
        title="Journal d'activité"
        lede="Auxiliaire de justice, l'administrateur doit pouvoir rendre compte de chaque acte. Journal horodaté et exportable : qui a fait quoi, et quand — pour la reddition et tout contentieux."
        actions={
          <>
            <CoproSelect value={code} onChange={setCode} />
            <Button variant="gold" onClick={() => push({ kind: 'success', title: 'Journal exporté', desc: `${c.nom} — journal horodaté (PDF)` })}>
              <Icon name="download" />Exporter le journal
            </Button>
          </>
        }
      />
      <Panel title={`Journal — ${c.nom}`} sub="Horodatage automatique · ordre antéchronologique" icon="clock" flush>
        {list.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 22px', borderBottom: '1px solid var(--v54-line)', alignItems: 'center' }}>
            <span className={m.mono} style={{ fontSize: 11.5, color: 'var(--v54-navy-500)', width: 128, flexShrink: 0 }}>{e.dt}</span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--v54-sage-500)', flexShrink: 0 }}></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>{e.act}</div>
            </div>
            <Pill kind="dark" noDot>{e.who}</Pill>
          </div>
        ))}
      </Panel>
    </>
  )
}
