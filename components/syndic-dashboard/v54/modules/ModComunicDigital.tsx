'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import m from './modules.module.css'

/** Comunicação Digital — port byte-exact du ModComunicDigital du bundle V5.7 (table). */

const MSGS = [
  ['Ana Silva', 'A-102', 'Urgência', 'Corte de água 14/03 das 9h às 14h', 'Email', '16 mai. 2026', 'Lido', 'sage'],
  ['João Pereira', 'B-205', 'Cobrança', 'Lembrete de quotas em atraso — 950 €', 'Email', '15 mai. 2026', 'Entregue', 'amber'],
  ['Manuel Costa', 'B-102', 'Cobrança', 'Lembrete de quotas em atraso — 1 280 €', 'Carta', '14 mai. 2026', 'Enviado', 'navy'],
  ['Carlos Rodrigues', 'A-101', 'Convocatória AG', 'Convocatória AG Ordinária — 15 mar. 2026', 'Email', '11 mai. 2026', 'Lido', 'sage'],
  ['Sofia Marques', 'A-203', 'Convocatória AG', 'Convocatória AG Ordinária — 15 mar. 2026', 'Email', '11 mai. 2026', 'Entregue', 'amber'],
  ['Beatriz Oliveira', 'A-301', 'Informação', 'Obras de reabilitação da fachada', 'Email', '06 mai. 2026', 'Lido', 'sage'],
] as const

const ctrl = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 13 } as const

const tipoKind = (t: string): PillKind =>
  t.includes('Urgência') ? 'rust' : t.includes('Cobrança') ? 'amber' : t.includes('Convocatória') ? 'gold' : 'sage'
const statusKind = (s: string): PillKind | undefined =>
  s === 'sage' ? 'sage' : s === 'amber' ? 'amber' : s === 'navy' ? 'dark' : undefined

export default function ModComunicDigital() {
  return (
    <>
      <PageHead title="Comunicação Digital" lede="Mensagens internas e comunicação com profissionais" />
      <Tabs defaultActive="msg" tabs={[
        { id: 'msg', icon: 'mail', label: 'Mensagens' },
        { id: 'mod', icon: 'clipboard', label: 'Modelos' },
        { id: 'gp', icon: 'mail', label: 'Envio em grupo' },
        { id: 'def', icon: 'cog', label: 'Definições' },
      ]} />
      <KPIGrid items={[
        { icon: 'chart', num: 6, lbl: 'Total enviados' },
        { icon: 'mail', num: 1, lbl: 'Em espera', accent: 'amber' },
        { icon: 'check', num: 2, lbl: 'Distribuídos', accent: 'gold' },
        { icon: 'check', num: 3, lbl: 'Lidos', accent: 'sage' },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <select aria-label="Filtrar por tipo" style={ctrl}><option>Todos os tipos</option></select>
        <input aria-label="Pesquisar condómino" style={{ ...ctrl, textAlign: 'left' }} placeholder="Pesquisar condómino…" />
        <input aria-label="Data de início" style={ctrl} type="date" />
        <input aria-label="Data de fim" style={ctrl} type="date" />
      </div>
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Condómino</th><th>Fração</th><th>Tipo</th><th>Assunto</th><th>Canal</th><th>Data</th><th>Status</th></tr></thead>
            <tbody>
              {MSGS.map((msg) => (
                <tr key={msg[0]}>
                  <td><b>{msg[0]}</b></td>
                  <td className={m.numCell}>{msg[1]}</td>
                  <td><Pill kind={tipoKind(msg[2])} noDot>{msg[2]}</Pill></td>
                  <td>{msg[3]}</td>
                  <td>{msg[4]}</td>
                  <td className={m.numCell}>{msg[5]}</td>
                  <td><Pill kind={statusKind(msg[7])} noDot>● {msg[6]}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
