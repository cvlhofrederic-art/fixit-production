'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'

/** Alertas — port byte-exact du ModAlertas du bundle V5.7. */

export default function ModAlertas() {
  return (
    <>
      <PageHead title="Alertas" lede="Alertas urgentes do sistema, prazos legais e operacionais" />
      <Panel>
        <Empty kind="sage" illustration="ocorrencias" title="Todos os alertas foram tratados!" desc="Operação nominal" />
      </Panel>
    </>
  )
}
