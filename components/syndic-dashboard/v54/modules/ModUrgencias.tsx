import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import { Button } from '../primitives/button'
import { Alert } from '../primitives/alert'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Urgências Técnicas — page net-new (module catalogue-only en V5.7, aucune source byte-exact).
 * Composée uniquement de primitives v54. Despacho imediato para o profissional VITFIX disponível. */

type Urgencia = { tipo: string; edificio: string; prioridade: string; kind: PillKind; profissional: string; estado: string; estadoKind: PillKind; tempo: string }

const URGENCIAS: Urgencia[] = [
  { tipo: 'Fuga de água na garagem B2', edificio: 'Edifício Aurora', prioridade: 'Crítica', kind: 'rust', profissional: 'HidroPro Lda', estado: 'Despachada', estadoKind: 'sage', tempo: '6 min' },
  { tipo: 'Elevador bloqueado no 4.º', edificio: 'Edifício Bela Vista', prioridade: 'Alta', kind: 'amber', profissional: 'ElevaTech', estado: 'Em despacho', estadoKind: 'amber', tempo: '11 min' },
  { tipo: 'Curto-circuito no hall', edificio: 'Residencial Cedofeita', prioridade: 'Alta', kind: 'amber', profissional: '—', estado: 'À procura', estadoKind: 'rust', tempo: '2 min' },
  { tipo: 'Infiltração no teto do R/C', edificio: 'Condomínio Boavista Center', prioridade: 'Média', kind: 'gold', profissional: 'ConstruFix', estado: 'Despachada', estadoKind: 'sage', tempo: '18 min' },
]

export default function ModUrgencias() {
  return (
    <>
      <PageHead title="Urgências Técnicas" lede="Despacho imediato para o profissional VITFIX disponível"
        actions={<Button variant="gold"><Icon name="plus" />Nova urgência</Button>} />
      <Tabs defaultActive="ativas" tabs={[
        { id: 'ativas', icon: 'siren', label: 'Ativas' },
        { id: 'despacho', icon: 'sat', label: 'Despacho' },
        { id: 'profissionais', icon: 'wrench', label: 'Profissionais' },
        { id: 'hist', icon: 'clock', label: 'Histórico' },
      ]} />
      <Alert kind="rust" icon="siren" title="Despacho automático ativo">
        As urgências críticas são despachadas automaticamente para o profissional VITFIX disponível mais próximo, com confirmação em tempo real.
      </Alert>
      <KPIGrid items={[
        { icon: 'siren', num: 4, lbl: 'Urgências ativas', accent: 'rust' },
        { icon: 'sat', num: 2, lbl: 'Em despacho', accent: 'amber' },
        { icon: 'wrench', num: 9, lbl: 'Profissionais disponíveis', accent: 'sage' },
        { icon: 'clock', num: '9 min', lbl: 'Tempo médio de resposta' },
      ]} />
      <Panel title="Urgências ativas" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Tipo</th><th>Edifício</th><th>Prioridade</th><th>Profissional</th><th>Estado</th><th>Tempo</th></tr></thead>
            <tbody>
              {URGENCIAS.map((u, i) => (
                <tr key={i}>
                  <td><b>{u.tipo}</b></td>
                  <td>{u.edificio}</td>
                  <td><Pill kind={u.kind} noDot>{u.prioridade}</Pill></td>
                  <td>{u.profissional}</td>
                  <td><Pill kind={u.estadoKind} noDot>{u.estado}</Pill></td>
                  <td className={m.numCell}>{u.tempo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
