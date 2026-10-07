'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Pill } from '../primitives/pill'
import { Progress } from '../primitives/progress'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { CARREGAMENTO_VE_MESSAGES } from './i18n/ModCarregamentoVE.messages'

/** Carregamento de Veículos Elétricos — port byte-exact du ModCarregamentoVE du bundle V5.7. */

export default function ModCarregamentoVE() {
  const t = useMessages(CARREGAMENTO_VE_MESSAGES)
  const soon = useComingSoon()
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <KPIGrid items={[
        { icon: 'doc', num: 2, lbl: t.kpi.actives, accent: 'rust' },
        { icon: 'check', num: 1, lbl: t.kpi.approuvees, accent: 'sage' },
        { icon: 'bolt', num: 2, lbl: t.kpi.bornes, accent: 'rust' },
        { icon: 'bolt', num: '18,40 kW', lbl: t.kpi.puissance, accent: 'gold' },
        { icon: 'chart', num: t.kpi.consommationValeur, lbl: t.kpi.consommation, accent: 'gold' },
        { icon: 'coin', num: '463,00 €', lbl: t.kpi.cout, accent: 'rust' },
      ]} />
      <Tabs defaultActive="ped" tabs={[
        { id: 'ped', icon: 'clipboard', label: t.onglets.ped },
        { id: 'inst', icon: 'outlet', label: t.onglets.inst },
        { id: 'leg', icon: 'scale', label: t.onglets.leg },
        { id: 'inc', icon: 'coin', label: t.onglets.inc },
      ]} />
      <Button variant="primary" style={{ marginBottom: 14 }} onClick={soon(t.enregistrerToast, t.enDeveloppement)}><Icon name="plus" />{t.enregistrer}</Button>
      {t.demo.map((p) => (
        <div key={p.nom} className={m.card} style={{ padding: 22, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <b style={{ fontSize: 15 }}>{p.nom}</b>
                <Pill kind={p.kind} noDot>{t.statuts[p.statut]}</Pill><Pill noDot>{p.usage}</Pill>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)' }}>{p.detail}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {p.statut === 'pendente' && <Button variant="primary" size="sm" onClick={soon(t.examinerToast)}>{t.examiner}</Button>}
              <Button variant="ghost" size="sm" aria-label={t.plusActions} title={t.plusActions} onClick={soon(t.plusActions)}><Icon name="download" /></Button>
            </div>
          </div>
          <div style={{ margin: '14px 0 6px' }}><Progress pct={p.pct} kind={p.kind} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--v54-navy-300)' }}>
            <span>{p.notification}</span><span style={{ color: p.depassee ? 'var(--v54-rust-700)' : 'inherit' }}>{p.echeance}</span>
          </div>
        </div>
      ))}
    </>
  )
}
