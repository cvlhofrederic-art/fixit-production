'use client'

// Charge des collaborateurs (équilibrage) — port byte-exact du ModCharge du
// mockup v8 (route « charge »). Mandats (PORTFOLIO, importé de ModPortefeuille)
// + tâches ouvertes (TASKS) par membre du cabinet ; barre = niveau de charge.

import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import type { Role } from '../lib/role-context'
import { TASKS } from '../data/tasks'
import { PORTFOLIO } from './ModPortefeuille'

interface TeamMember {
  nom: string
  role: string
  taskRole: Role
}

const TEAM: TeamMember[] = [
  { nom: 'Awa Diallo', role: 'Gestionnaire', taskRole: 'Gestion' },
  { nom: 'Marc Léautaud', role: 'Gestionnaire', taskRole: 'Gestion' },
  { nom: 'Camille Noël', role: 'Juriste copropriété', taskRole: 'Juridique' },
  { nom: 'Julien Marchand', role: 'Comptable', taskRole: 'Comptabilité' },
  { nom: 'Sophie Vidal', role: 'Assistante', taskRole: 'Secrétariat' },
]

const LOAD_BAR: Record<string, string> = {
  rust: 'linear-gradient(90deg,var(--v54-rust-700),var(--v54-rust-500))',
  gold: 'linear-gradient(90deg,var(--v54-gold-600),var(--v54-gold-500))',
  sage: 'linear-gradient(90deg,var(--v54-sage-700),var(--v54-sage-500))',
}

export default function ModCharge() {
  const { push } = useToast()
  const rows = TEAM.map((t) => {
    const mandats = PORTFOLIO.filter((x) => x.resp === t.nom).length
    const tasks = TASKS.filter((k) => k.role === t.taskRole).length
    const score = mandats + Math.round(tasks * 0.6)
    const load = Math.min(100, Math.round((score / 9) * 100))
    const state = score >= 8 ? 'Surchargé' : score >= 4 ? 'Équilibré' : 'Disponible'
    const pill: PillKind = score >= 8 ? 'rust' : score >= 4 ? 'sage' : 'gold'
    return { ...t, mandats, tasks, load, state, pill }
  })
  const over = rows.filter((r) => r.state === 'Surchargé').length
  return (
    <>
      <PageHead
        eyebrow="Cabinet & supervision"
        title="Charge des collaborateurs"
        lede="Répartition des mandats et des tâches par membre du cabinet, pour repérer les surcharges et rééquilibrer le portefeuille."
        actions={
          <Button variant="gold" onClick={() => push({ kind: 'success', title: 'Rééquilibrage suggéré', desc: 'Proposition de répartition générée' })}>
            <Icon name="users" />Rééquilibrer automatiquement
          </Button>
        }
      />
      <KPIGrid
        items={[
          { icon: 'users', num: TEAM.length, lbl: 'Collaborateurs', sub: 'cabinet' },
          { icon: 'scale', num: PORTFOLIO.length, lbl: 'Mandats répartis' },
          { icon: 'alert', num: over, lbl: 'Collaborateurs surchargés', sub: over ? 'à soulager' : 'charge saine', accent: over ? 'rust' : 'sage' },
          { icon: 'check', num: TASKS.length, lbl: 'Tâches en circulation', accent: 'amber' },
        ]}
      />
      <Panel title="Charge par collaborateur" sub="Mandats menés + tâches ouvertes · barre = niveau de charge" icon="users" flush>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 22px', borderBottom: '1px solid var(--v54-line)' }}>
            <div className={m.av} style={{ flexShrink: 0 }}>{r.nom.split(' ').map((w) => w[0]).join('').slice(0, 2)}</div>
            <div style={{ width: 170, flexShrink: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.nom}</div>
              <div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{r.role}</div>
            </div>
            <div style={{ flex: 1, minWidth: 80 }}>
              <div style={{ height: 8, borderRadius: 5, background: 'var(--v54-cream)', overflow: 'hidden' }}>
                <div style={{ width: `${r.load}%`, height: '100%', background: LOAD_BAR[r.pill] }}></div>
              </div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--v54-navy-500)', width: 72, textAlign: 'right' }}>{r.mandats} mandats</span>
            <span style={{ fontSize: 12, color: 'var(--v54-navy-500)', width: 64, textAlign: 'right' }}>{r.tasks} tâches</span>
            <Pill kind={r.pill} noDot>{r.state}</Pill>
            <Button variant="ghost" size="sm" onClick={() => push({ kind: 'info', title: 'Réaffectation', desc: `Réaffecter un mandat de ${r.nom}` })}>Réaffecter</Button>
          </div>
        ))}
      </Panel>
    </>
  )
}
