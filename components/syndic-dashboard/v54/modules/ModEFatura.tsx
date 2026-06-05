'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Integração e-Fatura AT — port byte-exact du ModEFatura du bundle V5.7. */

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const
const cellInput = { border: 'none', background: 'transparent', padding: '4px 0', font: 'inherit' } as const
const sumLbl = { fontSize: 11, color: 'var(--v54-navy-300)' } as const
const sumVal = { fontFamily: 'var(--v54-font-serif)', fontSize: 22 } as const

export default function ModEFatura() {
  return (
    <>
      <PageHead title="Integração e-Fatura AT" lede="Submissão de faturas e documentos à Autoridade Tributária e Aduaneira" />
      <KPIGrid items={[
        { icon: 'doc', num: 0, lbl: 'Total faturas submetidas' },
        { icon: 'coin', num: '0,00 €', lbl: 'Valor total', accent: 'gold' },
        { icon: 'check', num: 0, lbl: 'Aceites AT', accent: 'sage' },
        { icon: 'ban', num: 0, lbl: 'Rejeitadas', accent: 'rust' },
      ]} />
      <Tabs defaultActive="sub" tabs={[
        { id: 'sub', icon: 'upload', label: 'Submissão' },
        { id: 'hist', icon: 'stamp', label: 'Histórico' },
        { id: 'saft', icon: 'archive', label: 'SAF-T PT' },
        { id: 'cfg', icon: 'cog', label: 'Configuração' },
      ]} />
      <Panel title="Nova Submissão e-Fatura">
        <div className={m.cardGrid3}>
          <div><label htmlFor="ef-nif-e" style={fieldLabel}>NIF Emitente *</label><input id="ef-nif-e" placeholder="999999999" style={fieldCtrl} /></div>
          <div><label htmlFor="ef-nif-d" style={fieldLabel}>NIF Destinatário *</label><input id="ef-nif-d" placeholder="999999999" style={fieldCtrl} /></div>
          <div><label htmlFor="ef-data" style={fieldLabel}>Data do Documento *</label><input id="ef-data" type="date" defaultValue="2026-05-24" aria-label="Data" autoComplete="bday" style={fieldCtrl} /></div>
        </div>
        <div style={{ marginTop: 14 }}><label htmlFor="ef-tipo" style={fieldLabel}>Tipo de Documento *</label><select id="ef-tipo" style={fieldCtrl}><option>Fatura</option></select></div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--v54-navy-500)', marginBottom: 8, marginTop: 10 }}>Itens do Documento</div>
        <div className={m.tblWrap}>
          <table className={m.tbl} style={{ border: '1px solid var(--v54-line)', borderRadius: 8 }}>
            <thead><tr><th>Descrição *</th><th>QTD</th><th>Preço unit. (EUR)</th><th>Taxa IVA</th><th>Subtotal</th></tr></thead>
            <tbody>
              <tr>
                <td><input aria-label="Descrição" style={{ ...cellInput, width: '100%' }} placeholder="Descrição do serviço ou produto" /></td>
                <td><input aria-label="Quantidade" defaultValue="1" style={{ ...cellInput, width: 60 }} /></td>
                <td><input aria-label="Preço unitário" defaultValue="0.00" style={{ ...cellInput, width: 90 }} /></td>
                <td><select aria-label="Taxa IVA" style={cellInput}><option>23% (Normal)</option></select></td>
                <td className={m.numCell}>0,00 €</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Button style={{ marginTop: 10 }}><Icon name="plus" />+ Adicionar linha</Button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 18, padding: 14, background: 'var(--v54-paper)', borderRadius: 10 }}>
          <div><div style={sumLbl}>Total s/ IVA (HT)</div><div style={sumVal}>0,00 €</div></div>
          <div><div style={sumLbl}>IVA</div><div style={sumVal}>0,00 €</div></div>
          <div><div style={sumLbl}>Total c/ IVA (TTC)</div><div style={{ ...sumVal, color: 'var(--v54-gold-700)' }}>0,00 €</div></div>
        </div>
        <Button variant="gold" style={{ width: '100%', marginTop: 18, padding: 14, justifyContent: 'center' }}><Icon name="upload" />Submeter ao e-Fatura</Button>
      </Panel>
    </>
  )
}
