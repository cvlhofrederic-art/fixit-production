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
import { useComingSoon } from './use-coming-soon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Signalement } from '@/lib/syndic/v54/api'

/** Ocorrências e Manutenção — port byte-exact V5.7 + Phase 3 : signalements réels (lecture). */

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

const RESOLU = ['resolu', 'resolvido', 'resolue', 'termine', 'ferme', 'clos', 'fechado']
const isResolu = (s: string) => RESOLU.includes(s)
const isAberto = (s: string) => s === 'en_attente' || s === 'aberto' || s === 'nouveau'
const statutLabel = (s: string): string => (isResolu(s) ? 'Resolvido' : isAberto(s) ? 'Aberto' : 'Em curso')
const statutKind = (s: string): PillKind => (isResolu(s) ? 'sage' : isAberto(s) ? 'rust' : 'amber')
const PRIO_LABEL: Record<string, string> = { urgente: 'Urgente', haute: 'Alta', normale: 'Média', basse: 'Baixa' }
const prioLabel = (p: string): string => PRIO_LABEL[p] ?? 'Média'
const prioKind = (p: string): PillKind => (p === 'urgente' ? 'rust' : p === 'haute' ? 'amber' : 'sage')

export default function ModOcorrencias() {
  const soon = useComingSoon()
  // Phase 3 : vrais signalements du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const sigs: Signalement[] = real ? (data.signalements ?? []) : []

  const total = sigs.length
  const abertas = sigs.filter((s) => isAberto(s.statut)).length
  const resolvidas = sigs.filter((s) => isResolu(s.statut)).length
  const emCurso = total - abertas - resolvidas

  // Distribution par priorité (réelle) / mock byte-exact.
  const prioCount = (p: string) => sigs.filter((s) => s.priorite === p).length
  const realPrios: [string, number, Cor][] = [
    ['Urgente', prioCount('urgente'), 'rust'],
    ['Alta', prioCount('haute'), 'amber'],
    ['Média', prioCount('normale'), ''],
    ['Baixa', prioCount('basse'), 'sage'],
  ]
  const prios = real ? realPrios : PRIOS
  const prioMax = Math.max(1, ...prios.map((p) => p[1]))

  // Liste (réelle) / mock byte-exact.
  const rows: [IconName, string, string, string, string, PillKind, PillKind][] = real
    ? sigs.map((s) => ['clipboard', s.description || s.typeIntervention || 'Ocorrência', [s.immeuble, s.demandeurNom].filter(Boolean).join(' — '), statutLabel(s.statut), prioLabel(s.priorite), statutKind(s.statut), prioKind(s.priorite)])
    : LST.map((o) => [o[0], o[1], o[2], o[3], o[4], o[5], o[5]])

  return (
    <>
      <PageHead title="Ocorrências e Manutenção" lede="Gestão de incidentes, manutenções e reportes do condomínio"
        actions={<Button variant="gold" onClick={soon('Nova ocorrência', 'Criação de ocorrências em desenvolvimento')}><Icon name="plus" />+ Nova ocorrência</Button>} />
      <Tabs defaultActive="painel" tabs={[
        { id: 'painel', icon: 'chart', label: 'Painel' },
        { id: 'oc', icon: 'clipboard', label: 'Ocorrências' },
        { id: 'mp', icon: 'map', label: 'Mapa' },
        { id: 'qr', icon: 'qr', label: 'QR Codes' },
      ]} />
      <KPIGrid items={[
        { icon: 'clipboard', num: real ? total : 8, lbl: 'Total ocorrências' },
        { icon: 'bell', num: real ? abertas : 2, lbl: 'Abertas', accent: 'rust' },
        { icon: 'wrench', num: real ? emCurso : 3, lbl: 'Em curso', accent: 'amber' },
        { icon: 'check', num: real ? resolvidas : 3, lbl: 'Resolvidas', accent: 'sage' },
        { icon: 'clock', num: real ? '—' : '5d', lbl: 'Tempo médio resolução' },
      ]} />
      <div className={m.cardGrid} style={{ marginBottom: 16 }}>
        <Panel title="Distribuição por prioridade">
          {prios.map((p, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}><span><span className={dotClass(p[2])}></span> {p[0]}</span><b>{p[1]}</b></div>
              <Progress pct={pct(p[1], real ? prioMax : 3)} kind={(p[2] || undefined) as ProgressKind | undefined} />
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
        {rows.length === 0 ? (
          <div style={{ padding: '22px', fontSize: 12.5, color: 'var(--v54-navy-300)' }}>Nenhuma ocorrência registada.</div>
        ) : rows.map((o, i) => (
          <div key={i} style={{ padding: '16px 22px', borderBottom: i < rows.length - 1 ? '1px solid var(--v54-line)' : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name={o[0]} /></div>
            <div style={{ flex: 1 }}><b>{o[1]}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{o[2]}</div></div>
            <Pill kind={o[5]} noDot>{o[3]}</Pill>
            <Pill kind={o[6]} noDot>{o[4]}</Pill>
          </div>
        ))}
      </Panel>
    </>
  )
}
