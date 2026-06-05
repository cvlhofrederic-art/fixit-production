'use client'

import { PageHead } from '../primitives/page-head'
import { Alert } from '../primitives/alert'
import { KPIGrid } from '../primitives/kpi'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'

/** Plano de Manutenção — port byte-exact du ModPlanoMan du bundle V5.7. */

export default function ModPlanoMan() {
  return (
    <>
      <PageHead
        title="Plano de Manutenção"
        lede="Conservação obrigatória 8 anos — DL 555/99 art. 89.°"
        actions={<Button variant="gold"><Icon name="plus" />+ Novo plano</Button>}
      />
      <Alert kind="gold" icon="scale" title="Obrigação Legal — DL 555/99 art. 89.°">
        Os edifícios devem ser objeto de obras de conservação pelo menos uma vez em cada período de 8 anos. A câmara municipal pode determinar a execução de obras de conservação necessárias.
      </Alert>
      <KPIGrid items={[
        { icon: 'doc', num: 0, lbl: 'Planos criados' },
        { icon: 'check', num: 0, lbl: 'Aprovados em AG', accent: 'sage' },
        { icon: 'pencil', num: 0, lbl: 'Em preparação', accent: 'amber' },
        { icon: 'coin', num: '—', lbl: 'Orçamento total' },
      ]} />
      <Panel>
        <Empty
          illustration="eventos"
          title="Nenhum plano de manutenção"
          desc="Comece por criar o plano de conservação para os seus edifícios."
          action={<Button variant="primary"><Icon name="plus" />+ Criar plano</Button>}
        />
      </Panel>
    </>
  )
}
