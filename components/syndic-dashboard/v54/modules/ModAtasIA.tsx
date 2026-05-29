'use client'

import { PageHead } from '../primitives/page-head'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'

/** Atas com IA — port byte-exact du ModAtasIA du bundle V5.7. */

export default function ModAtasIA() {
  return (
    <>
      <PageHead
        title="Atas com IA — Atas de Assembleia"
        actions={<Button variant="gold"><Icon name="plus" />+ Nova Ata</Button>}
      />
      <div style={{ fontSize: 13, color: 'var(--v54-navy-300)', marginBottom: 14 }}>Geração inteligente de atas de assembleia de condóminos</div>
      <Tabs defaultActive="ger" tabs={[
        { id: 'ger', icon: 'pencil', label: 'Gerar Ata' },
        { id: 'atas', icon: 'book', label: 'Atas Geradas' },
        { id: 'mod', icon: 'clipboard', label: 'Modelos' },
      ]} />
      <Panel>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ color: 'var(--v54-gold-500)', marginBottom: 14, display: 'flex', justifyContent: 'center' }}><Icon name="pencil" style={{ width: 54, height: 54 }} /></div>
          <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 24, marginBottom: 6 }}>Gerar uma nova ata</div>
          <div style={{ fontSize: 13, color: 'var(--v54-navy-300)', maxWidth: 480, margin: '0 auto 24px' }}>Utilize o assistente passo a passo para criar uma ata de assembleia completa, ou comece a partir de um modelo.</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Button variant="primary"><Icon name="sparkle" />Começar do zero</Button>
            <Button>Ver modelos</Button>
          </div>
        </div>
      </Panel>
    </>
  )
}
