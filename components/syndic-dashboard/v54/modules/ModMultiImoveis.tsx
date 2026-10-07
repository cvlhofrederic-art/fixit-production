'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { KPIGrid } from '../primitives/kpi'
import { Empty } from '../primitives/empty'
import { Pill, type PillKind } from '../primitives/pill'
import { ErrorState } from '../primitives/error-state'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { MULTI_IMOVEIS_MESSAGES } from './i18n/ModMultiImoveis.messages'

/** Multi-Imóveis — port V5.7 + lot 4 fonctionnel.
 * Syndic connecté → portefeuille consolidé à partir de data.immeubles (déjà chargé, aucune
 * table nouvelle) ; anonyme → ErrorState byte-exact (design showcase). */

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
const pctUsado = (dep: number, orc: number) => (orc > 0 ? Math.round((dep / orc) * 100) : 0)
const usoKind = (p: number): PillKind => (p >= 100 ? 'rust' : p >= 85 ? 'amber' : 'sage')

export default function ModMultiImoveis() {
  const t = useMessages(MULTI_IMOVEIS_MESSAGES)
  const locale = useV54Locale()
  const data = useSyndicData()
  const real = data.authenticated
  const all = real ? (data.immeubles ?? []) : []

  if (!real) {
    return (
      <>
        <PageHead title={t.titre} lede={t.chapeau} />
        <Panel>
          <ErrorState title={t.erreur.titre} desc={t.erreur.desc} onRetry={() => window.location.reload()} />
        </Panel>
      </>
    )
  }

  const fracoes = all.reduce((s, i) => s + (Number(i.nbLots) || 0), 0)
  const orcamento = all.reduce((s, i) => s + (Number(i.budgetAnnuel) || 0), 0)
  const despesas = all.reduce((s, i) => s + (Number(i.depensesAnnee) || 0), 0)
  const pctGlobal = pctUsado(despesas, orcamento)
  const c = t.colonnes

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <KPIGrid items={[
        { icon: 'building', num: all.length, lbl: t.kpi.immeubles },
        { icon: 'home', num: fracoes, lbl: t.kpi.lots, accent: 'gold' },
        { icon: 'coin', num: orcamento ? fmtEUR(orcamento, locale).replace('€', '').trim() : '—', cur: orcamento ? '€' : undefined, lbl: t.kpi.budget },
        { icon: 'chart', num: t.pct(pctGlobal), lbl: t.kpi.depensesBudget, accent: pctGlobal >= 85 ? 'rust' : 'sage' },
      ]} />
      <Panel title={t.portefeuille} flush>
        {all.length === 0 ? (
          <Empty illustration="documentos" title={t.vide.titre} desc={t.vide.desc} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{c.immeuble}</th><th>{c.ville}</th><th>{c.lots}</th><th>{c.budget}</th><th>{c.depenses}</th><th>{c.utilisation}</th></tr></thead>
              <tbody>{all.map((i) => {
                const p = pctUsado(Number(i.depensesAnnee) || 0, Number(i.budgetAnnuel) || 0)
                return (
                  <tr key={i.id}>
                    <td><b>{i.nom || '—'}</b></td>
                    <td>{i.ville || '—'}</td>
                    <td className={m.numCell}>{i.nbLots || 0}</td>
                    <td className={m.numCell}>{fmtEUR(Number(i.budgetAnnuel) || 0, locale)}</td>
                    <td className={m.numCell}>{fmtEUR(Number(i.depensesAnnee) || 0, locale)}</td>
                    <td><Pill kind={usoKind(p)} noDot>{p}{t.pourcent}</Pill></td>
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
