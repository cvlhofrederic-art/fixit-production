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

/** Centro de Notificações Judiciais — port byte-exact du ModNotificJud du bundle V5.7. */

type Cor = 'sage' | 'gold' | 'amber' | 'rust'
const TIPOS: [string, string, Cor][] = [
  ['Citação tribunal', 'Email a todos os condóminos · cópia notificação · prazo defesa', 'rust'],
  ['Notificação injunção', 'Email + carta registada · explicação simples · próximos passos', 'amber'],
  ['Sentença favorável', 'Email all · resumo + acta arquivo', 'sage'],
  ['Sentença contrária', 'Email all · análise impactos + plano resposta', 'rust'],
  ['Procedimento contraord.', 'Email all · descrição + defesa em curso', 'amber'],
  ['Update semestral', 'Auto-gerado · sumário evolução todos processos', 'gold'],
]

export default function ModNotificJud() {
  return (
    <>
      <PageHead eyebrow="OBRIGAÇÃO LEGAL · CC ART. 1436.° o) e p)" title="Centro de Notificações Judiciais"
        lede="Citações · Notificações · Sentenças · Relatório semestral automático · Léa OCR + Fixy redação"
        actions={<><Button><Icon name="upload" />Upload notificação</Button><Button variant="gold"><Icon name="doc" />Gerar relatório semestral</Button></>} />
      <Alert kind="gold" icon="scale" title="Obrigação dupla — Lei 8/2022">
        <strong>Alínea o)</strong> — Informar condóminos sempre que o condomínio é citado/notificado (processo judicial, arbitral, injunção, contraordenacional ou administrativo).<br />
        <strong>Alínea p)</strong> — Informar <strong>pelo menos semestralmente</strong> sobre o desenvolvimento dos processos em curso.
      </Alert>
      <KPIGrid items={[
        { icon: 'scale', num: 0, lbl: 'Processos ativos' },
        { icon: 'bell', num: 0, lbl: 'Notificações por classificar', accent: 'amber' },
        { icon: 'check', num: 0, lbl: 'Condóminos informados (30d)', accent: 'sage' },
        { icon: 'clock', num: 'em 47 dias', lbl: 'Próximo relatório semestral', accent: 'gold' },
        { icon: 'bot', num: 'Léa', lbl: 'OCR + classificação' },
        { icon: 'mail', num: 0, lbl: 'Emails enviados (mês)', accent: 'sage' },
      ]} />
      <Tabs defaultActive="proc" tabs={[
        { id: 'proc', icon: 'scale', label: 'Processos (0)' },
        { id: 'in', icon: 'upload', label: 'Inbox notificações (0)' },
        { id: 'com', icon: 'mail', label: 'Comunicações enviadas (0)' },
        { id: 'rel', icon: 'doc', label: 'Relatórios semestrais' },
      ]} />
      <Panel>
        <Empty illustration="documentos" title="Nenhum processo judicial em curso"
          desc="Quando uma notificação chegar, faça upload. Léa classifica (citação · notificação · sentença), extrai partes + prazos, Fixy redige a comunicação aos condóminos afetados."
          action={<Button variant="primary"><Icon name="upload" />+ Primeira notificação</Button>} />
      </Panel>
      <Panel title="Tipos de comunicação automática">
        <div className={m.cardGrid}>
          {TIPOS.map(([t, s, c], i) => (
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
