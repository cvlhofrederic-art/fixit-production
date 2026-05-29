'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'

/** Gestão de Seguros — port byte-exact du ModSeguros du bundle V5.7. */

const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 14 } as const

export default function ModSeguros() {
  return (
    <>
      <PageHead
        title="Gestão de Seguros"
        lede="Apólices, coberturas, sinistros e alertas por edifício"
        actions={<Button variant="gold"><Icon name="plus" />+ Nova Apólice</Button>}
      />
      <KPIGrid items={[
        { icon: 'shield', num: 0, lbl: 'Apólices Ativas', accent: 'gold' },
        { icon: 'check', num: 0, lbl: 'Expiradas', accent: 'sage' },
        { icon: 'clock', num: 0, lbl: 'A Expirar (60d)', accent: 'amber' },
        { icon: 'coin', num: '0 €', lbl: 'Total Prémios/Ano' },
        { icon: 'bank', num: '0 €', lbl: 'Capital Total' },
      ]} />
      <Tabs defaultActive="vg" tabs={[
        { id: 'vg', icon: 'chart', label: 'Visão Geral' },
        { id: 'ap', icon: 'shield', label: 'Apólices' },
        { id: 'sn', icon: 'alert', label: 'Sinistros' },
        { id: 'al', icon: 'bell', label: 'Alertas' },
      ]} />
      <select aria-label="Filtrar por edifício" style={selectStyle}><option>Todos os edifícios</option></select>
      <Panel><Empty illustration="condominos" title="Nenhum edifício registado" /></Panel>
    </>
  )
}
