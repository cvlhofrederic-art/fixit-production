'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Mapa Fiscal Anual — port byte-exact du ModMapaFiscal du bundle V5.7. */

const ROWS: (string | number)[][] = [
  ['Limpezas', '81210', 0, '0,00 €', '—', 'Sim'],
  ['Manutenção elevadores', '43222', 0, '0,00 €', '—', 'Sim'],
  ['Jardinagem', '81300', 0, '0,00 €', '—', 'Sim'],
  ['Segurança', '80100', 0, '0,00 €', '—', 'Sim'],
  ['Eletricidade comum', '35140', 0, '0,00 €', '—', 'Sim'],
  ['Água comum', '36000', 0, '0,00 €', '—', 'Sim'],
  ['Seguros', '65120', 0, '0,00 €', '—', 'Sim'],
  ['Outras despesas', '—', 0, '0,00 €', '—', 'Variável'],
]

export default function ModMapaFiscal() {
  return (
    <>
      <PageHead eyebrow="FISCAL · DECLARATIVO ANUAL" title="Mapa Fiscal Anual"
        lede="Categorização Max Expert · Export Primavera/PHC/Sage · Reconciliação 100% com contabilidade"
        actions={<><Button><Icon name="bot" />Recategorizar com Max</Button><Button variant="gold"><Icon name="download" />Exportar (Excel · PDF · IES)</Button></>} />
      <Alert kind="sage" icon="check" title="Max Expert categoriza 100% das linhas">
        Cada fatura é classificada por <strong>CAE prestador + natureza despesa</strong>. O mapa exporta-se em 3 formatos compatíveis com os principais programas de contabilidade portugueses (Primavera, PHC, Sage) + formato AT (SAF-T).
      </Alert>
      <KPIGrid items={[
        { icon: 'fact', num: 0, lbl: 'Lançamentos ano corrente' },
        { icon: 'bot', num: '0%', lbl: 'Categorização IA', accent: 'sage' },
        { icon: 'coin', num: '0,00 €', lbl: 'Total despesas' },
        { icon: 'coin', num: '0,00 €', lbl: 'Total receitas' },
        { icon: 'check', num: 'OK', lbl: 'Reconciliação', accent: 'sage' },
        { icon: 'download', num: 0, lbl: 'Exportações geradas' },
      ]} />
      <Tabs defaultActive="2026" tabs={[
        { id: '2026', label: '2026 (em curso)' },
        { id: '2025', label: '2025' },
        { id: '2024', label: '2024' },
      ]} />
      <Panel title="Categorias fiscais — auto Max Expert" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Categoria</th><th>CAE típico</th><th>Lançamentos</th><th>Total ano</th><th>% Total</th><th>Dedutível IRC</th></tr></thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
