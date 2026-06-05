'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { KPIGrid } from '../primitives/kpi'
import { Empty } from '../primitives/empty'
import { Pill, type PillKind } from '../primitives/pill'
import { ErrorState } from '../primitives/error-state'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/** Multi-Imóveis — port V5.7 + lot 4 fonctionnel.
 * Syndic connecté → portefeuille consolidé à partir de data.immeubles (déjà chargé, aucune
 * table nouvelle) ; anonyme → ErrorState byte-exact (design showcase). */

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
const pctUsado = (dep: number, orc: number) => (orc > 0 ? Math.round((dep / orc) * 100) : 0)
const usoKind = (p: number): PillKind => (p >= 100 ? 'rust' : p >= 85 ? 'amber' : 'sage')

export default function ModMultiImoveis() {
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.immeubles ?? []) : []

  if (!real) {
    return (
      <>
        <PageHead title="Multi-Imóveis" lede="Gestão consolidada do seu portefólio" />
        <Panel>
          <ErrorState title="Erro ao carregar imóveis" desc="Verifique a sua ligação e tente novamente." onRetry={() => window.location.reload()} />
        </Panel>
      </>
    )
  }

  const fracoes = all.reduce((s, i) => s + (Number(i.nbLots) || 0), 0)
  const orcamento = all.reduce((s, i) => s + (Number(i.budgetAnnuel) || 0), 0)
  const despesas = all.reduce((s, i) => s + (Number(i.depensesAnnee) || 0), 0)
  const pctGlobal = pctUsado(despesas, orcamento)

  return (
    <>
      <PageHead title="Multi-Imóveis" lede="Gestão consolidada do seu portefólio" />
      <KPIGrid items={[
        { icon: 'building', num: all.length, lbl: 'Edifícios' },
        { icon: 'home', num: fracoes, lbl: 'Frações totais', accent: 'gold' },
        { icon: 'coin', num: orcamento ? fmtEUR(orcamento).replace('€', '').trim() : '—', cur: orcamento ? '€' : undefined, lbl: 'Orçamento total' },
        { icon: 'chart', num: `${pctGlobal}%`, lbl: 'Despesas / orçamento', accent: pctGlobal >= 85 ? 'rust' : 'sage' },
      ]} />
      <Panel title="Portefólio de edifícios" flush>
        {all.length === 0 ? (
          <Empty illustration="documentos" title="Sem edifícios" desc="Adicione edifícios em « Edifícios » para os consolidar aqui." />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Edifício</th><th>Cidade</th><th>Frações</th><th>Orçamento</th><th>Despesas</th><th>Uso</th></tr></thead>
              <tbody>{all.map((i) => {
                const p = pctUsado(Number(i.depensesAnnee) || 0, Number(i.budgetAnnuel) || 0)
                return (
                  <tr key={i.id}>
                    <td><b>{i.nom || '—'}</b></td>
                    <td>{i.ville || '—'}</td>
                    <td className={m.numCell}>{i.nbLots || 0}</td>
                    <td className={m.numCell}>{fmtEUR(Number(i.budgetAnnuel) || 0)}</td>
                    <td className={m.numCell}>{fmtEUR(Number(i.depensesAnnee) || 0)}</td>
                    <td><Pill kind={usoKind(p)} noDot>{p}%</Pill></td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
