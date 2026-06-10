'use client'

// Registre des notifications (LRAR) — port byte-exact du ModNotifications du
// mockup v8 (route « notifJud »). Chaîne de notification légale : LRAR ou voie
// électronique, AR, fenêtres de recours (art. 64 décret 1967, art. 42 al. 2).

import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Alert } from '@/components/syndic-dashboard/v54/primitives/alert'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'

interface NotifEntry {
  objet: string
  dest: string
  type: string
  envoi: string
  ar: string
  recours: string
  base: string
  pill: PillKind
}

const NOTIFS: NotifEntry[] = [
  { objet: 'Ordonnance de désignation', dest: 'Tous les copropriétaires', type: 'LRAR', envoi: '15/03/2026', ar: 'Reçu', recours: '—', base: 'art. 64 décret', pill: 'sage' },
  { objet: "Procès-verbal de l'AG du 18/05", dest: 'Tous les copropriétaires', type: 'LRAR', envoi: '24/05/2026', ar: 'Partiel (38/40)', recours: '24/07/2026', base: 'art. 42 al. 2 · 2 mois', pill: 'amber' },
  { objet: 'Mise en demeure de payer', dest: 'SCI Belvédère', type: 'Signification', envoi: '02/06/2026', ar: 'En cours', recours: '—', base: 'art. 19 L. 1965', pill: 'amber' },
  { objet: 'Convocation AG élective', dest: 'Tous les copropriétaires', type: 'LRAR', envoi: 'À envoyer', ar: '—', recours: '—', base: 'art. 17 · 21 j avant', pill: 'rust' },
  { objet: 'Notification ordonnance — Villa Montaigne', dest: 'Tous les copropriétaires', type: 'Voie électronique', envoi: 'À envoyer', ar: '—', recours: '—', base: 'art. 64 · sous 1 mois', pill: 'rust' },
]

export default function ModNotifJud() {
  const { push } = useToast()
  return (
    <>
      <PageHead
        eyebrow="Mandat judiciaire"
        title="Registre des notifications"
        lede="Chaîne de notification légale : LRAR ou voie électronique, accusé de réception, et calcul automatique des fenêtres de recours. Preuve archivée pour chaque acte."
        actions={
          <Button variant="gold" onClick={() => push({ kind: 'success', title: 'Notification programmée', desc: 'LRAR + accusé de réception suivis' })}>
            <Icon name="mail" />Nouvelle notification
          </Button>
        }
      />
      <KPIGrid
        items={[
          { icon: 'mail', num: NOTIFS.length, lbl: 'Notifications au registre' },
          { icon: 'check', num: NOTIFS.filter((n) => n.ar === 'Reçu').length, lbl: 'Accusés de réception', accent: 'sage' },
          { icon: 'clock', num: NOTIFS.filter((n) => n.recours !== '—').length, lbl: 'Fenêtres de recours ouvertes', sub: 'délais à surveiller', accent: 'amber' },
          { icon: 'alert', num: NOTIFS.filter((n) => n.envoi === 'À envoyer').length, lbl: 'À envoyer', accent: 'rust' },
        ]}
      />
      <Alert icon="clock" title="Fenêtre de recours ouverte — PV de l'AG du 18/05">
        Le procès-verbal a été notifié le 24/05/2026 : les copropriétaires opposants ou défaillants disposent de deux mois (art. 42 al. 2) pour contester, soit jusqu&apos;au 24/07/2026.
      </Alert>
      <Panel title="Registre" sub="Chaque notification, son accusé de réception et son délai de recours" icon="mail" flush>
        <DataTable
          rowKey="objet"
          columns={[
            { h: 'Objet', render: (r: NotifEntry) => <b style={{ fontWeight: 600 }}>{r.objet}</b> },
            { h: 'Destinataire', render: (r: NotifEntry) => <span style={{ fontSize: 12, color: 'var(--v54-navy-500)' }}>{r.dest}</span> },
            { h: 'Voie', render: (r: NotifEntry) => r.type },
            { h: 'Envoi', render: (r: NotifEntry) => r.envoi },
            { h: 'AR', render: (r: NotifEntry) => r.ar },
            { h: 'Recours', render: (r: NotifEntry) => <span className={m.mono} style={{ fontSize: 11.5 }}>{r.recours}</span> },
            { h: 'Fondement', render: (r: NotifEntry) => <Pill kind={r.pill} noDot>{r.base}</Pill> },
          ]}
          rows={NOTIFS}
        />
      </Panel>
    </>
  )
}
