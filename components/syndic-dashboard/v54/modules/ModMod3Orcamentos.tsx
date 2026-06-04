'use client'

import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'

/** Orçamentos & Obras (3 orçamentos) — port byte-exact du Mod3Orcamentos du bundle V5.7. */

type Obra = { titulo: string; tipo: string; desc: string; local: string; prazo: string; orcamento?: string; empresa?: string; orcCount: string }
type Col = { titulo: string; count: number; cor: 'amber' | 'gold' | 'sage'; obras: Obra[] }

const COLS: Col[] = [
  { titulo: 'Orçamentação', count: 1, cor: 'amber', obras: [
    { titulo: 'Impermeabilização da cobertura', tipo: 'Reparação', desc: 'Reparação e impermeabilização completa da cobertura do edifício principal, inclu…', local: 'Edifício Av. da Liberdade, 42', prazo: '30/06/2026', orcCount: '3/3 orçamentos' },
  ] },
  { titulo: 'Aprovação AG', count: 1, cor: 'gold', obras: [
    { titulo: 'Renovação da fachada exterior', tipo: 'Renovação', desc: 'Pintura e restauro da fachada com tratamento anti-humidade e limpeza de cantaria…', local: 'Edifício Rua Augusta, 105', prazo: '15/09/2026', orcamento: '29 800,00 €', empresa: 'ConstruPT Lda.', orcCount: '3/3 orçamentos' },
  ] },
  { titulo: 'Em Execução', count: 0, cor: 'sage', obras: [] },
  { titulo: 'Concluída', count: 0, cor: 'sage', obras: [] },
]

const dotClass = (cor: Col['cor']) => clsx(m.dotStatus, cor === 'amber' && m.dotStatusAmber, cor === 'gold' && m.dotStatusGold)

export default function ModMod3Orcamentos() {
  return (
    <>
      <PageHead title="Orçamentos & Obras" lede="Comparação obrigatória de 3 orçamentos · Lei 8/2022 Art. 1436.° CC" />
      <KPIGrid items={[
        { icon: 'construction', num: 2, lbl: 'Obras Ativas', accent: 'gold' },
        { icon: 'pencil', num: 1, lbl: 'Em Orçamentação', accent: 'amber' },
        { icon: 'check', num: 1, lbl: 'Aprovação AG', accent: 'sage' },
        { icon: 'wrench', num: 0, lbl: 'Em Execução' },
        { icon: 'check', num: 0, lbl: 'Concluídas', accent: 'sage' },
        { icon: 'chart', num: 6, lbl: 'Total Orçamentos' },
      ]} />
      <Tabs defaultActive="cur" tabs={[
        { id: 'cur', icon: 'construction', label: 'Obras em Curso', badge: 2 },
        { id: 'cmp', icon: 'chart', label: 'Comparação Orçamentos', badge: 2 },
        { id: 'arq', icon: 'folder', label: 'Arquivo', badge: 0 },
        { id: 'reg', icon: 'clipboard', label: 'Regras' },
      ]} />
      <Button variant="gold" style={{ marginBottom: 14 }}><Icon name="plus" />+ Nova Obra</Button>
      <div className={m.cardGrid4}>
        {COLS.map((col, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><span className={dotClass(col.cor)}></span> {col.titulo}</span>
              <span style={{ fontWeight: 700, color: 'var(--v54-navy-300)' }}>{col.count}</span>
            </div>
            {col.obras.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: 'var(--v54-navy-300)', background: 'var(--v54-paper)', borderRadius: 12, fontSize: 12.5 }}>Nenhuma obra</div>
            ) : (
              col.obras.map((o, j) => (
                <Panel key={j}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 6 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{o.titulo}</div><Pill kind={col.cor} noDot>{o.tipo}</Pill></div>
                  <div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)', marginBottom: 8 }}>{o.desc}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginBottom: 4 }}>{o.local}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginBottom: 4 }}>Prazo: {o.prazo}</div>
                  {o.orcamento && <div style={{ fontSize: 12, color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 4 }}>Orçamento: {o.orcamento}</div>}
                  {o.empresa && <div style={{ fontSize: 11.5, marginBottom: 4 }}>{o.empresa}</div>}
                  <Pill kind="sage" noDot>{o.orcCount}</Pill>
                  <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                    {i === 0
                      ? <Button size="sm"><Icon name="chart" />Comparar</Button>
                      : <select className={clsx(btnCss.btn, btnCss.sm)} style={{ flex: 1 }} aria-label="Estado da obra"><option>{col.titulo}</option></select>}
                  </div>
                </Panel>
              ))
            )}
          </div>
        ))}
      </div>
    </>
  )
}
