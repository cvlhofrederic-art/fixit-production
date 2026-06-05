'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'

/** Contacto Proativo IA — port byte-exact du ModContacto du bundle V5.7. */

export default function ModContacto() {
  return (
    <>
      <PageHead
        title="Contacto Proativo IA"
        lede="Comunicação automática e personalizada com condóminos — cobranças, avisos, relatórios"
        actions={<Button variant="gold"><Icon name="plus" />+ Nova Campanha</Button>}
      />
      <KPIGrid items={[
        { icon: 'sat', num: 0, lbl: 'Campanhas Criadas' },
        { icon: 'mail', num: 0, lbl: 'Enviadas', accent: 'sage' },
        { icon: 'users', num: 0, lbl: 'Total Destinatários', accent: 'gold' },
        { icon: 'chat', num: 0, lbl: 'Mensagens Enviadas', accent: 'amber' },
      ]} />
      <Tabs defaultActive="camp" tabs={[
        { id: 'camp', icon: 'mail', label: 'Campanhas' },
        { id: 'mod', icon: 'pencil', label: 'Modelos IA' },
        { id: 'hist', icon: 'chart', label: 'Histórico' },
        { id: 'cfg', icon: 'cog', label: 'Configuração' },
      ]} />
      <Panel>
        <Empty illustration="mensagens" title="Sem campanhas" desc="Crie a sua primeira campanha proativa para contactar condóminos automaticamente" />
      </Panel>
    </>
  )
}
