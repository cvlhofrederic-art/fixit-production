'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Relatório Mensal — port byte-exact du ModRelatorioMensal du bundle V5.7 (aperçu PDF). */

const STATS = [
  ['4', 'Edifícios', 'gold'],
  ['2', 'Intervenções do mês', 'gold'],
  ['0 €', 'Montante obras', 'sage'],
  ['55%', 'Orçamento consumido', 'sage'],
] as const

const INTERV = [
  ['Residencial Cedofeita — Inspeção técnica', 'Bruno Tavares', '12/04/2026', '0 €'],
  ['Edifício Atlântico — Manutenção corrente', 'Diogo Pereira', '29/04/2026', '0 €'],
] as const

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldSelect = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)' } as const
const serif = { fontFamily: 'var(--v54-font-serif)' } as const

export default function ModRelatorioMensal() {
  return (
    <>
      <PageHead title="Relatório Mensal" lede="Síntese mensal de gestão — descarregar PDF ou enviar aos condóminos" />
      <Panel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 14, alignItems: 'flex-end' }}>
          <div><label htmlFor="rm-mes" style={fieldLabel}>Mês</label><select id="rm-mes" style={fieldSelect}><option>Abril</option><option>Maio</option></select></div>
          <div><label htmlFor="rm-ano" style={fieldLabel}>Ano</label><select id="rm-ano" style={fieldSelect}><option>2026</option></select></div>
          <Button><Icon name="mail" />Enviar aos condóminos</Button>
          <Button variant="gold"><Icon name="download" />Descarregar PDF</Button>
        </div>
      </Panel>
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--v54-navy-300)', margin: '8px 0 14px' }}>Pré-visualização do relatório — este conteúdo será gerado em PDF</div>
      <div className={m.card} style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'var(--v54-navy-900)', color: '#fff', padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 6 }}>Relatório Mensal de Gestão</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ ...serif, fontSize: 34 }}>Abril 2026</div><div style={{ fontSize: 11, color: 'var(--v54-navy-200)' }}>Gerado a 24/05/2026</div></div>
        </div>
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {STATS.map((k) => (
            <div key={k[1]} style={{ textAlign: 'center', padding: 18, borderRadius: 12, background: k[2] === 'sage' ? 'var(--v54-sage-50)' : 'var(--v54-gold-50)' }}>
              <div style={{ ...serif, fontSize: 34, fontWeight: 500 }}>{k[0]}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)' }}>{k[1]}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ ...serif, fontSize: 17, marginBottom: 12, fontWeight: 500 }}>Intervenções do mês</div>
          {INTERV.map((r, i) => (
            <div key={r[0]} style={{ padding: '10px 0', borderBottom: i === 0 ? '1px solid var(--v54-line)' : 'none', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <div><b>{r[0]}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{r[1]} · {r[2]}</div></div>
              <div style={{ fontWeight: 600 }}>{r[3]}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
