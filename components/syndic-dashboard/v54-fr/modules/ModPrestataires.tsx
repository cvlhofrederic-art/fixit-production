'use client'

// Prestataires (ModPrestataires) — port byte-exact du mockup v8 FR.
// Annuaire des intervenants référencés (PRESTATAIRES) : conformité décennale,
// contrats cadre, fiche détail, ajout via CreateModal, renvoi vers les OS.

import { useState } from 'react'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import type { IconName } from '@/lib/syndic/icon-names'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import { PRESTATAIRES, type Prestataire } from '../data/mock'
import DetailModal, { type DetailField } from '../shared/DetailModal'
import CreateModal from '../shared/CreateModal'

interface Detail {
  title: string
  icon: IconName
  fields: DetailField[]
}

const stat = (p: Prestataire): string =>
  p.statut === 'Devis en cours' ? 'Devis' : p.statut === 'Sur appel' ? 'Sur appel' : 'Actif'

const cardStyle = { background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 14, boxShadow: 'var(--v54-shadow-card)', overflow: 'hidden', padding: 22 } as const
const cardHead = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 12 } as const
const cardName = { fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 } as const
const cardInfoGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5, marginBottom: 12 } as const
const infoCell = { color: 'var(--v54-navy-500)' } as const
const inlineIco = { width: 13, height: 13, verticalAlign: '-2px', marginRight: 4 } as const

export default function ModPrestataires({ onNavigate }: Readonly<{ onNavigate?: (id: string) => void }>) {
  const { push } = useToast()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [create, setCreate] = useState(false)

  return (
    <>
      <PageHead
        eyebrow="Patrimoine"
        title="Prestataires"
        lede={`${PRESTATAIRES.length} intervenants référencés · ${PRESTATAIRES.filter((p) => p.decennale === 'Oui').length} avec assurance décennale · ${PRESTATAIRES.filter((p) => p.statut === 'Contrat cadre').length} contrats cadre`}
        actions={
          <>
            <Button onClick={() => push({ kind: 'success', title: 'Conformité synchronisée', desc: 'Assurances décennale et RC vérifiées' })}>
              <Icon name="check" />Sync conformité
            </Button>
            <Button variant="gold" onClick={() => setCreate(true)}>
              <Icon name="plus" />Ajouter un prestataire
            </Button>
          </>
        }
      />
      <KPIGrid
        items={[
          { icon: 'wrench', num: PRESTATAIRES.length, lbl: 'Prestataires référencés', sub: 'multi-métiers' },
          { icon: 'shield', num: PRESTATAIRES.filter((p) => p.decennale === 'Oui').length, lbl: 'Avec décennale', accent: 'sage' },
          { icon: 'handshake', num: PRESTATAIRES.filter((p) => p.statut === 'Contrat cadre').length, lbl: 'Contrats cadre', accent: 'gold' },
          { icon: 'check', num: '4,6', lbl: 'Note moyenne', accent: 'sage' },
        ]}
      />
      <div className={m.cardGrid}>
        {PRESTATAIRES.map((p) => (
          <div key={p.id} style={cardStyle}>
            <div style={cardHead}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={cardName}>{p.nom}</div>
                  {p.statut === 'Contrat cadre' && <Pill kind="gold" noDot>Contrat cadre</Pill>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', marginTop: 2 }}>{p.metier}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: 'var(--v54-gold-600)', fontWeight: 600, fontSize: 13 }}>★ {p.note}</div>
                <Pill kind={p.pill} noDot>{stat(p)}</Pill>
              </div>
            </div>
            <div style={cardInfoGrid}>
              <div style={infoCell}><Icon name="pin" style={inlineIco} />{p.ville}</div>
              <div style={infoCell}><Icon name="fact" style={inlineIco} />{p.siret}</div>
              <div style={infoCell}>Décennale : {p.decennale}</div>
              <div style={infoCell}>{p.interventions} interventions</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="sm"
                onClick={() => setDetail({
                  title: p.nom,
                  icon: 'wrench',
                  fields: [
                    { k: 'Métier', v: p.metier },
                    { k: 'Ville', v: p.ville },
                    { k: 'SIRET', v: p.siret },
                    { k: 'Assurance décennale', v: p.decennale },
                    { k: 'Note', v: p.note },
                    { k: 'Interventions', v: p.interventions },
                    { k: 'Statut', v: p.statut },
                  ],
                })}>
                Fiche
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onNavigate?.('interventions')}>Nouvel OS</Button>
            </div>
          </div>
        ))}
      </div>
      <CreateModal
        open={create}
        onClose={() => setCreate(false)}
        title="Ajouter un prestataire"
        icon="wrench"
        fields={[
          { label: 'Raison sociale', required: true, full: true },
          { label: 'Métier', type: 'select', options: ['Plomberie / chauffage', 'Électricité', 'Ascensoriste', 'Couverture / étanchéité', 'Espaces verts', 'Nettoyage', 'Serrurerie', 'Sécurité incendie'] },
          { label: 'SIRET' },
          { label: 'Assurance décennale', type: 'select', options: ['Oui', 'N/A'] },
        ]}
        submitLabel="Ajouter"
        onDone={() => push({ kind: 'success', title: 'Prestataire ajouté', desc: 'Intervenant référencé' })}
      />
      <DetailModal open={!!detail} onClose={() => setDetail(null)} title={detail?.title} icon={detail?.icon} fields={detail?.fields || []} />
    </>
  )
}
