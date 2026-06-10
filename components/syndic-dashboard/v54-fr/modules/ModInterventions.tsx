'use client'

// Ordres de service (ModInterventions) — port byte-exact du mockup v8 FR.
// Interventions sur les parties communes : création (CreateModal), suivi par
// statut (chips), validation et fiche détail (DetailModal).

import { useState } from 'react'
import clsx from 'clsx'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import type { IconName } from '@/lib/syndic/icon-names'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import { COPRO_NAMES, PRESTATAIRES } from '../data/mock'
import { fmtEUR } from '../lib/format'
import DetailModal, { type DetailField } from '../shared/DetailModal'
import CreateModal from '../shared/CreateModal'

type Tab = 'tous' | 'curso' | 'valider' | 'clos'

interface OrdreService {
  urg: 'Urgence' | 'Prioritaire' | 'Normale'
  statut: 'En cours' | 'À valider' | 'Planifié' | 'Clôturé'
  id: string
  copro: string
  objet: string
  frac: string
  presta: string
  date: string
}

interface Detail {
  title: string
  icon: IconName
  fields: DetailField[]
}

const OS: OrdreService[] = [
  { urg: 'Urgence', statut: 'En cours', id: 'OS-2026-051', copro: 'Le Clos des Vignes', objet: 'Fuite sur colonne EU — appartement du 4e étage', frac: 'Lot 27', presta: 'Atlantic Plomberie SARL', date: '22/05/2026' },
  { urg: 'Normale', statut: 'À valider', id: 'OS-2026-050', copro: 'Résidence Le Méridien', objet: 'Remplacement de la minuterie du hall', frac: 'Parties communes', presta: 'ELEC92 Services', date: '21/05/2026' },
  { urg: 'Normale', statut: 'Planifié', id: 'OS-2026-049', copro: 'Villa Montaigne', objet: 'Élagage des arbres de la cour', frac: 'Extérieur', presta: 'Vert Pro Espaces', date: '20/05/2026' },
  { urg: 'Prioritaire', statut: 'En cours', id: 'OS-2026-048', copro: 'Copropriété Les Tilleuls', objet: "Réparation de l'interphone collectif", frac: 'Hall', presta: 'ELEC92 Services', date: '19/05/2026' },
  { urg: 'Normale', statut: 'À valider', id: 'OS-2026-047', copro: 'Le Clos des Vignes', objet: 'Réfection de la peinture (cage B)', frac: 'Cage B', presta: '—', date: '18/05/2026' },
  { urg: 'Normale', statut: 'Clôturé', id: 'OS-2026-046', copro: 'Résidence Le Méridien', objet: 'Contrôle annuel de la VMC', frac: 'Parties communes', presta: 'Atlantic Plomberie SARL', date: '12/05/2026' },
]

const pillk = (s: OrdreService['statut']): PillKind =>
  s === 'En cours' ? 'amber' : s === 'À valider' ? 'rust' : s === 'Planifié' ? 'gold' : 'sage'

const urgk = (u: OrdreService['urg']): PillKind | undefined =>
  u === 'Urgence' ? 'rust' : u === 'Prioritaire' ? 'amber' : undefined

const rowStyle = { padding: '18px 22px', borderBottom: '1px solid var(--v54-line)' } as const
const rowHead = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 } as const
const rowName = { fontFamily: 'var(--v54-font-serif)', fontSize: 18, fontWeight: 500, marginBottom: 4 } as const
const rowSub = { fontSize: 12.5, color: 'var(--v54-navy-500)' } as const
const rowMeta = { display: 'flex', gap: 12, marginTop: 8, fontSize: 11.5, color: 'var(--v54-navy-300)' } as const

export default function ModInterventions() {
  const { push } = useToast()
  const [tab, setTab] = useState<Tab>('tous')
  const [create, setCreate] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)

  const counts = {
    tous: OS.length,
    curso: OS.filter((o) => o.statut === 'En cours').length,
    valider: OS.filter((o) => o.statut === 'À valider').length,
    clos: OS.filter((o) => o.statut === 'Clôturé').length,
  }
  const filtered = OS.filter((o) =>
    tab === 'tous' ? true : tab === 'curso' ? o.statut === 'En cours' : tab === 'valider' ? o.statut === 'À valider' : o.statut === 'Clôturé')
  const chips: [Tab, string, number][] = [
    ['tous', 'Tous', counts.tous],
    ['curso', 'En cours', counts.curso],
    ['valider', 'À valider', counts.valider],
    ['clos', 'Clôturés', counts.clos],
  ]

  return (
    <>
      <PageHead
        eyebrow="Gestion courante"
        title="Ordres de service"
        lede="Interventions sur les parties communes — création, suivi et validation, dans la limite des pouvoirs des articles 18 à 18-2."
        actions={
          <>
            <Button onClick={() => push({ kind: 'info', title: 'Filtres', desc: 'Filtres avancés des interventions' })}>
              <Icon name="search" />Filtres
            </Button>
            <Button variant="gold" onClick={() => setCreate(true)}>
              <Icon name="plus" />Nouvel ordre de service
            </Button>
          </>
        }
      />
      <KPIGrid
        items={[
          { icon: 'clipboard', num: OS.filter((o) => o.statut === 'En cours').length, lbl: 'En cours', sub: '4 copropriétés', accent: 'amber' },
          { icon: 'clock', num: OS.filter((o) => o.statut === 'À valider').length, lbl: 'En attente de validation', sub: '> 48 h', accent: 'rust' },
          { icon: 'check', num: 18, lbl: 'Clôturés (mois)', sub: 'délai moyen 3,1 j', accent: 'sage' },
          { icon: 'coin', num: fmtEUR(12840), lbl: 'Engagé (mois)', sub: 'hors travaux votés' },
        ]}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {chips.map(([id, lbl, n]) => (
          <button key={id} type="button" className={clsx(m.chip, tab === id && m.chipActive)} onClick={() => setTab(id)}>
            {lbl} <span style={{ opacity: 0.6 }}>{n}</span>
          </button>
        ))}
      </div>
      <Panel flush>
        {filtered.map((o) => (
          <div key={o.id} style={rowStyle}>
            <div style={rowHead}>
              <Pill noDot kind={urgk(o.urg)}>{o.urg}</Pill>
              <Pill noDot kind={pillk(o.statut)}>{o.statut}</Pill>
              <span className={m.mono} style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{o.id}</span>
              <span style={{ fontSize: 11.5, color: 'var(--v54-navy-500)', marginLeft: 4 }}>{o.frac}</span>
              <div style={{ flex: 1 }}></div>
              {o.statut === 'À valider' && (
                <Button size="sm" style={{ background: 'var(--v54-sage-500)', color: '#fff', border: 'none' }}
                  onClick={() => push({ kind: 'success', title: 'Intervention validée', desc: o.id })}>
                  Valider
                </Button>
              )}
              <Button variant="ghost" size="sm"
                onClick={() => setDetail({
                  title: o.objet,
                  icon: 'clipboard',
                  fields: [
                    { k: 'N°', v: o.id },
                    { k: 'Copropriété', v: o.copro },
                    { k: 'Localisation', v: o.frac },
                    { k: 'Prestataire', v: o.presta },
                    { k: 'Urgence', v: o.urg },
                    { k: 'Statut', v: o.statut },
                    { k: 'Date', v: o.date },
                  ],
                })}>
                Ouvrir
              </Button>
            </div>
            <div style={rowName}>{o.copro}</div>
            <div style={rowSub}>{o.objet}</div>
            <div style={rowMeta}><span>{o.presta}</span><span>{o.date}</span></div>
          </div>
        ))}
      </Panel>
      <CreateModal
        open={create}
        onClose={() => setCreate(false)}
        title="Nouvel ordre de service"
        icon="clipboard"
        fields={[
          { label: 'Copropriété', type: 'select', options: COPRO_NAMES, full: true },
          { label: 'Objet', required: true, full: true },
          { label: 'Prestataire', type: 'select', options: PRESTATAIRES.map((p) => p.nom) },
          { label: 'Urgence', type: 'select', options: ['Normale', 'Prioritaire', 'Urgence'] },
          { label: 'Description', type: 'textarea', full: true },
        ]}
        submitLabel="Créer"
        onDone={() => push({ kind: 'success', title: 'Ordre de service créé', desc: 'Intervention enregistrée' })}
      />
      <DetailModal open={!!detail} onClose={() => setDetail(null)} title={detail?.title} icon={detail?.icon} fields={detail?.fields || []} />
    </>
  )
}
