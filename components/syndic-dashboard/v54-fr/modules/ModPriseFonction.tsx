'use client'

// Prise de fonction (ModPriseFonction) — port byte-exact du mockup v8 FR.
// Check-list de reprise de mission (PF_SEED, fonction de la copropriété
// sélectionnée via CoproSelect) : archives, fonds, compte séparé, assurance,
// immatriculation. Clic sur une ligne = cycle de statut.

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import { byCode, type Copro } from '../data/mock'
import CoproSelect from '../shared/CoproSelect'

type PFStatut = 'Fait' | 'En cours' | 'À faire' | 'Bloqué'

interface PFItem {
  id: number
  label: string
  art: string
  role: string
  statut: PFStatut
}

const PF_SEED = (c: Copro): PFItem[] => [
  { id: 1, label: "Notifier l'ordonnance à tous les copropriétaires", art: 'art. 64 décret 1967 · sous 1 mois', role: 'Secrétariat', statut: 'Fait' },
  { id: 2, label: "Se faire remettre archives, fonds et documents par l'ancien syndic", art: 'art. 18-2 L. 1965 · remise sous 1 mois, à défaut astreinte', role: 'Direction', statut: 'En cours' },
  { id: 3, label: 'Ouvrir le compte bancaire séparé au nom du syndicat', art: 'art. 18 L. 1965', role: 'Comptabilité', statut: c.code === 'VM' ? 'À faire' : 'Fait' },
  { id: 4, label: "Récupérer le carnet d'entretien et les contrats en cours", art: 'décret 2001-477', role: 'Gestion', statut: 'En cours' },
  { id: 5, label: "Établir l'état daté des impayés et des créances", art: 'gestion de la trésorerie reprise', role: 'Comptabilité', statut: c.impayes > 0 ? 'En cours' : 'Fait' },
  { id: 6, label: "Vérifier / reprendre l'assurance RC de la copropriété", art: 'art. 9-1 L. 1965', role: 'Comptabilité', statut: 'À faire' },
  { id: 7, label: "Mettre à jour l'immatriculation au registre national", art: 'loi ALUR · L.711-2 CCH', role: 'Juridique', statut: c.code === 'VM' ? 'À faire' : 'Fait' },
  { id: 8, label: 'Informer fournisseurs et prestataires du changement de gestionnaire', art: 'continuité de gestion', role: 'Secrétariat', statut: 'En cours' },
]

const PF_PILL: Record<PFStatut, PillKind> = { Fait: 'sage', 'En cours': 'amber', 'À faire': 'gold', Bloqué: 'rust' }
const PF_NEXT: Record<PFStatut, PFStatut> = { 'À faire': 'En cours', 'En cours': 'Fait', Fait: 'À faire', Bloqué: 'En cours' }

const itemBtn = { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', width: '100%', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: '1px solid var(--v54-line)' } as const

export default function ModPriseFonction() {
  const { push } = useToast()
  const [code, setCode] = useState('VM')
  const c = byCode(code)
  const [items, setItems] = useState<PFItem[]>(() => PF_SEED(c))
  // Mockup : useEffect de resynchronisation au changement de copro — porté en
  // handler direct (même comportement, sans set-state-in-effect).
  const onCopro = (next: string) => {
    setCode(next)
    setItems(PF_SEED(byCode(next)))
  }
  const cycle = (id: number) => setItems((it) => it.map((x) => (x.id === id ? { ...x, statut: PF_NEXT[x.statut] } : x)))
  const done = items.filter((i) => i.statut === 'Fait').length
  const pct = Math.round((done / items.length) * 100)
  const blocked = items.filter((i) => i.statut === 'Bloqué').length

  return (
    <>
      <PageHead
        eyebrow="Pilotage judiciaire"
        title="Prise de fonction"
        lede="Reprise de la mission : récupération des archives et fonds, compte séparé, assurance, immatriculation. La douleur la plus concrète d'un début de mandat, structurée et suivie."
        actions={
          <>
            <CoproSelect value={code} onChange={onCopro} />
            <Button variant="gold" onClick={() => push({ kind: 'success', title: 'Rapport de prise de fonction', desc: `${c.nom} — état de reprise exporté` })}>
              <Icon name="download" />Exporter l&apos;état
            </Button>
          </>
        }
      />
      <KPIGrid
        items={[
          { icon: 'clipboard', num: `${pct}%`, lbl: 'Avancement de la reprise', sub: c.nom, accent: pct === 100 ? 'sage' : 'amber' },
          { icon: 'check', num: `${done}/${items.length}`, lbl: 'Diligences accomplies', accent: 'sage' },
          { icon: 'alert', num: blocked, lbl: 'Points bloquants', sub: blocked ? "remise par l'ancien syndic" : 'aucun', accent: blocked ? 'rust' : 'sage' },
          { icon: 'clock', num: '1 mois', lbl: 'Délai de notification', sub: 'art. 64 décret', accent: 'gold' },
        ]}
      />
      <Panel
        title="Check-list de reprise de mission"
        sub="Cliquez sur une ligne pour faire évoluer son statut · fondement légal indiqué"
        icon="clipboard"
        right={<Pill kind={pct === 100 ? 'sage' : 'amber'} noDot>{pct}%</Pill>}
        flush
      >
        <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--v54-line)' }}>
          <div style={{ height: 8, borderRadius: 5, background: 'var(--v54-cream)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,var(--v54-sage-700),var(--v54-sage-500))' }}></div>
          </div>
        </div>
        {items.map((i) => (
          <button key={i.id} type="button" onClick={() => cycle(i.id)} style={itemBtn}>
            <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${i.statut === 'Fait' ? 'var(--v54-sage-500)' : 'var(--v54-line)'}`, background: i.statut === 'Fait' ? 'var(--v54-sage-500)' : '#fff', color: '#fff', display: 'grid', placeItems: 'center' }}>
              {i.statut === 'Fait' && <Icon name="check" style={{ width: 13, height: 13 }} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, textDecoration: i.statut === 'Fait' ? 'line-through' : 'none', color: i.statut === 'Fait' ? 'var(--v54-navy-300)' : 'inherit' }}>{i.label}</div>
              <div style={{ fontSize: 11, color: 'var(--v54-navy-300)', marginTop: 2 }}>{i.art} · {i.role}</div>
            </div>
            <Pill kind={PF_PILL[i.statut]} noDot>{i.statut}</Pill>
          </button>
        ))}
      </Panel>
    </>
  )
}
