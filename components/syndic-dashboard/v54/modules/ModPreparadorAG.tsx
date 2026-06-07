'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import { useComingSoon } from './use-coming-soon'

/** Preparador AG — port byte-exact du ModPreparadorAG du bundle V5.7. */

export default function ModPreparadorAG() {
  const soon = useComingSoon()
  return (
    <>
      <PageHead
        title="Preparador AG"
        lede="Gere convocatórias e ordem do dia em poucos cliques"
        actions={<Button onClick={soon('Nova AG', 'Preparação de assembleias em desenvolvimento')}><Icon name="plus" />+ Nova AG</Button>}
      />
      <Panel>
        <Empty
          illustration="ag"
          title="Nenhuma AG preparada"
          desc="Prepare a sua próxima assembleia geral com convocatória, ordem do dia e lista de verificação de documentos"
          action={<Button variant="primary" onClick={soon('Preparar AG', 'Preparação de assembleias em desenvolvimento')}>Começar a preparação</Button>}
        />
      </Panel>
    </>
  )
}
