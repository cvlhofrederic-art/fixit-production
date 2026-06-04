'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { ErrorState } from '../primitives/error-state'

/** Multi-Imóveis — port byte-exact du ModMultiImoveis du bundle V5.7 (utilise ErrorState). */

export default function ModMultiImoveis() {
  return (
    <>
      <PageHead title="Multi-Imóveis" lede="Gestão consolidada do seu portefólio" />
      <Panel>
        <ErrorState
          title="Erro ao carregar imóveis"
          desc="Verifique a sua ligação e tente novamente."
          onRetry={() => window.location.reload()}
        />
      </Panel>
    </>
  )
}
