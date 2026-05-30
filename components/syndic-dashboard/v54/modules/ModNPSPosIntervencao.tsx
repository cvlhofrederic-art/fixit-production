'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'

/** NPS Pós-Intervenção — port byte-exact du ModNPSPosIntervencao du bundle V5.7. */

export default function ModNPSPosIntervencao() {
  return (
    <>
      <PageHead eyebrow="OPERACIONAL · NPS PÓS-INTERVENÇÃO" title="NPS Pós-Intervenção"
        lede="Auto-envio 48h após fecho ordem serviço · NPS + comentário · Rating Marketplace · Alfredo agrega insights"
        actions={<><Button><Icon name="cog" />Configurar templates</Button><Button variant="gold"><Icon name="chart" />Ver dashboard prestadores</Button></>} />
      <Alert kind="sage" icon="check" title="Loop fechado qualidade prestadores">
        Cada intervenção fechada dispara um inquérito 48h depois. As respostas alimentam o rating no Marketplace e o Alfredo deteta prestadores em descida de satisfação antes que escalone.
      </Alert>
      <KPIGrid items={[
        { icon: 'poll', num: 0, lbl: 'Inquéritos enviados (mês)' },
        { icon: 'mail', num: '0%', lbl: 'Taxa resposta', accent: 'gold' },
        { icon: 'sparkle', num: 0, lbl: 'NPS médio', accent: 'sage' },
        { icon: 'alert', num: 0, lbl: 'Prestadores em descida', accent: 'amber' },
        { icon: 'check', num: 0, lbl: 'Promotores (NPS 9-10)', accent: 'sage' },
        { icon: 'ban', num: 0, lbl: 'Detratores (NPS 0-6)', accent: 'rust' },
      ]} />
      <Tabs defaultActive="resp" tabs={[
        { id: 'resp', icon: 'poll', label: 'Respostas recentes' },
        { id: 'prest', icon: 'wrench', label: 'Por prestador' },
        { id: 'tipo', icon: 'tag', label: 'Por tipo intervenção' },
      ]} />
      <Panel>
        <Empty illustration="mensagens" title="Nenhum inquérito enviado ainda"
          desc="Quando uma ordem de serviço for marcada como Concluída, um inquérito (1 pergunta NPS + 1 comentário) é enviado automaticamente 48 horas depois ao condómino que abriu."
          action={<Button variant="primary"><Icon name="cog" />Configurar inquérito padrão</Button>} />
      </Panel>
    </>
  )
}
