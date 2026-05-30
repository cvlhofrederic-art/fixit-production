'use client'

import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Progress, type ProgressKind } from '../primitives/progress'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'

/** Ocorrências e Manutenção — port byte-exact du ModOcorrencias du bundle V5.7. */

const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.max(0, (a / b) * 100)) : 0)
type Cor = 'rust' | 'amber' | 'sage' | ''
const PRIOS: [string, number, Cor][] = [['Urgente', 2, 'rust'], ['Alta', 3, 'amber'], ['Média', 1, ''], ['Baixa', 1, 'sage']]
const LST: [IconName, string, string, string, string, PillKind][] = [
  ['water', 'Infiltração no teto da garagem B2', 'Edifício Aurora — Ana Silva', 'Em reparação', 'Urgente', 'rust'],
  ['elevator', 'Elevador bloqueia no 4.° andar', 'Edifício Aurora — Manuel Costa', 'Prestador contactado', 'Alta', 'amber'],
  ['lightning', 'Curto-circuito na iluminação do hall', 'Edifício Bela Vista — Maria Lopes', 'Em análise', 'Alta', 'amber'],
  ['water', 'Fuga de água na canalização do R/C', 'Edifício Aurora — Pedro Santos', 'Aberto', 'Urgente', 'rust'],
  ['bank', 'Grafiti na fachada norte', 'Edifício Bela Vista — Carla Martins', 'Resolvido', 'Média', 'sage'],
]
const dotClass = (c: Cor) => clsx(m.dotStatus, c === 'amber' && m.dotStatusAmber, c === 'rust' && m.dotStatusRust)

export default function ModOcorrencias() {
  return (
    <>
      <PageHead title="Ocorrências e Manutenção" lede="Gestão de incidentes, manutenções e reportes do condomínio"
        actions={<Button variant="gold"><Icon name="plus" />+ Nova ocorrência</Button>} />
      <Tabs defaultActive="painel" tabs={[
        { id: 'painel', icon: 'chart', label: 'Painel' },
        { id: 'oc', icon: 'clipboard', label: 'Ocorrências' },
        { id: 'mp', icon: 'map', label: 'Mapa' },
        { id: 'qr', icon: 'qr', label: 'QR Codes' },
      ]} />
      <KPIGrid items={[
        { icon: 'clipboard', num: 8, lbl: 'Total ocorrências' },
        { icon: 'bell', num: 2, lbl: 'Abertas', accent: 'rust' },
        { icon: 'wrench', num: 3, lbl: 'Em curso', accent: 'amber' },
        { icon: 'check', num: 3, lbl: 'Resolvidas', accent: 'sage' },
        { icon: 'clock', num: '5d', lbl: 'Tempo médio resolução' },
      ]} />
      <div className={m.cardGrid} style={{ marginBottom: 16 }}>
        <Panel title="Distribuição por prioridade">
          {PRIOS.map((p, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}><span><span className={dotClass(p[2])}></span> {p[0]}</span><b>{p[1]}</b></div>
              <Progress pct={pct(p[1], 3)} kind={(p[2] || undefined) as ProgressKind | undefined} />
            </div>
          ))}
        </Panel>
        <Panel title="Conformidade SLA">
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
              <svg viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="70" cy="70" r="60" stroke="var(--v54-cream)" strokeWidth="14" fill="none" />
                <circle cx="70" cy="70" r="60" stroke="var(--v54-gold-500)" strokeWidth="14" fill="none" strokeDasharray={`${0.67 * 377} 377`} />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}><div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 32, color: 'var(--v54-gold-700)' }}>67%</div><div style={{ fontSize: 10, color: 'var(--v54-navy-300)' }}>Dentro do prazo</div></div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 10 }}>Objetivos: Urgente 1d | Alta 3d | Média 7d | Baixa 14d</div>
          </div>
        </Panel>
      </div>
      <Panel title="Últimas ocorrências" flush>
        {LST.map((o, i) => (
          <div key={i} style={{ padding: '16px 22px', borderBottom: i < LST.length - 1 ? '1px solid var(--v54-line)' : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name={o[0]} /></div>
            <div style={{ flex: 1 }}><b>{o[1]}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{o[2]}</div></div>
            <Pill kind={o[5]} noDot>{o[3]}</Pill>
            <Pill kind={o[5]} noDot>{o[4]}</Pill>
          </div>
        ))}
      </Panel>
    </>
  )
}
