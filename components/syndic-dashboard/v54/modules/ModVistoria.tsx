'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'

/** Vistoria Técnica — port byte-exact du ModVistoria du bundle V5.7. */

export default function ModVistoria() {
  return (
    <>
      <PageHead
        title="Vistoria Técnica"
        lede="Checklist de terreno → Relatório PDF · DL 555/99 · DL 97/2017 · DL 320/2002"
        actions={<Button variant="gold"><Icon name="plus" />+ Nova vistoria</Button>}
      />
      <KPIGrid items={[
        { icon: 'check', num: 0, lbl: 'Vistorias realizadas', accent: 'sage' },
        { icon: 'alert', num: 0, lbl: 'Pontos a vigiar', accent: 'amber' },
        { icon: 'alert', num: 0, lbl: 'Pontos deficientes', accent: 'rust' },
      ]} />
      <Tabs defaultActive="todas" tabs={[
        { id: 'todas', label: 'Todas' },
        { id: 'conc', label: 'Concluídas' },
        { id: 'curso', label: 'Em curso' },
        { id: 'env', label: 'Enviadas' },
      ]} />
      <Panel>
        <Empty
          illustration="documentos"
          title="Nenhuma vistoria registada"
          desc="Comece a sua primeira vistoria técnica."
          action={<Button variant="primary"><Icon name="plus" />+ Nova vistoria</Button>}
        />
      </Panel>
    </>
  )
}
