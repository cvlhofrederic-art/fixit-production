'use client'

// Portefeuille des mandats — port byte-exact du ModPortefeuille du mockup v8
// (route « portefeuille »). Tous les mandats du cabinet, multi-tribunaux :
// recherche, filtre par juridiction, regroupement. PORTFOLIO est propre à ce
// module (consommé aussi par ModCharge, qui l'importe d'ici).

import { useState } from 'react'
import clsx from 'clsx'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import { REGIMES, REG_PILL, type Regime } from '../lib/regimes'
import { daysUntil } from '../lib/format'

export interface Mandat {
  code: string
  nom: string
  tj: string
  reg: Regime['code']
  lots: number
  ech: string
  resp: string
}

export const PORTFOLIO: Mandat[] = [
  { code: 'LM', nom: 'Résidence Le Méridien', tj: 'TJ Nanterre', reg: 'sj', lots: 36, ech: '12/03/2027', resp: 'Awa Diallo' },
  { code: 'CV', nom: 'Le Clos des Vignes', tj: 'TJ Nanterre', reg: 'sj', lots: 48, ech: '22/07/2026', resp: 'Marc Léautaud' },
  { code: 'TL', nom: 'Copropriété Les Tilleuls', tj: 'TJ Nanterre', reg: 'ap291', lots: 24, ech: '05/05/2026', resp: 'Camille Noël' },
  { code: 'VM', nom: 'Villa Montaigne', tj: 'TJ Nanterre', reg: 'sj', lots: 12, ech: '28/01/2027', resp: 'Awa Diallo' },
  { code: 'RE', nom: 'Résidence des Érables', tj: 'TJ Bobigny', reg: 'ap291', lots: 64, ech: '15/09/2026', resp: 'Camille Noël' },
  { code: 'PB', nom: 'Le Parc de Bondy', tj: 'TJ Bobigny', reg: 'sj', lots: 52, ech: '30/11/2026', resp: 'Marc Léautaud' },
  { code: 'JF', nom: 'Les Jardins de Fontenay', tj: 'TJ Créteil', reg: 'ap291', lots: 88, ech: '04/04/2027', resp: 'Camille Noël' },
  { code: 'CM', nom: 'Carré Maine', tj: 'TJ Créteil', reg: 'ap47', lots: 30, ech: '18/06/2026', resp: 'Awa Diallo' },
  { code: 'BV', nom: 'Belvédère Vincennes', tj: 'TJ Créteil', reg: 'sj', lots: 40, ech: '09/10/2026', resp: 'Marc Léautaud' },
  { code: 'HS', nom: 'Le Hameau Saint-Cloud', tj: 'TJ Versailles', reg: 'sj', lots: 22, ech: '12/12/2026', resp: 'Camille Noël' },
  { code: 'OR', nom: 'Les Ormes', tj: 'TJ Versailles', reg: 'ap291', lots: 56, ech: '25/08/2026', resp: 'Camille Noël' },
  { code: 'PL', nom: 'Le Patio Levallois', tj: 'TJ Nanterre', reg: 'sj', lots: 34, ech: '03/02/2027', resp: 'Awa Diallo' },
  { code: 'GC', nom: 'Grand Clichy', tj: 'TJ Nanterre', reg: 'ap47', lots: 46, ech: '21/07/2026', resp: 'Marc Léautaud' },
  { code: 'TM', nom: 'Tour Montreuil', tj: 'TJ Bobigny', reg: 'ap291', lots: 72, ech: '14/05/2027', resp: 'Camille Noël' },
]

const rowBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '12px 20px',
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--v54-line)',
} as const

function MandatRow({ mandat, onOpen }: Readonly<{ mandat: Mandat; onOpen: (mandat: Mandat) => void }>) {
  const d = daysUntil(mandat.ech)
  return (
    <button type="button" onClick={() => onOpen(mandat)} style={rowBtnStyle}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', fontFamily: 'var(--v54-font-serif)', fontWeight: 600, flexShrink: 0 }}>{mandat.code}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{mandat.nom}</div>
        <div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{mandat.tj} · {mandat.lots} lots · {mandat.resp}</div>
      </div>
      <Pill kind={REG_PILL[mandat.reg]} noDot>{REGIMES[mandat.reg].short}</Pill>
      <span style={{ fontSize: 11.5, color: 'var(--v54-navy-500)', width: 84, textAlign: 'right' }} className={m.mono}>{mandat.ech}</span>
      <Pill kind={d == null ? 'sage' : d < 0 ? 'rust' : d <= 60 ? 'amber' : 'sage'} noDot>{d == null ? '—' : d < 0 ? 'expiré' : `J-${d}`}</Pill>
    </button>
  )
}

export default function ModPortefeuille() {
  const { push } = useToast()
  const [q, setQ] = useState('')
  const [tj, setTj] = useState('Tous')
  const [grouped, setGrouped] = useState(false)
  const tjs = ['Tous', ...Array.from(new Set(PORTFOLIO.map((x) => x.tj)))]
  const base = PORTFOLIO.filter((x) => (tj === 'Tous' || x.tj === tj) && (q === '' || (x.nom + ' ' + x.code + ' ' + x.resp).toLowerCase().includes(q.toLowerCase())))
  const filtered = [...base].sort((a, b) => (daysUntil(a.ech) ?? 9999) - (daysUntil(b.ech) ?? 9999))
  const lots = PORTFOLIO.reduce((s, x) => s + x.lots, 0)
  const soon = PORTFOLIO.filter((x) => { const d = daysUntil(x.ech); return d != null && d <= 60 }).length
  const openMandat = (x: Mandat) => push({ kind: 'info', title: x.nom, desc: `${x.tj} · ${REGIMES[x.reg].label} · ${x.lots} lots · ${x.resp}` })
  return (
    <>
      <PageHead
        eyebrow="Cabinet & supervision"
        title="Portefeuille des mandats"
        lede="Tous les mandats du cabinet, sur plusieurs tribunaux. Recherche, filtre par juridiction et regroupement pour piloter un portefeuille à l'échelle."
        actions={
          <Button variant="gold" onClick={() => push({ kind: 'success', title: 'Portefeuille exporté', desc: `${PORTFOLIO.length} mandats · ${tjs.length - 1} tribunaux` })}>
            <Icon name="download" />Exporter
          </Button>
        }
      />
      <KPIGrid
        items={[
          { icon: 'scale', num: PORTFOLIO.length, lbl: 'Mandats actifs', sub: 'tout le cabinet' },
          { icon: 'bank', num: tjs.length - 1, lbl: 'Tribunaux', sub: 'juridictions distinctes', accent: 'gold' },
          { icon: 'building', num: lots, lbl: 'Lots cumulés', accent: 'sage' },
          { icon: 'clock', num: soon, lbl: 'Échéances < 60 j', sub: 'à anticiper', accent: 'amber' },
        ]}
      />
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 9, padding: '7px 12px', flex: '1 1 240px', maxWidth: 340 }}>
          <Icon name="search" style={{ width: 15, height: 15, color: 'var(--v54-navy-300)' }} />
          <input type="text" aria-label="Rechercher un mandat" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un mandat, un code, un gestionnaire…" style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 13 }} />
        </div>
        <button type="button" className={clsx(m.chip, grouped && m.chipActive)} onClick={() => setGrouped((g) => !g)}>
          <Icon name="grid" style={{ width: 13, height: 13, verticalAlign: '-2px', marginRight: 5 }} />Grouper par tribunal
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {tjs.map((t) => (
          <button key={t} type="button" className={clsx(m.chip, tj === t && m.chipActive)} onClick={() => setTj(t)}>
            {t} <span className={m.chipCount}>{t === 'Tous' ? PORTFOLIO.length : PORTFOLIO.filter((x) => x.tj === t).length}</span>
          </button>
        ))}
      </div>
      {!grouped && (
        <Panel title="Mandats" sub={`${filtered.length} résultat${filtered.length > 1 ? 's' : ''} · triés par échéance`} icon="scale" flush>
          {filtered.map((x) => <MandatRow key={x.code} mandat={x} onOpen={openMandat} />)}
          {filtered.length === 0 && <div style={{ padding: 26, textAlign: 'center', color: 'var(--v54-navy-300)', fontSize: 13 }}>Aucun mandat ne correspond.</div>}
        </Panel>
      )}
      {grouped && tjs.filter((t) => t !== 'Tous').filter((t) => tj === 'Tous' || t === tj).map((t) => {
        const rows = filtered.filter((x) => x.tj === t)
        if (rows.length === 0) return null
        return (
          <Panel key={t} title={t} sub={`${rows.length} mandat${rows.length > 1 ? 's' : ''} · ${rows.reduce((s, x) => s + x.lots, 0)} lots`} icon="bank" flush>
            {rows.map((x) => <MandatRow key={x.code} mandat={x} onOpen={openMandat} />)}
          </Panel>
        )
      })}
    </>
  )
}
