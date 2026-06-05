import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import { Alert } from '../primitives/alert'
import m from './modules.module.css'

/** Chatbot WhatsApp 24/7 — page net-new (module catalogue-only en V5.7, aucune source byte-exact).
 * Composée uniquement de primitives v54. Chatbot IA autónomo · Resposta automática ·
 * Classificação de pedidos · Criação de ocorrências. */

type Conversa = { condomino: string; fracao: string; ultima: string; classificacao: string; kind: PillKind; estado: string; estadoKind: PillKind }

const CONVERSAS: Conversa[] = [
  { condomino: 'Ana Silva', fracao: 'Fração 2B', ultima: 'A torneira da cozinha está a pingar…', classificacao: 'Ocorrência', kind: 'rust', estado: 'Ocorrência criada', estadoKind: 'sage' },
  { condomino: 'Carlos Mendes', fracao: 'Fração 4A', ultima: 'Quando é a próxima assembleia?', classificacao: 'Informação', kind: 'sage', estado: 'Respondido auto', estadoKind: 'sage' },
  { condomino: 'Rita Oliveira', fracao: 'Fração 1C', ultima: 'Quero reservar o salão de festas', classificacao: 'Reserva', kind: 'gold', estado: 'Encaminhado', estadoKind: 'amber' },
  { condomino: 'Pedro Costa', fracao: 'Fração 5A', ultima: 'Qual o valor da minha quota?', classificacao: 'Quotas', kind: 'amber', estado: 'Respondido auto', estadoKind: 'sage' },
]
const CONFIG: Array<[string, string, PillKind]> = [
  ['Resposta automática 24/7', 'Ativo', 'sage'],
  ['Classificação de pedidos por IA', 'Ativo', 'sage'],
  ['Criação automática de ocorrências', 'Ativo', 'sage'],
  ['Encaminhamento para gestor humano', 'Após 3 tentativas', 'gold'],
]

export default function ModChatbot() {
  return (
    <>
      <PageHead title="Chatbot WhatsApp 24/7" lede="Chatbot IA autónomo · Resposta automática · Classificação de pedidos · Criação de ocorrências" />
      <Tabs defaultActive="conversas" tabs={[
        { id: 'conversas', icon: 'chat', label: 'Conversas' },
        { id: 'config', icon: 'cog', label: 'Configuração' },
        { id: 'respostas', icon: 'bot', label: 'Respostas automáticas' },
        { id: 'stats', icon: 'chart', label: 'Estatísticas' },
      ]} />
      <Alert kind="sage" icon="bot" title="Chatbot ativo 24/7">
        O assistente responde automaticamente, classifica os pedidos e cria ocorrências sem intervenção humana. Os casos complexos são encaminhados para o gestor.
      </Alert>
      <KPIGrid items={[
        { icon: 'chat', num: 47, lbl: 'Conversas hoje' },
        { icon: 'bot', num: 38, lbl: 'Resolvidas automaticamente', accent: 'sage' },
        { icon: 'wrench', num: 5, lbl: 'Ocorrências criadas', accent: 'gold' },
        { icon: 'check', num: '81%', lbl: 'Taxa de resolução auto' },
      ]} />
      <Panel title="Conversas recentes" flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>Condómino</th><th>Última mensagem</th><th>Classificação</th><th>Estado</th></tr></thead>
            <tbody>{CONVERSAS.map((c, i) => (
              <tr key={i}>
                <td><b>{c.condomino}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{c.fracao}</div></td>
                <td>{c.ultima}</td>
                <td><Pill kind={c.kind} noDot>{c.classificacao}</Pill></td>
                <td><Pill kind={c.estadoKind} noDot>{c.estado}</Pill></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Configuração do chatbot">
        {CONFIG.map((c, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < CONFIG.length - 1 ? '1px solid var(--v54-line)' : 'none' }}>
            <span>{c[0]}</span><Pill kind={c[2]} noDot>{c[1]}</Pill>
          </div>
        ))}
      </Panel>
    </>
  )
}
