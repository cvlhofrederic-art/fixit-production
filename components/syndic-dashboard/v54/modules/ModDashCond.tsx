'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import Icon from '../primitives/icon/Icon'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/** Dashboard Condómino — Tempo Real — port byte-exact V5.7 + Phase 3 : KPIs calculés (lecture
 * seule) depuis data.coproprios + data.impayes + data.missions. Aucune nouvelle table/route. */

const inputStyle = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const
const searchIcon = { position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' } as const
const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const
const kEur = (n: number) => `${(n / 1000).toFixed(1).replace('.', ',')}k€`

export default function ModDashCond() {
  const data = useSyndicData()
  const real = data.authenticated
  const cop = real ? (data.coproprios ?? []) : []
  const imp = real ? (data.impayes ?? []) : []
  const miss = real ? (data.missions ?? []) : []
  const openImp = imp.filter((i) => i.statut === 'ouvert' || i.statut === 'en_recouvrement')
  const comAtraso = new Set(openImp.map((i) => i.coproprioId).filter(Boolean)).size
  const divida = openImp.reduce((s, i) => s + (i.montant || 0), 0)
  const ativos = cop.filter((c) => c.acessoPortal).length
  const pendentes = miss.filter((mi) => mi.statut !== 'terminee' && mi.statut !== 'annulee').length

  return (
    <>
      <PageHead title="Dashboard Condómino — Tempo Real" lede="Estado de cada condómino · Barra de progresso intervenções · Financeiro · Comunicação" />
      <KPIGrid items={[
        { icon: 'users', num: real ? cop.length : 0, lbl: 'Total condóminos' },
        { icon: 'check', num: real ? ativos : 0, lbl: 'Ativos (7 dias)', accent: 'sage' },
        { icon: 'alert', num: real ? comAtraso : 0, lbl: 'Com atraso', accent: 'amber' },
        { icon: 'wrench', num: real ? pendentes : 0, lbl: 'Interv. pendentes', accent: 'rust' },
        { icon: 'coin', num: real ? kEur(divida) : '0,0k€', lbl: 'Total em dívida', accent: 'gold' },
      ]} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Icon name="search" style={searchIcon} />
          <input aria-label="Pesquisar condómino" style={inputStyle} placeholder="Pesquisar condómino…" />
        </div>
        <select aria-label="Filtrar por edifício" style={selectStyle}><option>Todos os edifícios</option></select>
      </div>
      <Tabs defaultActive="vg" tabs={[
        { id: 'vg', icon: 'chart', label: 'Visão Geral' },
        { id: 'in', icon: 'wrench', label: 'Intervenções' },
        { id: 'fn', icon: 'coin', label: 'Financeiro' },
        { id: 'cm', icon: 'chat', label: 'Comunicação' },
      ]} />
    </>
  )
}
