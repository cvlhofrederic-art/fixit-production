'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'

/**
 * Condóminos & Inquilinos — port byte-exact du ModCondominos du bundle V5.7.
 * Le bloc conditionnel `InquilinosSection` (window.Sections7) du bundle rend
 * null quand la section n'est pas chargée : on porte donc le corps principal.
 */

const inputStyle = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const
const selectStyle = { padding: '10px 14px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13, background: '#fff' } as const
const searchIcon = { position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' } as const

export default function ModCondominos() {
  return (
    <>
      <PageHead
        title="Condóminos & Inquilinos"
        lede="Proprietários · Arrendatários · Frações · Permilagens"
        actions={<>
          <Button><Icon name="upload" />Import Gecond</Button>
          <Button><Icon name="download" />Export CSV</Button>
          <Button variant="gold"><Icon name="plus" />Adicionar</Button>
        </>}
      />
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Icon name="search" style={searchIcon} />
          <input aria-label="Pesquisar condómino" style={inputStyle} placeholder="Pesquisar por nome, fração…" />
        </div>
        <select aria-label="Filtrar por condomínio" style={selectStyle}><option>Todos os condomínios</option></select>
      </div>
      <KPIGrid items={[
        { icon: 'grid', num: 0, lbl: 'Frações total', sub: 'No portefólio', accent: 'gold' },
        { icon: 'check', num: 0, lbl: 'Ocupados', sub: 'Por condóminos', accent: 'sage' },
        { icon: 'building', num: 0, lbl: 'Vagos', sub: 'Sem ocupante', accent: 'amber' },
      ]} />
      <Tabs defaultActive="prop" tabs={[
        { id: 'prop', icon: 'users', label: 'Proprietários' },
        { id: 'inq', icon: 'home', label: 'Inquilinos' },
        { id: 'frac', icon: 'grid', label: 'Frações' },
      ]} />
      <Panel>
        <Empty
          illustration="condominos"
          title="Nenhum condómino encontrado"
          desc="Adicione condóminos manualmente ou importe-os via Gecond / CSV."
          action={<Button variant="gold"><Icon name="plus" />Adicionar primeiro condómino</Button>}
        />
      </Panel>
    </>
  )
}
