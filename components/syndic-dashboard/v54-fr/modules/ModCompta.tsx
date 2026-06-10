'use client'

// Comptabilité — port du ModContabCond du mockup v8 (L7693-7839, module le plus
// lourd du lot G1). Comptabilité du syndicat sur compte bancaire séparé
// (art. 18 loi 1965 / loi ALUR) : tableau de bord (journal des écritures),
// checklist de clôture d'exercice (Progress) et rapports AG (annexes 1 à 5 du
// décret n° 2005-240).

import { useState, type CSSProperties } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Tabs } from '@/components/syndic-dashboard/v54/primitives/tabs'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Alert } from '@/components/syndic-dashboard/v54/primitives/alert'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Progress } from '@/components/syndic-dashboard/v54/primitives/progress'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import DetailModal from '../shared/DetailModal'
import { COPROS, TOTAL_BUDGET, TOTAL_DEPENSE, TOTAL_IMPAYES } from '../data/mock'
import { fmtEUR } from '../lib/format'

type CptAppel = readonly [string, string, string]
type CptEcriture = readonly [string, string, string, 'recette' | 'dépense', string]
type CptExo = readonly [string, string, string, 'clôturé' | 'en cours']
type CptRapport = readonly [string, string, IconName]
type ClotureCrit = 'rust' | 'gold' | 'sage'
type ClotureStep = readonly [string, string, ClotureCrit]

const CPT_APPELS: CptAppel[] = [
  ['Appel T2 2026 — charges courantes', 'Le Méridien', '46 250 €'],
  ['Appel T2 2026 — charges courantes', 'Le Clos des Vignes', '35 500 €'],
  ['Cotisation fonds travaux', 'Le Méridien', '9 250 €'],
  ['Appel travaux toiture', 'Les Tilleuls', '18 400 €'],
  ['Appel T2 2026 — charges courantes', 'Villa Montaigne', '16 000 €'],
]
const CPT_JOURNAL: CptEcriture[] = [
  ['04/06/2026', '512 — Banque', 'Encaissement charges M. Bernard', 'recette', '+340 €'],
  ['03/06/2026', '615 — Entretien', 'Facture Plomberie Centrale', 'dépense', '-620 €'],
  ['02/06/2026', '512 — Banque', 'Cotisation fonds travaux', 'recette', '+1 200 €'],
  ['31/05/2026', '606 — Énergie', 'Facture électricité parties communes', 'dépense', '-410 €'],
  ['30/05/2026', '622 — Honoraires', 'Honoraires de gestion (mandat)', 'dépense', '-1 100 €'],
  ['28/05/2026', '512 — Banque', 'Remboursement trop-perçu Mme Olivier', 'dépense', '-142 €'],
]
const CPT_EXOS: CptExo[] = [
  ['2025', 'Résidence Le Méridien', '185 000 €', 'clôturé'],
  ['2025', 'Le Clos des Vignes', '142 000 €', 'en cours'],
  ['2025', 'Copropriété Les Tilleuls', '98 000 €', 'en cours'],
  ['2024', 'Villa Montaigne', '61 000 €', 'clôturé'],
]
const CPT_RAPPORTS: CptRapport[] = [
  ['Compte de gestion général', 'Annexe 2 — décret 2005-240', 'chart'],
  ['Situation financière', 'Annexe 1 — trésorerie & comptes', 'bank'],
  ['Budget prévisionnel', 'Annexe 3 — exercice à venir', 'coin'],
  ['État des dettes et créances', 'Annexe 4 & 5', 'fact'],
]
const CLOTURE: ClotureStep[] = [
  ['rappro', 'Rapprochement bancaire du compte séparé', 'rust'],
  ['fact', 'Saisie et ventilation des dernières factures', 'gold'],
  ['impayes', "Arrêté de l'état des impayés", 'gold'],
  ['charges', 'Répartition des charges par lot (tantièmes)', 'sage'],
  ['annexes', 'Édition des annexes comptables (1 à 5)', 'sage'],
  ['cs', 'Présentation au conseil syndical', 'sage'],
  ['ag', "Inscription à l'ordre du jour de l'AG", 'sage'],
]
const CLOTURE_LABEL: Record<ClotureCrit, string> = { rust: 'critique', gold: 'clé', sage: 'standard' }

const listItemStyle: CSSProperties = { padding: '10px 0', display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }
const listSubStyle: CSSProperties = { display: 'block', fontSize: 11, color: 'var(--v54-navy-300)' }
const checkRowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', width: '100%',
  background: 'none', border: 'none', borderBottom: '1px solid var(--v54-line)',
  cursor: 'pointer', textAlign: 'left', font: 'inherit',
}
const rapportCardStyle: CSSProperties = { padding: 18, border: '1px solid var(--v54-line)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }

export default function ModCompta() {
  const { push } = useToast()
  const [tab, setTab] = useState('board')
  const [open, setOpen] = useState<CptEcriture | null>(null)
  const [done, setDone] = useState<Record<string, boolean>>({})
  const nDone = CLOTURE.filter((i) => done[i[0]]).length
  const pct = Math.round((nDone / CLOTURE.length) * 100)
  return (
    <>
      <PageHead eyebrow="Comptabilité & finances" title="Comptabilité"
        lede="Comptabilité du syndicat sur compte bancaire séparé (loi ALUR) : écritures, clôture et annexes."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvelle écriture', desc: 'Saisir une écriture comptable' })}><Icon name="plus" />Nouvelle écriture</Button>} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'board', icon: 'chart', label: 'Tableau de bord' },
        { id: 'cloture', icon: 'check', label: "Clôture d'exercice" },
        { id: 'rapports', icon: 'doc', label: 'Rapports AG' },
      ]} />

      {tab === 'board' && <>
        <KPIGrid items={[
          { icon: 'bank', num: fmtEUR(171400), lbl: 'Solde comptes séparés', accent: 'sage' },
          { icon: 'coin', num: fmtEUR(TOTAL_BUDGET), lbl: 'Budget annuel voté' },
          { icon: 'chart', num: fmtEUR(TOTAL_DEPENSE), lbl: 'Dépenses engagées', accent: 'amber' },
          { icon: 'alert', num: fmtEUR(TOTAL_IMPAYES), lbl: 'Impayés', accent: 'rust' },
          { icon: 'shield', num: fmtEUR(COPROS.reduce((s, c) => s + c.fondsTravaux, 0)), lbl: 'Fonds travaux', accent: 'sage' },
        ]} />
        <div className={m.cardGrid}>
          <Panel title="Derniers appels de fonds" icon="coin">
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {CPT_APPELS.map((c, i) => (
                <li key={i} style={{ ...listItemStyle, borderBottom: i < CPT_APPELS.length - 1 ? '1px solid var(--v54-line)' : 'none' }}>
                  <span style={{ minWidth: 0 }}>{c[0]}<span style={listSubStyle}>{c[1]}</span></span>
                  <span className={m.mono} style={{ flexShrink: 0 }}>{c[2]}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Dernières écritures" icon="fact">
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {CPT_JOURNAL.slice(0, 5).map((e, i) => (
                <li key={i} style={{ ...listItemStyle, borderBottom: i < 4 ? '1px solid var(--v54-line)' : 'none' }}>
                  <span style={{ minWidth: 0 }}>{e[2]}<span style={listSubStyle}>{e[0]} · {e[1]}</span></span>
                  <span className={m.mono} style={{ flexShrink: 0, color: e[4].startsWith('-') ? 'var(--v54-rust-600)' : 'var(--v54-sage-600)' }}>{e[4]}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <Panel title="Journal des écritures" icon="fact" flush>
          <DataTable
            columns={[
              { h: 'Date', render: (r) => <span className={m.mono}>{r[0]}</span> },
              { h: 'Compte', render: (r) => r[1] },
              { h: 'Description', render: (r) => <b>{r[2]}</b> },
              { h: 'Type', render: (r) => <Pill kind={r[3] === 'recette' ? 'sage' : 'amber'} noDot>{r[3]}</Pill> },
              { h: 'Montant', render: (r) => <span className={m.mono} style={{ color: r[4].startsWith('-') ? 'var(--v54-rust-600)' : 'var(--v54-sage-600)' }}>{r[4]}</span> },
            ]}
            rows={CPT_JOURNAL} onRow={setOpen} />
        </Panel>
      </>}

      {tab === 'cloture' && <>
        <Alert kind="sage" icon="check" title="Clôture de l'exercice comptable">
          La clôture annuelle précède l&apos;approbation des comptes en assemblée générale. Toutes les étapes doivent être finalisées avant la convocation.
        </Alert>
        <Panel title={`Checklist de clôture — ${nDone}/${CLOTURE.length} étapes`} icon="check">
          <Progress pct={pct} kind={pct === 100 ? 'sage' : undefined} />
          <div style={{ marginTop: 14 }}>
            {CLOTURE.map(([k, label, c]) => (
              <button key={k} type="button" aria-pressed={!!done[k]} style={checkRowStyle}
                onClick={() => setDone((d) => ({ ...d, [k]: !d[k] }))}>
                <span style={{ width: 18, height: 18, borderRadius: 5, border: '1.5px solid var(--v54-line-strong)', background: done[k] ? 'var(--v54-sage-500)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{done[k] ? '✓' : ''}</span>
                <span style={{ flex: 1, fontSize: 13, textDecoration: done[k] ? 'line-through' : 'none', color: done[k] ? 'var(--v54-navy-300)' : 'var(--v54-ink)' }}>{label}</span>
                <Pill kind={c} noDot>{CLOTURE_LABEL[c]}</Pill>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Exercices comptables" icon="folder" flush>
          <DataTable
            columns={[
              { h: 'Année', render: (r) => <span className={m.mono}>{r[0]}</span> },
              { h: 'Copropriété', render: (r) => <b>{r[1]}</b> },
              { h: 'Total prévu', render: (r) => <span className={m.mono}>{r[2]}</span> },
              { h: 'État', render: (r) => <Pill kind={r[3] === 'clôturé' ? 'sage' : 'amber'} noDot>{r[3]}</Pill> },
            ]}
            rows={CPT_EXOS} />
        </Panel>
      </>}

      {tab === 'rapports' && <>
        <Alert kind="sage" icon="doc" title="Documents comptables pour l'assemblée générale">
          Les annexes comptables (décret n° 2005-240) sont jointes à la convocation pour l&apos;approbation des comptes.
        </Alert>
        <div className={m.cardGrid}>
          {CPT_RAPPORTS.map(([t, s, icon], i) => (
            <div key={i} style={rapportCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className={m.docIconThumb}><Icon name={icon} /></div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t}</div>
                  <div style={{ fontSize: 12, color: 'var(--v54-navy-400)' }}>{s}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <Button variant="ghost" size="sm" onClick={() => push({ kind: 'info', title: t, desc: 'Aperçu du document' })}>Aperçu</Button>
                <Button variant="gold" size="sm" onClick={() => push({ kind: 'success', title: 'Document généré', desc: t })}><Icon name="download" />Générer</Button>
              </div>
            </div>
          ))}
        </div>
      </>}

      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[2] : ''} icon="fact"
        fields={open ? [
          { k: 'Date', v: open[0] },
          { k: 'Compte', v: open[1] },
          { k: 'Type', v: open[3] },
          { k: 'Montant', v: open[4] },
        ] : []} />
    </>
  )
}
