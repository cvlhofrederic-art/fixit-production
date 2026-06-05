import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import { Progress } from '../primitives/progress'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Benchmarking Imóveis — page net-new (module catalogue-only en V5.7, aucune source byte-exact).
 * Composée uniquement de primitives v54. Comparação de KPIs entre edifícios · Rankings ·
 * Percentis · Alertas de outliers · Exportação. */

type Rank = { pos: number; edificio: string; score: number; custoFracao: string; cobranca: string; percentil: string; kind: PillKind }

const RANKING: Rank[] = [
  { pos: 1, edificio: 'Edifício Aurora', score: 92, custoFracao: '€ 38', cobranca: '98%', percentil: 'P95', kind: 'sage' },
  { pos: 2, edificio: 'Residencial Cedofeita', score: 87, custoFracao: '€ 42', cobranca: '95%', percentil: 'P88', kind: 'sage' },
  { pos: 3, edificio: 'Condomínio Boavista Center', score: 74, custoFracao: '€ 51', cobranca: '89%', percentil: 'P64', kind: 'gold' },
  { pos: 4, edificio: 'Edifício Bela Vista', score: 58, custoFracao: '€ 67', cobranca: '76%', percentil: 'P31', kind: 'amber' },
]

/** Progress kind dérivé du score (gold = défaut, omis). */
function progressKind(score: number): 'sage' | 'amber' | 'rust' | undefined {
  if (score >= 85) return 'sage'
  if (score >= 65) return undefined
  if (score >= 50) return 'amber'
  return 'rust'
}

export default function ModBenchmarking() {
  return (
    <>
      <PageHead title="Benchmarking Imóveis" lede="Comparação de KPIs entre edifícios · Rankings · Percentis · Alertas de outliers · Exportação"
        actions={<Button variant="gold"><Icon name="download" />Exportar</Button>} />
      <Tabs defaultActive="ranking" tabs={[
        { id: 'ranking', icon: 'chart', label: 'Ranking' },
        { id: 'kpis', icon: 'target', label: 'KPIs' },
        { id: 'outliers', icon: 'alert', label: 'Outliers' },
        { id: 'export', icon: 'download', label: 'Exportação' },
      ]} />
      <KPIGrid items={[
        { icon: 'building', num: 4, lbl: 'Edifícios comparados' },
        { icon: 'crown', num: 'Aurora', lbl: 'Melhor performance', accent: 'gold' },
        { icon: 'target', num: 'P69', lbl: 'Percentil médio', accent: 'sage' },
        { icon: 'alert', num: 1, lbl: 'Outliers detetados', accent: 'rust' },
      ]} />
      <Panel title="Ranking de edifícios" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>#</th><th>Edifício</th><th>Score de saúde</th><th>Custo/fração</th><th>Taxa cobrança</th><th>Percentil</th></tr></thead>
            <tbody>{RANKING.map((r) => (
              <tr key={r.pos}>
                <td className={m.numCell}>{r.pos}</td>
                <td><b>{r.edificio}</b></td>
                <td style={{ minWidth: 160 }}><Progress pct={r.score} kind={progressKind(r.score)} /></td>
                <td className={m.numCell}>{r.custoFracao}</td>
                <td className={m.numCell}>{r.cobranca}</td>
                <td><Pill kind={r.kind} noDot>{r.percentil}</Pill></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
