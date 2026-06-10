'use client'

// Ordonnances & missions (ModMandats) — port byte-exact du mockup v8 FR.
// Les 4 ordonnances (COPROS) filtrées par fondement / échéance, fiche détail
// (DetailModal), enregistrement d'une ordonnance via MandateWizard.

import { useState } from 'react'
import clsx from 'clsx'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Alert } from '@/components/syndic-dashboard/v54/primitives/alert'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import type { IconName } from '@/lib/syndic/icon-names'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import { COPROS, type Copro } from '../data/mock'
import { daysUntil } from '../lib/format'
import DetailModal, { type DetailField } from '../shared/DetailModal'
import MandateWizard from '../shared/MandateWizard'

type Tab = 'toutes' | 'a46' | 'a29' | 'proche'

interface Detail {
  title: string
  icon: IconName
  footnote: string
  fields: DetailField[]
}

const rowStyle = { padding: '18px 22px', borderBottom: '1px solid var(--v54-line)' } as const
const rowHead = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 } as const
const rowName = { fontFamily: 'var(--v54-font-serif)', fontSize: 18, fontWeight: 500, marginBottom: 4 } as const
const rowSub = { fontSize: 12.5, color: 'var(--v54-navy-500)' } as const
const rowMeta = { display: 'flex', gap: 12, marginTop: 8, fontSize: 11.5, color: 'var(--v54-navy-300)', flexWrap: 'wrap' } as const

const isProche = (c: Copro): boolean => {
  const d = daysUntil(c.echeance)
  return d != null && d >= 0 && d <= 90
}
const isExpired = (c: Copro): boolean => {
  const d = daysUntil(c.echeance)
  return d != null && d < 0
}

const detailOf = (c: Copro): Detail => ({
  title: c.nom,
  icon: 'scale',
  footnote: `Mission fondée sur ${c.fondement.includes('46') ? "l'article 46 du décret du 17 mars 1967 (carence de désignation)" : 'les articles 29-1 et suivants de la loi du 10 juillet 1965 (copropriété en difficulté)'}. Le syndic exerce les fonctions des articles 18 à 18-2 de la loi de 1965.`,
  fields: [
    { k: 'Tribunal', v: c.tribunal },
    { k: 'Numéro RG', v: c.rg },
    { k: "Date de l'ordonnance", v: c.ordonnance },
    { k: 'Durée de la mission', v: `${c.dureeMois} mois` },
    { k: 'Échéance', v: c.echeance },
    { k: 'Fondement', v: c.fondement },
    { k: 'Lots', v: `${c.lots} lots` },
    { k: 'Notification (art. 64)', v: c.notifOrdonnance },
    { k: 'Motif de la désignation', v: c.motif, full: true },
    { k: 'Adresse', v: c.adresse, full: true },
  ],
})

export default function ModMandats({ onNavigate }: Readonly<{ onNavigate?: (id: string) => void }>) {
  const { push } = useToast()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [tab, setTab] = useState<Tab>('toutes')
  const [wiz, setWiz] = useState(false)

  const filtered = COPROS.filter((c) => {
    if (tab === 'a46') return c.fondement.includes('46')
    if (tab === 'a29') return c.fondement.includes('29-1')
    if (tab === 'proche') return isProche(c) || isExpired(c) || c.statut === 'Prorogation demandée'
    return true
  })

  const chips: [Tab, string, number][] = [
    ['toutes', 'Toutes', COPROS.length],
    ['a46', 'Art. 46 — carence', COPROS.filter((c) => c.fondement.includes('46')).length],
    ['a29', 'Art. 29-1 — difficulté', COPROS.filter((c) => c.fondement.includes('29-1')).length],
    ['proche', 'Échéance / prorogation', COPROS.filter((c) => isProche(c) || isExpired(c) || c.statut === 'Prorogation demandée').length],
  ]

  return (
    <>
      <PageHead
        eyebrow="Mandat judiciaire"
        title="Ordonnances & missions"
        lede="Désignations prononcées par le Tribunal judiciaire — fondement, périmètre, durée et échéances de chaque mission."
        actions={
          <>
            <Button onClick={() => push({ kind: 'success', title: 'Export généré', desc: 'Tableau des mandats prêt' })}>
              <Icon name="download" />Exporter
            </Button>
            <Button variant="gold" onClick={() => setWiz(true)}>
              <Icon name="plus" />Enregistrer une ordonnance
            </Button>
          </>
        }
      />
      <KPIGrid
        items={[
          { icon: 'scale', num: 3, lbl: 'Mandats art. 46 (carence)', sub: 'Syndic judiciaire stricto sensu', accent: 'sage' },
          { icon: 'shield', num: 1, lbl: 'Mandat art. 29-1', sub: 'Copropriété en difficulté', accent: 'amber' },
          { icon: 'clock', num: '48 j', lbl: 'Échéance la plus proche', sub: 'Clos des Vignes', accent: 'amber', trend: { kind: 'warn', label: 'AG à convoquer' } },
          { icon: 'alert', num: 1, lbl: 'Mission expirée', sub: 'Les Tilleuls · prorogation', accent: 'rust', trend: { kind: 'bad', label: 'requête TJ' } },
        ]}
      />
      <Alert icon="scale" title="Mission art. 29-1 expirée — Copropriété Les Tilleuls">
        L&apos;ordonnance d&apos;administration provisoire arrivait à échéance le 05/05/2026. Une requête en prorogation doit être déposée au TJ de Nanterre, accompagnée d&apos;un rapport intermédiaire.
      </Alert>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {chips.map(([id, lbl, n]) => (
          <button key={id} type="button" className={clsx(m.chip, tab === id && m.chipActive)} onClick={() => setTab(id)}>
            {lbl} <span style={{ opacity: 0.6 }}>{n}</span>
          </button>
        ))}
      </div>
      <Panel flush>
        {filtered.map((c) => {
          const d = daysUntil(c.echeance)
          const expired = d != null && d < 0
          const proche = d != null && d >= 0 && d <= 90
          return (
            <div key={c.id} style={rowStyle}>
              <div style={rowHead}>
                <Pill noDot>{c.fondement}</Pill>
                <Pill kind={c.pill} noDot>{c.statut}</Pill>
                <span className={m.mono} style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>RG {c.rg}</span>
                <div style={{ flex: 1 }}></div>
                {expired && (
                  <Button size="sm" style={{ background: 'var(--v54-rust-500)', color: '#fff', border: 'none' }}
                    onClick={() => push({ kind: 'info', title: 'Requête en prorogation', desc: `${c.nom} — dépôt au ${c.tribunal}` })}>
                    Demander la prorogation
                  </Button>
                )}
                {proche && !expired && (
                  <Button size="sm" style={{ background: 'var(--v54-gold-500)', color: '#1a1a1a', border: 'none' }} onClick={() => onNavigate?.('agElective')}>
                    Convoquer l&apos;AG
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setDetail(detailOf(c))}>Ouvrir le dossier</Button>
              </div>
              <div style={rowName}>{c.nom}</div>
              <div style={rowSub}>{c.adresse} · {c.lots} lots</div>
              <div style={rowMeta}>
                <span>{c.tribunal}</span>
                <span>Ordonnance du {c.ordonnance}</span>
                <span>Échéance {c.echeance}{d != null ? ` · ${expired ? 'expirée' : `${d} j restants`}` : ''}</span>
              </div>
            </div>
          )
        })}
      </Panel>
      <DetailModal open={!!detail} onClose={() => setDetail(null)} title={detail?.title} icon={detail?.icon} fields={detail?.fields || []} footnote={detail?.footnote} />
      <MandateWizard open={wiz} onClose={() => setWiz(false)} />
    </>
  )
}
