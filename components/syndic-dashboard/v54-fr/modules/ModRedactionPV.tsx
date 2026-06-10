'use client'

// Rédaction de procès-verbaux (IA) — port du ModAtasIA du mockup v8 (FR).
// Sélection des résolutions (cases cochables) + aperçu du projet de PV.

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Field } from '@/components/syndic-dashboard/v54/primitives/field'
import FormRow from '@/components/syndic-dashboard/v54/primitives/form-row/FormRow'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import { COPRO_NAMES } from '../data/mock'

const PV_RES = ['Approbation des comptes 2025', 'Quitus au syndic', 'Vote des travaux de toiture', 'Élection du conseil syndical', 'Fixation du budget prévisionnel'] as const

const sectionLabel = { fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--v54-navy-300)', margin: '10px 0 6px' } as const

// Mockup : <div onClick role="button"> → upgradé en <button type="button"> natif (clavier + focus).
const resBtn = { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', cursor: 'pointer', fontSize: 13, width: '100%', textAlign: 'left', border: 'none', background: 'transparent', color: 'inherit', fontFamily: 'inherit' } as const

export default function ModRedactionPV() {
  const { push } = useToast()
  const [ag, setAg] = useState(COPRO_NAMES[0])
  const [sel, setSel] = useState<number[]>([0, 2])
  const toggle = (i: number) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))
  const pv = `PROCÈS-VERBAL D'ASSEMBLÉE GÉNÉRALE\n${ag}\n\nL'an 2026, les copropriétaires se sont réunis en assemblée générale.\n\nRÉSOLUTIONS SOUMISES AU VOTE :\n${sel.map((i, k) => `${k + 1}. ${PV_RES[i]} — adoptée à la majorité (art. 24).`).join('\n')}\n\nL'ordre du jour étant épuisé, la séance est levée.`
  return (
    <>
      <PageHead eyebrow="Assistant · IA" title="Rédaction de procès-verbaux"
        lede="Génère un projet de PV d'assemblée à partir des résolutions (outil d'aide à la rédaction)." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
        <Panel title="Paramètres" icon="pencil">
          <FormRow>
            <Field label="Copropriété" name="pv-copro">
              <select aria-label="Copropriété" value={ag} onChange={(e) => setAg(e.target.value)}>{COPRO_NAMES.map((n) => <option key={n}>{n}</option>)}</select>
            </Field>
          </FormRow>
          <div style={sectionLabel}>Résolutions</div>
          {PV_RES.map((r, i) => (
            <button key={i} type="button" onClick={() => toggle(i)} aria-pressed={sel.includes(i)} style={resBtn}>
              <span style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--v54-line-strong)', background: sel.includes(i) ? 'var(--v54-gold-500)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>{sel.includes(i) ? '✓' : ''}</span>
              {r}
            </button>
          ))}
        </Panel>
        <Panel title="Projet de PV" icon="doc" right={<Button variant="ghost" size="sm" onClick={() => push({ kind: 'success', title: 'Copié', desc: 'Projet de PV copié' })}><Icon name="download" />Copier</Button>}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--v54-font-mono)', fontSize: 12, lineHeight: 1.6, color: 'var(--v54-navy-700)', background: 'var(--v54-cream)', padding: 16, borderRadius: 10, margin: 0 }}>{pv}</pre>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="gold" onClick={() => push({ kind: 'success', title: 'PV généré', desc: 'Projet ajouté à la GED' })}><Icon name="sparkle" />Générer le PV</Button>
          </div>
        </Panel>
      </div>
    </>
  )
}
