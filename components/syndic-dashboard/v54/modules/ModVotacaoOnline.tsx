'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Pill } from '../primitives/pill'
import { Progress } from '../primitives/progress'
import m from './modules.module.css'

/** Votação Online AG — port byte-exact du ModVotacaoOnline du bundle V5.7. */

interface Deliberation {
  title: string
  desc: string
  estado: string
  maioria: string
  artigo: string
  encerrado: string
  prazo: string
  progresso: string
  perm: number
  permTotal: number
  options: readonly (readonly [string, number, number])[]
  edificio: string
}

const DELIBS: readonly Deliberation[] = [
  {
    title: 'Aprovação do orçamento anual 2026',
    desc: 'Deliberação sobre o orçamento previsto para o exercício de 2026, incluindo quotas ordinárias e fundo de reserva. Valor total proposto: 45.600 EUR',
    estado: 'Aberta', maioria: 'Maioria Simples', artigo: 'Art.° 1432.° CC', encerrado: 'Encerrado',
    prazo: 'Prazo: 23 de maio de 2026', progresso: '4 / 8 frações (50%)', perm: 500, permTotal: 1000,
    options: [['', 3, 360], ['', 1, 140], ['', 0, 0]], edificio: 'Edifício Sol Nascente',
  },
  {
    title: 'Obras de reparação do telhado',
    desc: 'Votação para aprovação das obras de reparação urgente do telhado do bloco B. Três orçamentos obtidos. Valor médio: 18.200 EUR. Necessária maioria qual…',
    estado: 'Aberta', maioria: 'Maioria Qualificada', artigo: 'Art.° 1433.° CC', encerrado: 'Encerrado',
    prazo: 'Prazo: 19 de maio de 2026', progresso: '2 / 8 frações (25%)', perm: 250, permTotal: 1000,
    options: [['', 2, 250], ['', 0, 0], ['', 0, 0]], edificio: 'Edifício Sol Nascente',
  },
]

const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.max(0, (a / b) * 100)) : 0)

export default function ModVotacaoOnline() {
  return (
    <>
      <PageHead title="Votação Online AG" lede="Gestão de deliberações e votações eletrónicas para assembleias de condóminos" />
      <KPIGrid items={[
        { icon: 'poll', num: 3, lbl: 'Ativas', accent: 'gold' },
        { icon: 'check', num: 1, lbl: 'Aprovadas', accent: 'sage' },
        { icon: 'ban', num: 1, lbl: 'Rejeitadas', accent: 'rust' },
        { icon: 'chart', num: '53%', lbl: 'Participação média' },
      ]} />
      <Tabs defaultActive="ativ" tabs={[
        { id: 'ativ', icon: 'chart', label: 'Votações Ativas', badge: 3 },
        { id: 'hist', icon: 'folder', label: 'Histórico', badge: 2 },
        { id: 'cfg', icon: 'cog', label: 'Configuração' },
      ]} />
      <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, marginBottom: 14 }}>Deliberações em curso</div>
      {DELIBS.map((v, i) => (
        <div key={v.title} className={m.card} style={{ padding: 22, marginBottom: 14, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 18, right: 22 }}>
            <Pill kind="rust" noDot>{v.encerrado}</Pill>
            <div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 4, textAlign: 'right' }}>{v.prazo}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Pill kind="sage" noDot>● {v.estado}</Pill>
            <Pill kind="amber" noDot>{v.maioria}</Pill>
            <span style={{ fontSize: 11, color: 'var(--v54-navy-300)', alignSelf: 'center' }}>{v.artigo}</span>
          </div>
          <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500, marginBottom: 6 }}>{v.title}</div>
          <div style={{ fontSize: 13, color: 'var(--v54-navy-500)', marginBottom: 12 }}>{v.desc}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 6 }}>
            <span>Progresso: {v.progresso}</span><span>{v.perm} / {v.permTotal} permilagem</span>
          </div>
          <Progress pct={pct(v.perm, v.permTotal)} kind={i === 1 ? 'rust' : undefined} />
          <div style={{ marginTop: 12, display: 'flex', gap: 18, fontSize: 12.5 }}>
            {v.options.map((opt, j) => (
              <div key={j}><b>{opt[0]} {opt[1]}</b> <span style={{ color: 'var(--v54-navy-300)' }}>({opt[2]}‰)</span></div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 10 }}>{v.edificio}</div>
        </div>
      ))}
    </>
  )
}
