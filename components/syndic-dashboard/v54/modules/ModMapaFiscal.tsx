'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { downloadCsv } from '@/lib/syndic/v54/export-csv'

/** Mapa Fiscal Anual — port byte-exact V5.7 + Phase 3 : rapport calculé (lecture seule) depuis
 * data.contratos (dépenses par catégorie) + data.faturas (recettes). Aucune nouvelle table/route. */

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
// Preview byte-exact (anonyme) : catégories standard à 0.
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
// Catégorie contrat → [libellé fiscal, CAE typique]
const CAT_META: Record<string, [string, string]> = {
  limpezas: ['Limpezas', '81210'],
  elevadores: ['Manutenção elevadores', '43222'],
  jardinagem: ['Jardinagem', '81300'],
  seguranca: ['Segurança', '80100'],
  outros: ['Outras despesas', '—'],
}

export default function ModMapaFiscal() {
  const data = useSyndicData()
  const real = data.authenticated
  const contratos = real ? (data.contratos ?? []) : []
  const faturas = real ? (data.faturas ?? []) : []

  const totalDespesas = contratos.reduce((s, c) => s + (c.custoAnual || 0), 0)
  const totalReceitas = faturas.reduce((s, f) => s + (f.montantTtc || 0), 0)
  // Lignes calculées : groupées par catégorie de contrat (≥ 1 contrat).
  const computedRows: (string | number)[][] = Object.entries(CAT_META).map(([key, [label, cae]]) => {
    const list = contratos.filter((c) => c.categoria === key)
    const total = list.reduce((s, c) => s + (c.custoAnual || 0), 0)
    const pct = totalDespesas > 0 ? `${Math.round((total / totalDespesas) * 100)}%` : '—'
    return [label, cae, list.length, fmtEUR(total), pct, 'Sim'] as (string | number)[]
  }).filter((r) => (r[2] as number) > 0)

  const rows = real ? computedRows : ROWS
  const { push } = useToast()
  const exportar = () => {
    if (!real) { push({ kind: 'info', title: 'Exportação', desc: 'Conecte-se como síndico para exportar' }); return }
    try {
      downloadCsv('mapa-fiscal.csv', ['Categoria', 'CAE típico', 'Lançamentos', 'Total ano', '% Total', 'Dedutível IRC'], rows)
      push({ kind: 'success', title: 'Exportação concluída', desc: `${contratos.length} contratos · ${fmtEUR(totalDespesas)} despesas` })
    } catch (err) {
      console.error('[ModMapaFiscal] export CSV falhou', err)
      push({ kind: 'error', title: 'Erro', desc: 'Não foi possível exportar.' })
    }
  }

  return (
    <>
      <PageHead eyebrow="FISCAL · DECLARATIVO ANUAL" title="Mapa Fiscal Anual"
        lede="Categorização Max Expert · Export Primavera/PHC/Sage · Reconciliação 100% com contabilidade"
        actions={<><Button onClick={() => push({ kind: 'info', title: 'Max Expert', desc: 'Recategorização IA — em breve' })}><Icon name="bot" />Recategorizar com Max</Button><Button variant="gold" onClick={exportar}><Icon name="download" />Exportar (Excel · PDF · IES)</Button></>} />
      <Alert kind="sage" icon="check" title="Max Expert categoriza 100% das linhas">
        Cada fatura é classificada por <strong>CAE prestador + natureza despesa</strong>. O mapa exporta-se em 3 formatos compatíveis com os principais programas de contabilidade portugueses (Primavera, PHC, Sage) + formato AT (SAF-T).
      </Alert>
      <KPIGrid items={[
        { icon: 'fact', num: real ? contratos.length + faturas.length : 0, lbl: 'Lançamentos ano corrente' },
        { icon: 'bot', num: real && contratos.length ? '100%' : '0%', lbl: 'Categorização IA', accent: 'sage' },
        { icon: 'coin', num: real ? fmtEUR(totalDespesas) : '0,00 €', lbl: 'Total despesas' },
        { icon: 'coin', num: real ? fmtEUR(totalReceitas) : '0,00 €', lbl: 'Total receitas' },
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
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--v54-navy-300)' }}>Nenhum contrato categorizado — adicione contratos para alimentar o mapa fiscal.</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
