import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import { Button } from '../primitives/button'
import { Alert } from '../primitives/alert'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Acompanhamento de Infrações — page net-new (module catalogue-only en V5.7, aucune source
 * byte-exact). Composée uniquement de primitives v54. Infrações ao regulamento ·
 * Pipeline sinalização → multa · Provas · Histórico · Modelos de carta. */

type Infracao = { tipo: string; condomino: string; edificio: string; etapa: string; kind: PillKind; multa: string }

const INFRACOES: Infracao[] = [
  { tipo: 'Ruído fora de horas', condomino: 'Carlos Mendes — Fração 4B', edificio: 'Edifício Aurora', etapa: 'Notificação enviada', kind: 'amber', multa: '€ 75' },
  { tipo: 'Estacionamento indevido', condomino: 'Ana Silva — Fração 2A', edificio: 'Edifício Bela Vista', etapa: 'Sinalizada', kind: 'gold', multa: '—' },
  { tipo: 'Lixo fora do contentor', condomino: 'Pedro Costa — Fração 1C', edificio: 'Residencial Cedofeita', etapa: 'Multa aplicada', kind: 'rust', multa: '€ 50' },
  { tipo: 'Obras sem autorização', condomino: 'Rita Oliveira — Fração 5A', edificio: 'Condomínio Boavista Center', etapa: 'Resolvida', kind: 'sage', multa: '€ 150' },
]
const PIPELINE: Array<[string, number, PillKind]> = [
  ['Sinalização', 3, 'gold'],
  ['Análise & provas', 2, 'amber'],
  ['Notificação', 4, 'amber'],
  ['Multa aplicada', 2, 'rust'],
  ['Resolvida', 8, 'sage'],
]
const MODELOS = ['Notificação de infração', 'Advertência formal', 'Aplicação de multa', 'Resolução amigável']

export default function ModInfracoes() {
  return (
    <>
      <PageHead title="Acompanhamento de Infrações" lede="Infrações ao regulamento · Pipeline sinalização → multa · Provas · Histórico · Modelos de carta"
        actions={<Button variant="gold"><Icon name="plus" />Nova infração</Button>} />
      <Tabs defaultActive="pipeline" tabs={[
        { id: 'pipeline', icon: 'chart', label: 'Pipeline' },
        { id: 'infracoes', icon: 'alert', label: 'Infrações' },
        { id: 'modelos', icon: 'doc', label: 'Modelos de carta' },
        { id: 'hist', icon: 'clock', label: 'Histórico' },
      ]} />
      <Alert kind="gold" icon="scale" title="Procedimento conforme o regulamento do condomínio">
        Cada infração segue o pipeline sinalização → análise → notificação → multa, com registo de provas e modelos de carta gerados automaticamente.
      </Alert>
      <KPIGrid items={[
        { icon: 'alert', num: 9, lbl: 'Infrações abertas', accent: 'rust' },
        { icon: 'clock', num: 4, lbl: 'Em processo', accent: 'amber' },
        { icon: 'coin', num: '€ 275', lbl: 'Multas aplicadas' },
        { icon: 'check', num: 8, lbl: 'Resolvidas', accent: 'sage' },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
        <Panel title="Pipeline por etapa">
          {PIPELINE.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < PIPELINE.length - 1 ? '1px solid var(--v54-line)' : 'none' }}>
              <span>{p[0]}</span><Pill kind={p[2]} noDot>{p[1]}</Pill>
            </div>
          ))}
        </Panel>
        <Panel title="Modelos de carta">
          {MODELOS.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < MODELOS.length - 1 ? '1px solid var(--v54-line)' : 'none' }}>
              <Icon name="doc" /><span>{t}</span>
            </div>
          ))}
        </Panel>
      </div>
      <Panel title="Infrações em curso" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Tipo</th><th>Condómino</th><th>Edifício</th><th>Etapa</th><th>Multa</th></tr></thead>
            <tbody>{INFRACOES.map((f, i) => (
              <tr key={i}><td><b>{f.tipo}</b></td><td>{f.condomino}</td><td>{f.edificio}</td><td><Pill kind={f.kind} noDot>{f.etapa}</Pill></td><td className={m.numCell}>{f.multa}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
