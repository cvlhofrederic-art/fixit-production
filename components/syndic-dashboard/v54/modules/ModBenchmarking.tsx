'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import { Progress } from '../primitives/progress'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import type { Immeuble } from '@/components/syndic-dashboard/types'
import { healthScore } from '@/lib/syndic/v54/building-score'
import { downloadCsv } from '@/lib/syndic/v54/export-csv'
import { BENCHMARKING_MESSAGES } from './i18n/ModBenchmarking.messages'

/** Benchmarking Imóveis — port V5.7 + lot 5 fonctionnel.
 * Syndic connecté → ranking dérivé des édifices réels (data.immeubles, aucune table
 * nouvelle) ; anonyme → preview byte-exact. Score de saúde = heurística transparente :
 * 100 − pressão orçamental (despesas/orçamento > 80%) − intervenções. */

const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(Math.round(n))

const custoFracao = (i: Immeuble) => (i.nbLots > 0 ? (i.depensesAnnee || 0) / i.nbLots : 0)
function progressKind(score: number): 'sage' | 'amber' | 'rust' | undefined {
  if (score >= 85) return 'sage'
  if (score >= 65) return undefined
  if (score >= 50) return 'amber'
  return 'rust'
}
const pillKind = (score: number): PillKind => (score >= 85 ? 'sage' : score >= 65 ? 'gold' : score >= 50 ? 'amber' : 'rust')

export default function ModBenchmarking() {
  const t = useMessages(BENCHMARKING_MESSAGES)
  const locale = useV54Locale()
  const data = useSyndicData()
  const real = data.authenticated
  const all: Immeuble[] = real ? (data.immeubles ?? []) : t.demo
  const { push } = useToast()

  const ranked = all
    .map(im => ({ im, score: healthScore(im), custo: custoFracao(im) }))
    .sort((a, b) => b.score - a.score)
    .map((r, idx) => ({ ...r, pos: idx + 1 }))

  const melhor = ranked[0]?.im.nom || '—'
  const percentilMedio = ranked.length ? Math.round(ranked.reduce((s, r) => s + r.score, 0) / ranked.length) : 0
  const outliers = ranked.filter(r => r.score < 60).length
  const exportBenchmarking = () => {
    if (!real || ranked.length === 0) {
      push({ kind: 'info', title: t.toasts.titre, desc: real ? t.toasts.ajouterImmeubles : t.toasts.connexionRequise })
      return
    }
    downloadCsv(
      t.csv.fichier,
      t.csv.entetes,
      ranked.map((r) => [r.pos, r.im.nom, r.score, Math.round(r.custo)]),
    )
  }

  const c = t.colonnes
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau}
        actions={<Button variant="gold" onClick={exportBenchmarking}><Icon name="download" />{t.exporter}</Button>} />
      <Tabs defaultActive="ranking" tabs={[
        { id: 'ranking', icon: 'chart', label: t.onglets.ranking },
        { id: 'kpis', icon: 'target', label: t.onglets.kpis },
        { id: 'outliers', icon: 'alert', label: t.onglets.outliers },
        { id: 'export', icon: 'download', label: t.onglets.export },
      ]} />
      <KPIGrid items={[
        { icon: 'building', num: ranked.length, lbl: t.kpi.compares },
        { icon: 'crown', num: melhor, lbl: t.kpi.meilleur, accent: 'gold' },
        { icon: 'target', num: `P${percentilMedio}`, lbl: t.kpi.percentileMoyen, accent: 'sage' },
        { icon: 'alert', num: outliers, lbl: t.kpi.outliers, accent: outliers ? 'rust' : undefined },
      ]} />
      <Panel title={t.panneau} flush>
        {real && ranked.length === 0 ? (
          <Empty illustration="documentos" title={t.vide.titre} desc={t.vide.desc} />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>#</th><th>{c.immeuble}</th><th>{c.score}</th><th>{c.coutLot}</th><th>{c.interventions}</th><th>{c.percentile}</th></tr></thead>
              <tbody>{ranked.map((r) => (
                <tr key={r.im.id}>
                  <td className={m.numCell}>{r.pos}</td>
                  <td><b>{r.im.nom}</b></td>
                  <td style={{ minWidth: 160 }}><Progress pct={r.score} kind={progressKind(r.score)} /></td>
                  <td className={m.numCell}>{fmtEUR(r.custo, locale)}</td>
                  <td className={m.numCell}>{r.im.nbInterventions || 0}</td>
                  <td><Pill kind={pillKind(r.score)} noDot>P{r.score}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
