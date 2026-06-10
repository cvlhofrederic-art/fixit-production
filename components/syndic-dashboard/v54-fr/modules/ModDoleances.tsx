'use client'

import { useState } from 'react'
import clsx from 'clsx'
import type { CSSProperties } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Tabs } from '@/components/syndic-dashboard/v54/primitives/tabs'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Progress, type ProgressKind } from '@/components/syndic-dashboard/v54/primitives/progress'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import Donut from '../shared/Donut'
import DetailModal from '../shared/DetailModal'

/** Doléances & réclamations — port FR du ModOcorrencias du mockup v8
 * (KPI + répartition par priorité + donut SLA + liste d'incidents). */

/** [titre, copropriété, priorité, teinte pill ('' = défaut), statut, description, date] */
type Doleance = [string, string, string, PillKind | '', string, string, string]

const DOL: Doleance[] = [
  ['Fuite en sous-sol (parking)', 'Le Méridien', 'Urgente', 'rust', 'En cours', 'Infiltration repérée près du local technique, plombier mandaté.', '03/06'],
  ['Ascenseur à l\'arrêt', 'Le Méridien', 'Urgente', 'rust', 'Ouverte', 'Panne signalée par plusieurs copropriétaires, contrat de maintenance activé.', '04/06'],
  ['Éclairage hall défaillant', 'Villa Montaigne', 'Haute', 'amber', 'En cours', 'Minuterie HS, remplacement du détecteur planifié.', '01/06'],
  ['Nuisances sonores nocturnes', 'Le Clos des Vignes', 'Moyenne', '', 'Ouverte', 'Plainte d\'un copropriétaire, rappel du règlement à diffuser.', '30/05'],
  ['Porte de garage bloquée', 'Les Tilleuls', 'Haute', 'amber', 'Résolue', 'Moteur réinitialisé par le prestataire.', '28/05'],
  ['Boîtes aux lettres dégradées', 'Villa Montaigne', 'Basse', 'sage', 'Résolue', 'Réparation effectuée.', '25/05'],
]

/** [priorité, compteur, teinte ('' = gold par défaut)] */
const PRIO: [string, number, ProgressKind | ''][] = [['Urgente', 2, 'rust'], ['Haute', 2, 'amber'], ['Moyenne', 1, ''], ['Basse', 1, 'sage']]

const pcr = (n: number, t: number): number => (t ? Math.round((n / t) * 100) : 0)

const dolIcon = (d: Doleance): IconName => (d[4] === 'Résolue' ? 'check' : d[2] === 'Urgente' ? 'siren' : 'wrench')
const statusKind = (statut: string): PillKind => (statut === 'Résolue' ? 'sage' : statut === 'En cours' ? 'amber' : 'rust')
const dotCls = (kind: string): string =>
  clsx(m.dotStatus, kind === 'amber' && m.dotStatusAmber, kind === 'rust' && m.dotStatusRust)

// Port de la classe globale `.list-row` du mockup en <button> pleine largeur
// (le mockup utilisait un <div onClick> + role="button" — converti pour l'a11y).
const listRowBtn: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  gap: 14,
  alignItems: 'center',
  padding: '14px 22px',
  width: '100%',
  font: 'inherit',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--v54-line)',
  cursor: 'pointer',
}
const thumbStyle = {
  width: 38,
  height: 38,
  borderRadius: 9,
  background: 'var(--v54-cream)',
  color: 'var(--v54-navy-700)',
  display: 'grid',
  placeItems: 'center',
  border: '1px solid var(--v54-line)',
} as const

export default function ModDoleances() {
  const { push } = useToast()
  const [open, setOpen] = useState<Doleance | null>(null)
  return (
    <>
      <PageHead eyebrow="Gestion courante" title="Doléances & réclamations"
        lede="Centralisez les incidents et réclamations signalés par les copropriétaires."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvelle doléance', desc: 'Enregistrer un signalement' })}><Icon name="plus" />Nouvelle doléance</Button>} />
      <Tabs defaultActive="panel" tabs={[
        { id: 'panel', icon: 'chart', label: 'Tableau' },
        { id: 'liste', icon: 'clipboard', label: 'Doléances' },
        { id: 'carte', icon: 'map', label: 'Carte' },
        { id: 'qr', icon: 'qr', label: 'QR codes' },
      ]} />
      <KPIGrid items={[
        { icon: 'clipboard', num: 6, lbl: 'Total doléances' },
        { icon: 'bell', num: 2, lbl: 'Ouvertes', accent: 'rust' },
        { icon: 'wrench', num: 2, lbl: 'En cours', accent: 'amber' },
        { icon: 'check', num: 2, lbl: 'Résolues', accent: 'sage' },
        { icon: 'clock', num: '4j', lbl: 'Délai moyen' },
      ]} />
      <div className={m.cardGrid} style={{ marginBottom: 16 }}>
        <Panel title="Répartition par priorité" icon="chart">
          {PRIO.map((p, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                <span><span className={dotCls(p[2])} /> {p[0]}</span><b>{p[1]}</b>
              </div>
              <Progress pct={pcr(p[1], 6)} kind={p[2] || undefined} />
            </div>
          ))}
        </Panel>
        <Panel title="Conformité SLA" icon="clock">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0' }}>
            <Donut pct={83} kind="gold" label="dans les délais" size={150} />
          </div>
        </Panel>
      </div>
      <Panel flush>
        {DOL.map((d, i) => (
          <button key={i} type="button" onClick={() => setOpen(d)}
            style={{ ...listRowBtn, borderBottom: i < DOL.length - 1 ? listRowBtn.borderBottom : 'none' }}>
            <span style={thumbStyle}><Icon name={dolIcon(d)} /></span>
            <span style={{ minWidth: 0 }}>
              <b style={{ fontSize: 13.5, fontWeight: 600, display: 'block', lineHeight: 1.2 }}>{d[0]}</b>
              <span style={{ fontSize: 11.5, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Pill kind={d[3] || undefined} noDot>{d[2]}</Pill>
                <Pill kind={statusKind(d[4])} noDot>{d[4]}</Pill>
                <span style={{ fontSize: 11.5, color: 'var(--v54-navy-500)' }}>{d[1]}</span>
              </span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--v54-navy-300)' }}>{d[6]}</span>
          </button>
        ))}
      </Panel>
      <DetailModal open={!!open} onClose={() => setOpen(null)} title={open ? open[0] : ''} icon="clipboard"
        fields={open ? [{ k: 'Copropriété', v: open[1] }, { k: 'Priorité', v: open[2] }, { k: 'Statut', v: open[4] }, { k: 'Signalé le', v: open[6] }, { k: 'Description', v: open[5], full: true }] : []}
        footnote="Doléance versée au suivi du mandat." />
    </>
  )
}
