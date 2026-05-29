'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'

/**
 * Faturação & Recibos Verdes — port byte-exact du ModFaturacao du bundle V5.7.
 * Le bloc conditionnel `RecibosVerdesSection` (window.Sections7) rend null hors
 * chargement : on porte le corps principal.
 */

export default function ModFaturacao() {
  return (
    <>
      <PageHead
        title="Faturação & Recibos Verdes"
        lede="Faturas, orçamentos e dossiês transferidos · Recibos verdes com retenção IRS automática"
      />
      <KPIGrid items={[
        { icon: 'coin', num: '0', cur: '€', lbl: 'Faturado (missões)', sub: '0 faturas', accent: 'gold' },
        { icon: 'doc', num: '0', cur: '€', lbl: 'Orçamentos em curso', sub: '0 orçamentos', accent: 'amber' },
        { icon: 'mail', num: 0, lbl: 'Dossiês transferidos', sub: '0 em espera' },
        { icon: 'check', num: 0, lbl: 'Validados contabilidade', accent: 'sage' },
      ]} />
      <Tabs defaultActive="fat" tabs={[
        { id: 'fat', icon: 'doc', label: 'Faturas & Orçamentos' },
        { id: 'tr', icon: 'archive', label: 'Dossiês transferidos' },
        { id: 'rv', icon: 'doc', label: 'Recibos Verdes & IRS' },
      ]} />
      <Panel title="Faturas & orçamentos das missões">
        <Empty illustration="faturas" title="Nenhuma fatura nem orçamento nas missões" desc="As faturas das missões aparecerão aqui automaticamente" />
      </Panel>
    </>
  )
}
