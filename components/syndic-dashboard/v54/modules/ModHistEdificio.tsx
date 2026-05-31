import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import m from './modules.module.css'

/** Histórico Edifício — page net-new (module catalogue-only en V5.7, aucune source byte-exact).
 * Composée uniquement de primitives v54. Vista consolidada por edifício : intervenções,
 * equipamentos, contratos. */

const INTERVENCOES: Array<[string, string, string, string]> = [
  ['12/05/2026', 'Reparação canalização garagem', 'HidroPro Lda', '€ 480'],
  ['28/04/2026', 'Manutenção elevador anual', 'ElevaTech', '€ 1 250'],
  ['15/03/2026', 'Pintura do hall de entrada', 'ConstruFix', '€ 2 100'],
  ['02/02/2026', 'Substituição bomba de água', 'HidroPro Lda', '€ 890'],
]
const EQUIPAMENTOS: Array<[string, string, string, string, PillKind]> = [
  ['Elevador OTIS A', 'Última inspeção 28/04/2026', 'Conforme', 'Próxima: 04/2028', 'sage'],
  ['Central AVAC', 'Última inspeção 10/01/2026', 'Conforme', 'Próxima: 01/2027', 'sage'],
  ['Bomba de pressurização', 'Substituída 02/02/2026', 'Operacional', '—', 'sage'],
  ['Portão automático', 'Manutenção pendente', 'A agendar', 'Atraso 12 dias', 'amber'],
]
const CONTRATOS: Array<[string, string, string, string, PillKind]> = [
  ['Manutenção de elevadores', 'ElevaTech', '€ 1 250 / ano', 'Ativo até 12/2027', 'sage'],
  ['Limpeza de áreas comuns', 'CleanPro', '€ 380 / mês', 'Renovação 06/2026', 'amber'],
  ['Seguro multirriscos', 'Fidelidade', '€ 2 400 / ano', 'Ativo até 03/2027', 'sage'],
]

export default function ModHistEdificio() {
  return (
    <>
      <PageHead title="Histórico Edifício" lede="Vista consolidada por edifício — intervenções, equipamentos, contratos" />
      <Tabs defaultActive="aurora" tabs={[
        { id: 'aurora', icon: 'building', label: 'Edifício Aurora' },
        { id: 'belavista', icon: 'building', label: 'Edifício Bela Vista' },
        { id: 'cedofeita', icon: 'building', label: 'Residencial Cedofeita' },
      ]} />
      <KPIGrid items={[
        { icon: 'wrench', num: 28, lbl: 'Intervenções totais' },
        { icon: 'monitor', num: 6, lbl: 'Equipamentos', accent: 'gold' },
        { icon: 'handshake', num: 3, lbl: 'Contratos ativos', accent: 'sage' },
        { icon: 'coin', num: '€ 18 240', lbl: 'Custo acumulado 2026' },
      ]} />
      <Panel title="Intervenções recentes" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Data</th><th>Intervenção</th><th>Profissional</th><th>Custo</th><th>Estado</th></tr></thead>
            <tbody>{INTERVENCOES.map((r, i) => (
              <tr key={i}><td className={m.numCell}>{r[0]}</td><td><b>{r[1]}</b></td><td>{r[2]}</td><td className={m.numCell}>{r[3]}</td><td><Pill kind="sage" noDot>Concluída</Pill></td></tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Equipamentos" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Equipamento</th><th>Estado técnico</th><th>Conformidade</th><th>Próxima ação</th></tr></thead>
            <tbody>{EQUIPAMENTOS.map((r, i) => (
              <tr key={i}><td><b>{r[0]}</b></td><td>{r[1]}</td><td><Pill kind={r[4]} noDot>{r[2]}</Pill></td><td>{r[3]}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Contratos" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Contrato</th><th>Prestador</th><th>Valor</th><th>Vigência</th></tr></thead>
            <tbody>{CONTRATOS.map((r, i) => (
              <tr key={i}><td><b>{r[0]}</b></td><td>{r[1]}</td><td className={m.numCell}>{r[2]}</td><td><Pill kind={r[4]} noDot>{r[3]}</Pill></td></tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
