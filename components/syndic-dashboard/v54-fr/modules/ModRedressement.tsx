'use client'

// Redressement — copropriété en difficulté (ModRedressement) — port byte-exact
// du mockup v8 FR. Mandat art. 29-1 (Les Tilleuls) : seuil d'alerte des
// impayés (25 %), plan d'apurement des créanciers, suspension des poursuites.

import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Alert } from '@/components/syndic-dashboard/v54/primitives/alert'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import { byCode } from '../data/mock'
import { fmtEUR } from '../lib/format'
import DataTable from '../shared/DataTable'

interface Creancier {
  nom: string
  type: string
  montant: number
  plan: string
  statut: string
  pill: PillKind
}

const CREANCIERS: Creancier[] = [
  { nom: 'Atlantic Plomberie SARL', type: 'Fournisseur', montant: 8400, plan: '6 mensualités', statut: 'Échéancier accepté', pill: 'sage' },
  { nom: 'Régie ENEDIS (parties communes)', type: 'Énergie', montant: 5200, plan: 'Apurement T3', statut: 'En négociation', pill: 'amber' },
  { nom: 'ELEC92 Services', type: 'Fournisseur', montant: 3100, plan: '3 mensualités', statut: 'Échéancier accepté', pill: 'sage' },
  { nom: "Cabinet d'avocats (contentieux)", type: 'Honoraires', montant: 2600, plan: 'À provisionner', statut: 'À traiter', pill: 'rust' },
]

export default function ModRedressement() {
  const { push } = useToast()
  const c = byCode('TL') // mandat art. 29-1
  const tauxImpayes = Math.round((c.impayes / c.budget) * 100)
  const dette = CREANCIERS.reduce((s, x) => s + x.montant, 0)

  return (
    <>
      <PageHead
        eyebrow="Pilotage judiciaire"
        title="Redressement — copropriété en difficulté"
        lede="Mandat art. 29-1 : rétablir l'équilibre financier et le fonctionnement normal. Seuil d'alerte des impayés, plan d'apurement et suspension des poursuites."
        actions={
          <Button variant="gold" onClick={() => push({ kind: 'success', title: "Plan d'apurement", desc: `${c.nom} — échéancier mis à jour` })}>
            <Icon name="download" />Plan d&apos;apurement
          </Button>
        }
      />
      <Alert icon="siren" title={`${c.nom} — administration provisoire (art. 29-1)`}>
        {c.tribunal} · RG {c.rg}. La mission vise le rétablissement du fonctionnement normal de la copropriété et le redressement de sa situation financière.
      </Alert>
      <KPIGrid
        items={[
          { icon: 'alert', num: `${tauxImpayes}%`, lbl: "Taux d'impayés", sub: 'seuil critique : 25%', accent: tauxImpayes >= 25 ? 'rust' : 'amber', trend: tauxImpayes >= 25 ? { kind: 'bad', label: 'au-dessus du seuil' } : { kind: 'warn', label: 'à surveiller' } },
          { icon: 'coin', num: fmtEUR(c.impayes), lbl: 'Impayés à recouvrer', accent: 'rust' },
          { icon: 'fact', num: fmtEUR(dette), lbl: 'Dette fournisseurs', sub: `${CREANCIERS.length} créanciers`, accent: 'amber' },
          { icon: 'shield', num: 'Active', lbl: 'Suspension des poursuites', sub: 'protège le syndicat', accent: 'sage' },
        ]}
      />
      <Panel title="Taux d'impayés vs seuil légal" sub="Au-delà de 25%, le régime protecteur de l'art. 29-1 se justifie pleinement" icon="chart">
        <div style={{ position: 'relative', height: 14, borderRadius: 7, background: 'var(--v54-cream)', overflow: 'visible', marginBottom: 8 }}>
          <div style={{ width: `${Math.min(100, tauxImpayes)}%`, height: '100%', borderRadius: 7, background: tauxImpayes >= 25 ? 'linear-gradient(90deg,var(--v54-rust-700),var(--v54-rust-500))' : 'linear-gradient(90deg,var(--v54-amber-700),var(--v54-amber-500))' }}></div>
          <div style={{ position: 'absolute', left: '25%', top: -4, bottom: -4, width: 2, background: 'var(--v54-navy-700)' }}></div>
          <div style={{ position: 'absolute', left: '25%', top: -20, transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: 'var(--v54-navy-700)' }}>seuil 25%</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--v54-navy-500)' }}>{tauxImpayes}% d&apos;impayés sur un budget de {fmtEUR(c.budget)}.</div>
      </Panel>
      <Panel title="Plan d'apurement des créanciers" sub="Échéanciers négociés sous la protection de la procédure" icon="handshake" flush>
        <DataTable<Creancier>
          rowKey="nom"
          columns={[
            { h: 'Créancier', render: (r) => <b style={{ fontWeight: 600 }}>{r.nom}</b> },
            { h: 'Nature', render: (r) => <span style={{ fontSize: 12, color: 'var(--v54-navy-500)' }}>{r.type}</span> },
            { h: 'Montant', style: { textAlign: 'right' }, tdStyle: { textAlign: 'right' }, render: (r) => <b style={{ fontWeight: 600 }}>{fmtEUR(r.montant)}</b> },
            { h: 'Plan', render: (r) => r.plan },
            { h: 'Statut', render: (r) => <Pill kind={r.pill} noDot>{r.statut}</Pill> },
          ]}
          rows={CREANCIERS}
        />
      </Panel>
    </>
  )
}
