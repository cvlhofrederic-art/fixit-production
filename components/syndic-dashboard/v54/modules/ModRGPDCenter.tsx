'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** RGPD Compliance Center — port byte-exact du ModRGPDCenter du bundle V5.7. */

type Cor = 'sage' | 'gold' | 'amber' | 'rust'
const DIREITOS: [string, string, Cor][] = [
  ['Direito de acesso', 'Art. 15.° · cópia dos dados pessoais', 'sage'],
  ['Direito de retificação', 'Art. 16.° · correção dados imprecisos', 'sage'],
  ['Direito de oposição', 'Art. 21.° · cessar tratamento específico', 'amber'],
  ['Direito de esquecimento', 'Art. 17.° · eliminar dados', 'rust'],
  ['Direito de portabilidade', 'Art. 20.° · export formato estruturado', 'sage'],
  ['Direito de limitação', 'Art. 18.° · suspender tratamento', 'amber'],
]

export default function ModRGPDCenter() {
  return (
    <>
      <PageHead eyebrow="OBRIGAÇÃO LEGAL · REGULAMENTO (UE) 2016/679 + EAA 2025" title="RGPD Compliance Center"
        lede="Registo tratamentos · Direitos titulares · Resposta em 30 dias · Logs imutáveis · Fixy classifica + redige"
        actions={<><Button><Icon name="upload" />Nova solicitação titular</Button><Button variant="gold"><Icon name="doc" />Exportar registo tratamentos</Button></>} />
      <Alert kind="gold" icon="scale" title="Obrigações RGPD para administradores de condomínio">
        Manter <strong>registo de atividades de tratamento</strong> (art. 30.°). Responder a pedidos de exercício de direitos (acesso, retificação, oposição, esquecimento, portabilidade) em <strong>30 dias</strong>. Notificar CNPD violações em <strong>72h</strong>.
      </Alert>
      <KPIGrid items={[
        { icon: 'doc', num: 0, lbl: 'Tratamentos registados', accent: 'gold' },
        { icon: 'bell', num: 0, lbl: 'Solicitações ativas', accent: 'amber' },
        { icon: 'check', num: 0, lbl: 'Respondidas em prazo', accent: 'sage' },
        { icon: 'alert', num: 0, lbl: 'A < 5 dias do prazo', accent: 'rust' },
        { icon: 'ban', num: 0, lbl: 'Violações declaradas', accent: 'rust' },
        { icon: 'bot', num: 'Fixy', lbl: 'Classificação + draft' },
      ]} />
      <Tabs defaultActive="sol" tabs={[
        { id: 'sol', icon: 'bell', label: 'Solicitações (0)' },
        { id: 'trat', icon: 'doc', label: 'Registo Tratamentos' },
        { id: 'log', icon: 'archive', label: 'Logs eliminação/exportação' },
        { id: 'pol', icon: 'shield', label: 'Políticas privacidade' },
        { id: 'viol', icon: 'alert', label: 'Violações' },
      ]} />
      <Panel>
        <Empty illustration="documentos" title="Nenhuma solicitação ativa"
          desc="Quando um condómino exerce um direito RGPD, Fixy classifica em 5 segundos (acesso · retificação · oposição · esquecimento · portabilidade) e prepara o draft de resposta com a data coletada."
          action={<Button variant="primary"><Icon name="bell" />Simular solicitação</Button>} />
      </Panel>
      <Panel title="Direitos RGPD do titular — 30 dias resposta">
        <div className={m.cardGrid3}>
          {DIREITOS.map(([t, s, c], i) => (
            <div key={i} style={{ padding: 14, border: '1px solid var(--v54-line)', borderRadius: 10, background: `var(--v54-${c}-50)`, borderLeft: `3px solid var(--v54-${c}-500)` }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{s}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
