'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Alert } from '../primitives/alert'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { OPEN_BANKING_MESSAGES } from './i18n/ModOpenBanking.messages'

/** Open Banking — Reconciliação Automática — port byte-exact du ModOpenBanking du bundle V5.7. */

export default function ModOpenBanking() {
  const t = useMessages(OPEN_BANKING_MESSAGES)
  const soon = useComingSoon()
  const b = t.bientot
  return (
    <>
      <PageHead eyebrow={t.surtitre} title={t.titre}
        lede={t.chapeau}
        actions={<><Button onClick={soon(b.connecterCompteBancaire.titre, b.connecterCompteBancaire.desc)}><Icon name="plus" />{t.connecterCompteBancaire}</Button><Button variant="gold" onClick={soon(b.synchronisation.titre, b.synchronisation.desc)}><Icon name="refresh" />{t.synchroniserMaintenant}</Button></>} />
      <Alert kind="sage" icon="check" title={t.alerte.titre}>
        {t.alerte.texte}
      </Alert>
      <KPIGrid items={[
        { icon: 'bank', num: 0, lbl: t.kpi.comptes },
        { icon: 'refresh', num: 0, lbl: t.kpi.transactions, accent: 'gold' },
        { icon: 'check', num: t.zeroPourcent, lbl: t.kpi.rapprochement, accent: 'sage' },
        { icon: 'alert', num: 0, lbl: t.kpi.revue, accent: 'amber' },
        { icon: 'ban', num: 0, lbl: t.kpi.nonRapprochees, accent: 'rust' },
        { icon: 'clock', num: '—', lbl: t.kpi.derniereSynchro },
      ]} />
      <Tabs defaultActive="contas" tabs={[
        { id: 'contas', icon: 'bank', label: t.onglets.comptes },
        { id: 'sync', icon: 'refresh', label: t.onglets.synchro },
        { id: 'rev', icon: 'alert', label: t.onglets.aRevoir },
      ]} />
      <Panel>
        <Empty illustration="pagamentos" title={t.vide.titre}
          desc={t.vide.desc}
          action={<Button variant="primary" onClick={soon(b.connecterCompte.titre, b.connecterCompte.desc)}><Icon name="bank" />{t.vide.action}</Button>} />
      </Panel>
      <Panel title={t.banquesTitre}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
          {t.banques.map((bq, i) => (
            <div key={i} style={{ padding: '10px 14px', border: '1px solid var(--v54-line)', borderRadius: 8, textAlign: 'center', background: 'var(--v54-cream)', fontSize: 12, fontWeight: 600, color: 'var(--v54-navy-900)' }}>{bq}</div>
          ))}
        </div>
      </Panel>
    </>
  )
}
