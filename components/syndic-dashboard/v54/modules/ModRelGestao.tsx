'use client'

import { PageHead } from '../primitives/page-head'
import { Alert } from '../primitives/alert'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Relatório de Gestão — port byte-exact du ModRelGestao du bundle V5.7. */

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const
const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const
const serif = { fontFamily: 'var(--v54-font-serif)' } as const

const FIELDS = [
  ['Edifícios geridos', '0', false],
  ['Intervenções do mês', '0', false],
  ['Montante obras (€)', '0', false],
  ['Orçamento anual (€)', '0', false],
  ['Despesas do ano (€)', '0', false],
  ['Orçamento consumido', '—', true],
] as const

const STATS = [['0', 'Edifícios'], ['0', 'Intervenções'], ['0 €', 'Montante obras'], ['—', 'Orçamento consumido']] as const

export default function ModRelGestao() {
  return (
    <>
      <PageHead title="Relatório de Gestão" lede="Relatório anual · Prestação de contas · Art.° 1436.° CC · Lei 8/2022" />
      <Alert kind="gold" icon="scale" title="Relatório de Gestão — Art.° 1436.° do Código Civil">
        O administrador do condomínio é obrigado a prestar contas à assembleia de condóminos (Lei 8/2022). Este relatório facilita a prestação de contas mensal e anual.
      </Alert>
      <Panel
        title="Dados do período — Abril 2026"
        right={<>
          <select aria-label="Mês" style={selectStyle}><option>Abril</option></select>
          <select aria-label="Ano" style={selectStyle}><option>2026</option></select>
          <Button variant="gold"><Icon name="download" />Descarregar PDF</Button>
        </>}
      >
        <div className={m.cardGrid3}>
          {FIELDS.map((f, i) => (
            <div key={f[0]}>
              <label htmlFor={`rg-${i}`} style={fieldLabel}>{f[0]}</label>
              <input id={`rg-${i}`} defaultValue={f[1]} style={f[2] ? { ...fieldCtrl, background: 'var(--v54-sage-50)', color: 'var(--v54-sage-700)' } : fieldCtrl} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <label htmlFor="rg-obs" style={fieldLabel}>Observações</label>
          <textarea id="rg-obs" rows={3} placeholder="Notas adicionais, alertas regulamentares, decisões pendentes…" style={fieldCtrl} />
        </div>
      </Panel>
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--v54-navy-300)', margin: '10px 0 14px' }}>Pré-visualização do relatório</div>
      <div className={m.card} style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'var(--v54-navy-900)', color: '#fff', padding: '22px 28px', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--v54-gold-700)', fontWeight: 600 }}>Relatório Mensal de Gestão</div>
          <div style={{ textAlign: 'right' }}><div style={{ ...serif, fontSize: 32 }}>Abril 2026</div><div style={{ fontSize: 11, color: 'var(--v54-navy-200)' }}>Gerado a 24/05/2026</div></div>
        </div>
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {STATS.map((k, i) => (
            <div key={k[1]} style={{ textAlign: 'center', padding: 18, borderRadius: 12, background: i < 2 ? 'var(--v54-gold-50)' : 'var(--v54-sage-50)' }}>
              <div style={{ ...serif, fontSize: 34 }}>{k[0]}</div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)' }}>{k[1]}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 24px 24px', color: 'var(--v54-navy-300)', fontSize: 13, textAlign: 'center', paddingBottom: 24 }}>Preencha os dados acima para gerar o relatório de gestão de Abril 2026</div>
      </div>
    </>
  )
}
