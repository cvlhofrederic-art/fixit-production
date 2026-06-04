'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Coprop } from '@/lib/syndic/v54/api'

/** Mapa de Quotas — port byte-exact du ModMapaQuotas du bundle V5.7. */

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const

type Row = { frac: string; cond: string; perm: number; area: number; quota: string; fcr: string; total: string; estado: string; kind: PillKind; detalhe?: string }
const ROWS: Row[] = [
  { frac: 'Fração A - R/C Esq.', cond: 'Ana Silva', perm: 70, area: 65, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'Em dia', kind: 'sage' },
  { frac: 'Fração B - R/C Dto.', cond: 'Bruno Costa', perm: 75, area: 72, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'Em dia', kind: 'sage' },
  { frac: 'Fração C - 1.° Esq.', cond: 'Carla Ferreira', perm: 90, area: 85, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'Em dia', kind: 'sage' },
  { frac: 'Fração D - 1.° Dto.', cond: 'Daniel Oliveira', perm: 95, area: 90, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'Atraso', kind: 'amber', detalhe: '45d atraso | 185,00 €' },
  { frac: 'Fração E - 2.° Esq.', cond: 'Elena Santos', perm: 82, area: 78, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'Em dia', kind: 'sage' },
  { frac: 'Fração F - 2.° Dto.', cond: 'Francisco Rodrigues', perm: 100, area: 95, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'Em dia', kind: 'sage' },
  { frac: 'Fração G - 3.° Esq.', cond: 'Gabriela Almeida', perm: 92, area: 88, quota: '0,00 €', fcr: '0,00 €', total: '0,00 €', estado: 'Dívida', kind: 'rust', detalhe: '120d atraso | 1450,00 €' },
]

const fmtEUR = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

/** Statut depuis le solde (convention ancien dashboard : < 0 = doit). */
function soldeEstado(solde: number): { estado: string; kind: PillKind } {
  if (solde <= -1000) return { estado: 'Dívida', kind: 'rust' }
  if (solde < 0) return { estado: 'Atraso', kind: 'amber' }
  return { estado: 'Em dia', kind: 'sage' }
}

function coproToRow(c: Coprop): Row {
  const solde = c.solde ?? 0
  const st = soldeEstado(solde)
  return {
    frac: [c.immeuble, c.batiment, c.numeroPorte].filter(Boolean).join(' · ') || '—',
    cond: c.proprietario || '—',
    perm: c.tantieme ?? 0,
    area: 0,
    quota: '0,00 €',
    fcr: '0,00 €',
    total: '0,00 €',
    estado: st.estado,
    kind: st.kind,
    detalhe: solde < 0 ? `${fmtEUR(Math.abs(solde))} em dívida` : undefined,
  }
}

export default function ModMapaQuotas() {
  // Phase 2 : quotas réelles du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const copros = data.coproprios ?? []
  const rows: Row[] = real ? copros.map(coproToRow) : ROWS
  const dividaTotal = real ? copros.filter((c) => (c.solde ?? 0) < 0).reduce((s, c) => s + Math.abs(c.solde ?? 0), 0) : 3960
  const emDia = real ? copros.filter((c) => (c.solde ?? 0) >= 0).length : 8
  const taxaCobranca = real ? (copros.length ? Math.round((emDia / copros.length) * 100) : 100) : 66.7
  return (
    <>
      <PageHead title="Mapa de Quotas" lede="Gestão inteligente de quotas do condomínio"
        actions={<Pill kind={dividaTotal > 0 ? 'rust' : 'sage'} noDot>Dívida total: {fmtEUR(dividaTotal)}</Pill>} />
      <Tabs defaultActive="map" tabs={[
        { id: 'map', icon: 'coin', label: 'Mapa de Quotas' },
        { id: 'sim', label: 'Simulador' },
        { id: 'cob', icon: 'clipboard', label: 'Cobranças' },
        { id: 'rel', icon: 'chart', label: 'Relatório' },
      ]} />
      <KPIGrid items={[
        { icon: 'coin', num: '48 000,00 €', lbl: 'Orçamento anual', sub: '4000,00 €/mês' },
        { icon: 'bank', num: '0,00 €', lbl: 'FCR anual', sub: '10% (min. 10% DL 268/94)', accent: 'gold' },
        { icon: 'chart', num: '0,00 €', lbl: 'Quota média', sub: '12 frações' },
        { icon: 'chart', num: `${taxaCobranca}%`, lbl: 'Taxa cobrança', sub: real ? `${emDia} em dia / ${copros.length - emDia} irregulares` : '8 em dia / 4 irregulares', accent: 'sage' },
      ]} />
      <Panel>
        <div className={m.cardGrid3} style={{ marginBottom: 14 }}>
          <div><label htmlFor="mq-orc" style={fieldLabel}>Orçamento anual (EUR)</label><input id="mq-orc" defaultValue="48000" style={fieldCtrl} /></div>
          <div><label htmlFor="mq-fcr" style={fieldLabel}>FCR (10%)</label><input id="mq-fcr" type="range" min="0" max="100" defaultValue="50" aria-label="Valor" style={fieldCtrl} /></div>
          <div><label htmlFor="mq-modo" style={fieldLabel}>Modo de cálculo</label><div id="mq-modo" style={{ display: 'flex', gap: 4 }}><Button size="sm" style={{ flex: 1 }}>Fixa</Button><Button size="sm" style={{ flex: 1 }}>Por área (m²)</Button><Button size="sm" variant="primary" style={{ flex: 1 }}>Permilagem</Button></div></div>
        </div>
      </Panel>
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Fração</th><th>Condómino</th><th>Permilagem</th><th>Área (m²)</th><th>Quota mensal</th><th>FCR</th><th>Total mensal</th><th>Estado</th></tr></thead>
            <tbody>
              {rows.map((q, i) => (
                <tr key={i}>
                  <td><b>{q.frac}</b></td>
                  <td>{q.cond}</td>
                  <td className={m.numCell}>{q.perm}</td>
                  <td className={m.numCell}>{q.area}</td>
                  <td className={m.numCell}>{q.quota}</td>
                  <td className={m.numCell}>{q.fcr}</td>
                  <td className={m.numCell}>{q.total}</td>
                  <td><Pill kind={q.kind} noDot>● {q.estado}</Pill>{q.detalhe && <div style={{ fontSize: 11, color: 'var(--v54-rust-700)', marginTop: 2 }}>{q.detalhe}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
