'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Reembolsos Automáticos — port byte-exact du ModReembolsos du bundle V5.7. */

const STEPS: [string, string, string][] = [
  ['1', 'Declaração venda fração', 'Por antigo proprietário · email/portal · prazo legal 15 dias'],
  ['2', 'Max Expert calcula reembolso', 'Pro-rata sobre quotas + FCR já pagos · prazo < 1h'],
  ['3', 'Validação administrador', '1-clique aprovação ou ajuste manual'],
  ['4', 'Execução Open Banking', 'Ordem virement automática via API AISP'],
  ['5', 'Confirmação + arquivo', 'Email antigo proprietário · arquivo contabilístico'],
]
const codeStyle = { fontFamily: 'var(--v54-font-mono)', background: 'var(--v54-cream)', padding: '2px 6px', borderRadius: 3 } as const

export default function ModReembolsos() {
  return (
    <>
      <PageHead eyebrow="OPERACIONAL · MUDANÇA DE PROPRIEDADE" title="Reembolsos Automáticos"
        lede="Pro-rata temporis na venda de fração · Max Expert calcula · Open Banking executa · Lei 8/2022 prazos"
        actions={<><Button><Icon name="users" />Registar mudança proprietário</Button><Button variant="gold"><Icon name="refresh" />Ver reembolsos pendentes</Button></>} />
      <Alert kind="gold" icon="scale" title="Direito a reembolso pro-rata na venda">
        Quando um condómino vende mid-year, as quotas pré-pagas devem ser reembolsadas proporcionalmente. <strong>Fórmula</strong>: <code style={codeStyle}>quotas_pagas × (dias_restantes / dias_periodo)</code>. Lei 8/2022 fixa prazo notificação venda em 15 dias.
      </Alert>
      <KPIGrid items={[
        { icon: 'refresh', num: 0, lbl: 'Reembolsos processados (ano)' },
        { icon: 'coin', num: '0,00 €', lbl: 'Total reembolsado (ano)', accent: 'gold' },
        { icon: 'clock', num: 0, lbl: 'A processar', accent: 'amber' },
        { icon: 'check', num: '0,00 €', lbl: 'Liquidado via Open Banking', accent: 'sage' },
        { icon: 'alert', num: 0, lbl: 'Bloqueados (rever)', accent: 'rust' },
        { icon: 'bot', num: 'Max Expert', lbl: 'Motor cálculo' },
      ]} />
      <Tabs defaultActive="pend" tabs={[
        { id: 'pend', icon: 'clock', label: 'Pendentes (0)' },
        { id: 'liq', icon: 'check', label: 'Liquidados' },
        { id: 'todos', label: 'Todos (12m)' },
      ]} />
      <Panel flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Antigo proprietário</th><th>Fração</th><th>Data venda</th><th>Quotas pagas</th><th>Dias restantes</th><th>Reembolso</th><th>Método</th><th>Estado</th></tr></thead>
            <tbody><tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--v54-navy-400)' }}>Nenhum reembolso em curso.</td></tr></tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Pipeline automático" sub="Lei 8/2022 — 15 dias">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map(([n, t, s], i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', background: 'var(--v54-cream)', borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--v54-gold-500)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{n}</div>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{t}</div><div style={{ fontSize: 12, color: 'var(--v54-navy-400)' }}>{s}</div></div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
