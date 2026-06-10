'use client'

// Rapport mensuel — port du ModRelatorioMensal du mockup v8 (FR).
// Route `ppt` du registre BESPOKE du mockup : générateur de compte rendu
// mensuel par copropriété (sections à inclure + aperçu).

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Field } from '@/components/syndic-dashboard/v54/primitives/field'
import FormRow from '@/components/syndic-dashboard/v54/primitives/form-row/FormRow'
import { Empty } from '@/components/syndic-dashboard/v54/primitives/empty'
import { Toggle } from '@/components/syndic-dashboard/v54/primitives/toggle'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import { COPRO_NAMES } from '../data/mock'

type SecKey = 'fin' | 'inter' | 'impayes' | 'jurid' | 'delib'

const SECS: readonly (readonly [SecKey, string])[] = [
  ['fin', 'Situation financière & trésorerie'],
  ['inter', 'Interventions du mois'],
  ['impayes', 'État des impayés'],
  ['jurid', 'Avancement du mandat judiciaire'],
  ['delib', 'Suivi des délibérations'],
]

const sectionLabel = { fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--v54-navy-300)', margin: '10px 0 6px' } as const
const toggleRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--v54-line)' } as const

export default function ModPPT() {
  const { push } = useToast()
  const [copro, setCopro] = useState(COPRO_NAMES[0])
  const [secs, setSecs] = useState<Record<SecKey, boolean>>({ fin: true, inter: true, impayes: true, jurid: true, delib: false })
  const active = SECS.filter(([k]) => secs[k])
  return (
    <>
      <PageHead eyebrow="Reporting" title="Rapport mensuel"
        lede="Compte rendu mensuel d'activité du syndic judiciaire, par copropriété."
        actions={<Button variant="gold" onClick={() => push({ kind: 'success', title: 'Rapport généré', desc: `${active.length} sections · ${copro}` })}><Icon name="download" />Générer le rapport</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
        <Panel title="Configuration" icon="wrench">
          <FormRow>
            <Field label="Copropriété" name="rapport-copro">
              <select aria-label="Copropriété" value={copro} onChange={(e) => setCopro(e.target.value)}>{COPRO_NAMES.map((n) => <option key={n}>{n}</option>)}</select>
            </Field>
          </FormRow>
          <div style={sectionLabel}>Sections à inclure</div>
          {SECS.map(([k, label]) => (
            <div key={k} style={toggleRow}>
              <span style={{ fontSize: 13 }}>{label}</span>
              <Toggle on={secs[k]} onToggle={() => setSecs((s) => ({ ...s, [k]: !s[k] }))} aria-label={label} />
            </div>
          ))}
        </Panel>
        <Panel title="Aperçu du rapport" icon="chart">
          <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, marginBottom: 4 }}>Rapport mensuel — {copro}</div>
          <div style={{ fontSize: 12, color: 'var(--v54-navy-300)', marginBottom: 14 }}>Juin 2026 · Cabinet Delaunay, syndic judiciaire</div>
          {active.length === 0 ? <Empty title="Aucune section sélectionnée" /> : active.map(([k, label], i) => (
            <div key={k} style={{ padding: '12px 0', borderBottom: i < active.length - 1 ? '1px solid var(--v54-line)' : 'none' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className={m.dotStatus}></span><b style={{ fontSize: 13.5 }}>{i + 1}. {label}</b></div>
              <div style={{ fontSize: 12, color: 'var(--v54-navy-500)', marginTop: 4, paddingLeft: 16 }}>Section incluse — données consolidées du mois.</div>
            </div>
          ))}
        </Panel>
      </div>
    </>
  )
}
