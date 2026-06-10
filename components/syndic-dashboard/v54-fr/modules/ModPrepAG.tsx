'use client'

// Préparateur d'assemblée générale — port du ModPreparadorAG du mockup v8 (L7222-7257).
// Check-list de préparation d'une AG conforme (loi 1965 / décret 1967).

import { useState, type CSSProperties } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Progress } from '@/components/syndic-dashboard/v54/primitives/progress'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'

type ItemTint = Extract<PillKind, 'gold' | 'sage' | 'rust'>
type PrepItem = readonly [string, string, ItemTint]

const ITEMS: PrepItem[] = [
  ['conv', 'Établir la convocation (21 j avant)', 'gold'],
  ['odj', "Rédiger l'ordre du jour", 'gold'],
  ['comptes', 'Joindre les comptes & budget prévisionnel', 'sage'],
  ['devis', 'Annexer les devis soumis au vote', 'sage'],
  ['pouv', 'Préparer les formulaires de pouvoir', 'sage'],
  ['feuille', 'Préparer la feuille de présence', 'sage'],
  ['lrar', 'Envoyer la convocation en LRAR', 'rust'],
]

// <div onClick> du mockup converti en <button type="button"> (a11y) — styles inline conservés.
const rowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', width: '100%',
  background: 'transparent', border: 0, borderBottom: '1px solid var(--v54-line)',
  cursor: 'pointer', font: 'inherit', textAlign: 'left',
}
const checkStyle = (checked: boolean): CSSProperties => ({
  width: 18, height: 18, borderRadius: 5, border: '1.5px solid var(--v54-line-strong)',
  background: checked ? 'var(--v54-sage-500)' : 'transparent', color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0,
})
const labelStyle = (checked: boolean): CSSProperties => ({
  flex: 1, fontSize: 13, textDecoration: checked ? 'line-through' : 'none',
  color: checked ? 'var(--v54-navy-300)' : 'var(--v54-ink)',
})

export default function ModPrepAG() {
  const { push } = useToast()
  const [done, setDone] = useState<Record<string, boolean>>({})
  const n = ITEMS.filter((i) => done[i[0]]).length
  const pct = Math.round((n / ITEMS.length) * 100)
  return (
    <>
      <PageHead eyebrow="Mandat judiciaire" title="Préparateur d'assemblée générale"
        lede="Liste de préparation d'une AG conforme (loi 1965 / décret 1967)."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Générer le dossier AG', desc: "Assembler les pièces de l'AG" })}><Icon name="doc" />Générer le dossier</Button>} />
      <Panel title={`Préparation — ${n}/${ITEMS.length} étapes`} icon="clipboard">
        {/* kind 'gold' du mockup = défaut de la primitive Progress (omis). */}
        <Progress pct={pct} kind={pct === 100 ? 'sage' : undefined} />
        <div style={{ marginTop: 14 }}>
          {ITEMS.map(([k, label, c]) => (
            <button key={k} type="button" onClick={() => setDone((d) => ({ ...d, [k]: !d[k] }))} style={rowStyle} aria-pressed={!!done[k]}>
              <span style={checkStyle(!!done[k])}>{done[k] ? '✓' : ''}</span>
              <span style={labelStyle(!!done[k])}>{label}</span>
              <Pill kind={c} noDot>{c === 'rust' ? 'critique' : c === 'gold' ? 'clé' : 'standard'}</Pill>
            </button>
          ))}
        </div>
      </Panel>
    </>
  )
}
