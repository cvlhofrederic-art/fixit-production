'use client'

// Honoraires & taxation (lot A) — port du ModHonoraires du mockup v8 : cycle
// de taxation (CPC 704-718), KPI, relevé des diligences par copropriété et
// actions de dépôt/recouvrement. Les diligences sont un seed propre au module
// (le mockup n'utilise ni HONORAIRES de data/mock ni DocModal sur cet écran).

import { useState } from 'react'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import CoproSelect from '../shared/CoproSelect'
import { byCode } from '../data/mock'
import { fmtEUR } from '../lib/format'

const TAX_STEPS = ['Diligences', 'État de frais', 'Requête en taxation', 'Ordonnance de taxation', 'Recouvrement'] as const

const STEP_BY_CODE: Record<string, number> = { LM: 1, CV: 0, TL: 2, VM: 0 }

interface Diligence {
  date: string
  nature: string
  h: number
  taux: number
}

const DILIGENCES: Diligence[] = [
  { date: '12/03/2026', nature: 'Constitution et étude du dossier de désignation', h: 6, taux: 180 },
  { date: '18/03/2026', nature: 'Reprise comptable et ouverture du compte séparé', h: 9, taux: 150 },
  { date: '02/04/2026', nature: 'Gestion courante et coordination des prestataires', h: 14, taux: 150 },
  { date: '21/04/2026', nature: 'Préparation et tenue du conseil syndical', h: 4, taux: 180 },
  { date: '15/05/2026', nature: 'Recouvrement amiable et mises en demeure', h: 7, taux: 180 },
]

export default function ModHonoraires() {
  const { push } = useToast()
  const [code, setCode] = useState('LM')
  const c = byCode(code)
  const step = STEP_BY_CODE[code] || 0
  const totalHT = DILIGENCES.reduce((s, d) => s + d.h * d.taux, 0)
  const tva = Math.round(totalHT * 0.2)
  const ttc = totalHT + tva
  return (
    <>
      <PageHead
        eyebrow="Mandat judiciaire"
        title="Honoraires & taxation"
        lede="En auxiliaire de justice, la rémunération ne suit pas le contrat-type syndic mais les articles 704 à 718 du CPC : état de frais soumis à la taxation du président du tribunal."
        actions={
          <>
            <CoproSelect value={code} onChange={setCode} />
            <Button variant="gold" onClick={() => push({ kind: 'success', title: 'État de frais établi', desc: `${c.nom} — bordereau prêt pour dépôt` })}><Icon name="coin" />Établir l&apos;état de frais</Button>
          </>
        }
      />
      <Panel title="Cycle de taxation" sub={`${c.nom} · ${c.tribunal}`} icon="scale">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
          {TAX_STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 auto', minWidth: 130 }}>
              <span
                style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
                  background: i < step ? 'var(--v54-sage-500)' : i === step ? 'var(--v54-gold-500)' : 'var(--v54-cream)',
                  color: i <= step ? '#fff' : 'var(--v54-navy-300)',
                }}
              >
                {i < step ? '✓' : i + 1}
              </span>
              <span style={{ fontSize: 12, fontWeight: i === step ? 700 : 500, color: i <= step ? 'var(--v54-navy-700)' : 'var(--v54-navy-300)' }}>{s}</span>
            </div>
          ))}
        </div>
      </Panel>
      <KPIGrid
        items={[
          { icon: 'coin', num: fmtEUR(totalHT), lbl: 'Honoraires (HT)', sub: `${DILIGENCES.reduce((s, d) => s + d.h, 0)} h de diligences` },
          { icon: 'fact', num: fmtEUR(ttc), lbl: 'Total à taxer (TTC)', sub: 'TVA 20% incluse', accent: 'gold' },
          { icon: 'scale', num: TAX_STEPS[step], lbl: 'Étape en cours', sub: 'CPC 704-718', accent: 'amber' },
          { icon: 'clock', num: '1 mois', lbl: 'Recours en taxe', sub: 'à compter de la notification', accent: 'gold' },
        ]}
      />
      <Panel
        title="Relevé des diligences"
        sub="Base de l'état de frais soumis au juge taxateur"
        icon="clipboard"
        right={<Button onClick={() => push({ kind: 'info', title: 'Nouvelle diligence', desc: 'Saisie du temps passé' })}><Icon name="plus" />Ajouter une diligence</Button>}
        flush
      >
        <DataTable<Diligence>
          rowKey="nature"
          columns={[
            { h: 'Date', render: (r) => <span className={m.mono} style={{ fontSize: 12 }}>{r.date}</span> },
            { h: 'Nature de la diligence', render: (r) => <b style={{ fontWeight: 600 }}>{r.nature}</b> },
            { h: 'Temps', style: { textAlign: 'right' }, tdStyle: { textAlign: 'right' }, render: (r) => `${r.h} h` },
            { h: 'Taux', style: { textAlign: 'right' }, tdStyle: { textAlign: 'right' }, render: (r) => `${r.taux} €/h` },
            { h: 'Montant HT', style: { textAlign: 'right' }, tdStyle: { textAlign: 'right' }, render: (r) => <b style={{ fontWeight: 600 }}>{fmtEUR(r.h * r.taux)}</b> },
          ]}
          rows={DILIGENCES}
        />
      </Panel>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Button onClick={() => push({ kind: 'success', title: 'Requête en taxation déposée', desc: `${c.tribunal} · ${fmtEUR(ttc)}` })}><Icon name="scale" />Déposer la requête en taxation</Button>
        <Button onClick={() => push({ kind: 'info', title: 'Recouvrement engagé', desc: "Sur le fondement de l'ordonnance de taxation" })}><Icon name="coin" />Recouvrer après taxation</Button>
      </div>
    </>
  )
}
