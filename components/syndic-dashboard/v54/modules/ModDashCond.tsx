'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import Icon from '../primitives/icon/Icon'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { DASH_COND_MESSAGES } from './i18n/ModDashCond.messages'

/** Dashboard Condómino — Tempo Real — port byte-exact V5.7 + Phase 3 : KPIs calculés (lecture
 * seule) depuis data.coproprios + data.impayes + data.missions. Aucune nouvelle table/route. */

const inputStyle = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const
const searchIcon = { position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' } as const
const selectStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v54-line-strong)', background: '#fff', color: 'var(--v54-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const

export default function ModDashCond() {
  const t = useMessages(DASH_COND_MESSAGES)
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
      <PageHead title={t.titre} lede={t.chapeau} />
      <KPIGrid items={[
        { icon: 'users', num: real ? cop.length : 0, lbl: t.kpi.total },
        { icon: 'check', num: real ? ativos : 0, lbl: t.kpi.actifs, accent: 'sage' },
        { icon: 'alert', num: real ? comAtraso : 0, lbl: t.kpi.retard, accent: 'amber' },
        { icon: 'wrench', num: real ? pendentes : 0, lbl: t.kpi.interventions, accent: 'rust' },
        { icon: 'coin', num: t.kEur(real ? divida : 0), lbl: t.kpi.dette, accent: 'gold' },
      ]} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Icon name="search" style={searchIcon} />
          <input aria-label={t.rechercheAria} style={inputStyle} placeholder={t.recherchePlaceholder} />
        </div>
        <select aria-label={t.filtreAria} style={selectStyle}><option>{t.tousLesImmeubles}</option></select>
      </div>
      <Tabs defaultActive="vg" tabs={[
        { id: 'vg', icon: 'chart', label: t.onglets.vg },
        { id: 'in', icon: 'wrench', label: t.onglets.in },
        { id: 'fn', icon: 'coin', label: t.onglets.fn },
        { id: 'cm', icon: 'chat', label: t.onglets.cm },
      ]} />
    </>
  )
}
