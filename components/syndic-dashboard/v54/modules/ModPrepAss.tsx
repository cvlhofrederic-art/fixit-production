'use client'

import { PageHead } from '../primitives/page-head'
import { Alert } from '../primitives/alert'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import { useComingSoon } from './use-coming-soon'

/** Preparador de Assembleia — port byte-exact du ModPrepAss du bundle V5.7. */

export default function ModPrepAss() {
  const soon = useComingSoon()
  return (
    <>
      <PageHead
        title="Preparador de Assembleia"
        lede="Convocatória · Ordem de trabalhos · Quóruns · Lei 8/2022"
        actions={<Button variant="gold" onClick={soon('Nova Assembleia', 'Preparação de assembleias em desenvolvimento')}><Icon name="plus" />Nova Assembleia</Button>}
      />
      <Alert kind="gold" icon="scale" title="Enquadramento Legal — Lei 8/2022">
        Convocatória com antecedência mínima de 10 dias (CC art. 1432.°) · 2.ª convocação 30 min depois · Procuração com poderes especiais · Atas obrigatórias
      </Alert>
      <Panel>
        <Empty
          illustration="ag"
          title="Nenhuma assembleia preparada"
          desc="Crie a sua primeira assembleia de condóminos"
          action={<Button variant="primary" onClick={soon('Iniciar preparação', 'Preparação de assembleias em desenvolvimento')}>Iniciar preparação</Button>}
        />
      </Panel>
    </>
  )
}
