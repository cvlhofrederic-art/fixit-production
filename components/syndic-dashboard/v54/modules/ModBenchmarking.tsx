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
import type { Immeuble } from '@/components/syndic-dashboard/types'
import { healthScore } from '@/lib/syndic/v54/building-score'
import { downloadCsv } from '@/lib/syndic/v54/export-csv'

/** Benchmarking Imóveis — port V5.7 + lot 5 fonctionnel.
 * Syndic connecté → ranking dérivé des édifices réels (data.immeubles, aucune table
 * nouvelle) ; anonyme → preview byte-exact. Score de saúde = heurística transparente :
 * 100 − pressão orçamental (despesas/orçamento > 80%) − intervenções. */

const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Math.round(n))

const custoFracao = (i: Immeuble) => (i.nbLots > 0 ? (i.depensesAnnee || 0) / i.nbLots : 0)
function progressKind(score: number): 'sage' | 'amber' | 'rust' | undefined {
  if (score >= 85) return 'sage'
  if (score >= 65) return undefined
  if (score >= 50) return 'amber'
  return 'rust'
}
const pillKind = (score: number): PillKind => (score >= 85 ? 'sage' : score >= 65 ? 'gold' : score >= 50 ? 'amber' : 'rust')

const PREVIEW: Immeuble[] = [
  { id: 'b1', nom: 'Edifício Aurora', adresse: '', ville: 'Porto', codePostal: '', nbLots: 20, anneeConstruction: 2015, typeImmeuble: '', gestionnaire: '', nbInterventions: 2, budgetAnnuel: 50000, depensesAnnee: 30000 },
  { id: 'b2', nom: 'Residencial Cedofeita', adresse: '', ville: 'Porto', codePostal: '', nbLots: 18, anneeConstruction: 2008, typeImmeuble: '', gestionnaire: '', nbInterventions: 3, budgetAnnuel: 45000, depensesAnnee: 31500 },
  { id: 'b3', nom: 'Condomínio Boavista Center', adresse: '', ville: 'Porto', codePostal: '', nbLots: 16, anneeConstruction: 2000, typeImmeuble: '', gestionnaire: '', nbInterventions: 5, budgetAnnuel: 40000, depensesAnnee: 34000 },
  { id: 'b4', nom: 'Edifício Bela Vista', adresse: '', ville: 'Porto', codePostal: '', nbLots: 12, anneeConstruction: 1992, typeImmeuble: '', gestionnaire: '', nbInterventions: 8, budgetAnnuel: 30000, depensesAnnee: 28500 },
]

export default function ModBenchmarking() {
  const data = useSyndicData()
  const real = data.authenticated
  const all: Immeuble[] = real ? (data.immeubles ?? []) : PREVIEW
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
      push({ kind: 'info', title: 'Exportar benchmarking', desc: real ? 'Adicione edifícios para exportar.' : 'Conecte-se como síndico para exportar.' })
      return
    }
    downloadCsv(
      'benchmarking-edificios.csv',
      ['Posição', 'Edifício', 'Score saúde', 'Custo / fração (€)'],
      ranked.map((r) => [r.pos, r.im.nom, r.score, Math.round(r.custo)]),
    )
  }

  return (
    <>
      <PageHead title="Benchmarking Imóveis" lede="Comparação de KPIs entre edifícios · Rankings · Percentis · Alertas de outliers · Exportação"
        actions={<Button variant="gold" onClick={exportBenchmarking}><Icon name="download" />Exportar</Button>} />
      <Tabs defaultActive="ranking" tabs={[
        { id: 'ranking', icon: 'chart', label: 'Ranking' },
        { id: 'kpis', icon: 'target', label: 'KPIs' },
        { id: 'outliers', icon: 'alert', label: 'Outliers' },
        { id: 'export', icon: 'download', label: 'Exportação' },
      ]} />
      <KPIGrid items={[
        { icon: 'building', num: ranked.length, lbl: 'Edifícios comparados' },
        { icon: 'crown', num: melhor, lbl: 'Melhor performance', accent: 'gold' },
        { icon: 'target', num: `P${percentilMedio}`, lbl: 'Percentil médio', accent: 'sage' },
        { icon: 'alert', num: outliers, lbl: 'Outliers detetados', accent: outliers ? 'rust' : undefined },
      ]} />
      <Panel title="Ranking de edifícios" flush>
        {real && ranked.length === 0 ? (
          <Empty illustration="documentos" title="Sem edifícios para comparar" desc="Adicione edifícios em « Edifícios » para gerar o benchmarking." />
        ) : (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>#</th><th>Edifício</th><th>Score de saúde</th><th>Custo/fração</th><th>Intervenções</th><th>Percentil</th></tr></thead>
              <tbody>{ranked.map((r) => (
                <tr key={r.im.id}>
                  <td className={m.numCell}>{r.pos}</td>
                  <td><b>{r.im.nom}</b></td>
                  <td style={{ minWidth: 160 }}><Progress pct={r.score} kind={progressKind(r.score)} /></td>
                  <td className={m.numCell}>{fmtEUR(r.custo)}</td>
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
