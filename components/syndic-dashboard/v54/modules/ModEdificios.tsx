'use client'

import { PageHead } from '../primitives/page-head'
import { Pill } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import { Progress } from '../primitives/progress'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Edifícios — port byte-exact du ModEdificios du bundle V5.7 (utilise Progress). */

const BUILDINGS = [
  ['Edifício Atlântico', 'Avenida da Boavista, 1247, 4100-130 Porto', 12, 2008, '15/09', '8', 28450, 48000, 'Regulamento em falta'],
  ['Condomínio Boavista Center', 'Avenida da Boavista, 3265, 4100-138 Porto', 8, 2015, '30/06', '4', 18700, 36000, 'Regulamento em falta'],
  ['Residencial Cedofeita', 'Rua de Cedofeita, 421, 4050-180 Porto', 10, 1998, '22/04', '11', 33820, 42000, 'Regulamento em falta'],
  ['Edifício Foz Douro', 'Rua do Passeio Alegre, 78, 4150-573 Porto', 10, 2020, '10/01', '2', 21500, 62000, 'Regulamento em falta'],
] as const

const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.max(0, (a / b) * 100)) : 0)
const eur = (n: number) => n.toLocaleString('pt-PT')

const btn = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)' } as const
const btnGold = { ...btn, border: '1px solid var(--v54-gold-700)', background: 'linear-gradient(155deg, var(--v54-gold-500), var(--v54-gold-700))', color: 'var(--v54-navy-900)' } as const

export default function ModEdificios() {
  return (
    <>
      <PageHead
        title="Edifícios"
        lede={`${BUILDINGS.length} edifícios na sua carteira · 40 frações totais`}
        actions={<button type="button" style={btnGold}><Icon name="plus" />Adicionar um edifício</button>}
      />
      <KPIGrid items={[
        { icon: 'building', num: 4, lbl: 'Edifícios geridos', sub: 'Carteira ativa' },
        { icon: 'grid', num: 40, lbl: 'Frações totais', sub: 'Total de frações', accent: 'gold' },
        { icon: 'clipboard', num: 25, lbl: 'Intervenções ativas', sub: 'Em curso', accent: 'sage' },
        { icon: 'alert', num: 4, lbl: 'Documentos em falta', sub: 'Regulamentos a adicionar', accent: 'amber' },
      ]} />
      {BUILDINGS.map((b) => (
        <div key={b[0]} className={m.card} style={{ marginBottom: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 18 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name="building" style={{ width: 24, height: 24 }} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 24, fontWeight: 500, letterSpacing: '-0.01em' }}>{b[0]}</div>
              <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{b[1]}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Pill noDot>{b[2]} frações</Pill>
                <Pill noDot>Construído em {b[3]}</Pill>
                <Pill kind="amber" noDot>{b[8]}</Pill>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={btn}><Icon name="pencil" />Editar</button>
              <button type="button" style={btn} aria-label="Suspender edifício" title="Suspender"><Icon name="ban" /></button>
              <button type="button" style={btnGold}><Icon name="plus" />Nova missão</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 18 }}>
            <div><div className={m.statKey}>Frações</div><div className={m.statBig}>{b[2]}</div><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>Total de frações</div></div>
            <div><div className={m.statKey}>Construído em</div><div className={m.statBig}>{b[3]}</div></div>
            <div><div className={m.statKey}>Intervenções</div><div className={m.statBig}>{b[5]}</div><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>Em curso</div></div>
            <div><div className={m.statKey}>Próxima inspeção</div><div className={m.statBig}>{b[4]}</div></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}><span style={{ color: 'var(--v54-gold-700)', fontWeight: 600 }}>Orçamento 2026</span><span className={m.mono} style={{ color: 'var(--v54-navy-500)' }}>{eur(b[6])} € / {eur(b[7])} €</span></div>
          <Progress pct={pct(b[6], b[7])} />
          <div style={{ marginTop: 14, display: 'flex', gap: 14, fontSize: 12, color: 'var(--v54-navy-300)' }}>
            <span style={{ color: 'var(--v54-gold-700)', fontWeight: 600, cursor: 'pointer' }}>Adicionar o regulamento de condomínio</span>
            <div style={{ flex: 1 }} />
            <span style={{ cursor: 'pointer' }}>Condóminos</span>
            <span style={{ cursor: 'pointer' }}>Documentos (GED)</span>
            <span style={{ cursor: 'pointer' }}>Histórico</span>
          </div>
        </div>
      ))}
    </>
  )
}
