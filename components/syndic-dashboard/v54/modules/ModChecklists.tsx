'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'

/** Checklists Inteligentes com IA — port byte-exact du ModChecklists du bundle V5.7. */

export default function ModChecklists() {
  return (
    <>
      <PageHead
        title="Checklists Inteligentes com IA"
        lede="Processos padronizados — inspeções, AG, entradas/saídas, obras"
        actions={<Button variant="gold"><Icon name="plus" />+ Nova Checklist</Button>}
      />
      <KPIGrid items={[
        { accent: 'amber', lblFirst: true, num: 0, lbl: 'Em Curso' },
        { accent: 'sage', lblFirst: true, num: 0, lbl: 'Concluídas' },
        { accent: 'gold', lblFirst: true, num: 0, lbl: 'Total' },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <Panel title="Em Curso"><Empty illustration="documentos" title="Nenhuma checklist em curso" /></Panel>
        <Panel title="Modelos"><Empty illustration="documentos" desc="Selecione uma checklist" /></Panel>
        <Panel title="Concluídas" />
      </div>
    </>
  )
}
