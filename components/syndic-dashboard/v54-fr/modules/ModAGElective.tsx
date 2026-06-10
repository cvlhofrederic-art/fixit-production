'use client'

// AG élective (lot A) — port du ModAGElective du mockup v8 : étapes de la
// convocation, KPI échéances, projet d'ordre du jour, modale de convocation.
// NB : l'Alert du mockup passe kind 'info' (classe inexistante dans son CSS,
// rendu = défaut amber) → kind omis ici, rendu identique.

import { useState } from 'react'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Alert } from '@/components/syndic-dashboard/v54/primitives/alert'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import CreateModal from '../shared/CreateModal'
import { COPRO_NAMES } from '../data/mock'

interface ConvocStep {
  n: string
  t: string
  d: string
  st: 'done' | 'current' | 'pending'
}

const STEPS: ConvocStep[] = [
  { n: '1', t: 'Vérification du périmètre', d: 'Liste des copropriétaires & tantièmes à jour', st: 'done' },
  { n: '2', t: "Projet d'ordre du jour", d: 'Désignation du syndic en tête (art. 25)', st: 'current' },
  { n: '3', t: 'Convocation (21 j francs min.)', d: 'Envoi LRAR / voie électronique', st: 'pending' },
  { n: '4', t: "Tenue de l'AG", d: 'Vote de désignation du syndic', st: 'pending' },
  { n: '5', t: 'PV & transfert de gestion', d: 'Remise au syndic élu', st: 'pending' },
]

const stepBadge = (st: ConvocStep['st']) =>
  ({
    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700,
    background: st === 'done' ? 'var(--v54-sage-500)' : st === 'current' ? 'var(--v54-gold-500)' : 'var(--v54-cream)',
    color: st === 'pending' ? 'var(--v54-navy-300)' : '#fff',
  }) as const

export default function ModAGElective() {
  const { push } = useToast()
  const [open, setOpen] = useState(false)
  return (
    <>
      <PageHead
        eyebrow="Mission essentielle du syndic judiciaire"
        title="Assemblée générale élective"
        lede="Convocation de l'AG appelée à désigner un syndic — au plus tard deux mois avant la fin de la mission (art. 17 loi 1965)."
        actions={
          <>
            <Button onClick={() => push({ kind: 'info', title: 'Ordre du jour', desc: "Aperçu du projet d'ordre du jour" })}><Icon name="doc" />Ordre du jour</Button>
            <Button variant="gold" onClick={() => setOpen(true)}><Icon name="bank" />Convoquer l&apos;AG</Button>
          </>
        }
      />
      <KPIGrid
        items={[
          { icon: 'bank', num: '22/07', lbl: 'Échéance de mission', sub: 'Le Clos des Vignes (2026)', accent: 'amber' },
          { icon: 'calendar', num: '22/05', lbl: 'Convoquer avant le', sub: '2 mois avant la fin', accent: 'rust', trend: { kind: 'bad', label: 'J-18' } },
          { icon: 'users', num: 48, lbl: 'Copropriétaires à convoquer', sub: '48 lots · LRAR / électronique' },
          { icon: 'scale', num: 'Art. 25', lbl: 'Majorité de désignation', sub: 'puis 25-1, 24', accent: 'sage' },
        ]}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <Panel title="Étapes de la convocation" sub="Le Clos des Vignes — AG élective" icon="calendar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: i < STEPS.length - 1 ? '1px solid var(--v54-line)' : 'none', alignItems: 'flex-start' }}>
                <span style={stepBadge(s.st)}>{s.st === 'done' ? '✓' : s.n}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.t}</div>
                  <div style={{ fontSize: 12, color: 'var(--v54-navy-300)' }}>{s.d}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  {s.st === 'current' && <Pill kind="gold">En cours</Pill>}
                  {s.st === 'done' && <Pill kind="sage">Fait</Pill>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Projet d'ordre du jour"
          icon="doc"
          right={<Button variant="ghost" size="sm" onClick={() => push({ kind: 'success', title: 'Ordre du jour enregistré' })}>Modifier</Button>}
        >
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
            <li><b>Désignation du syndic</b> (art. 25) — candidatures</li>
            <li>Fixation de la durée du mandat et des honoraires</li>
            <li>Approbation des comptes de la période judiciaire</li>
            <li>Quitus au syndic judiciaire</li>
            <li>Vote du budget prévisionnel de l&apos;exercice</li>
            <li>Renouvellement du conseil syndical</li>
            <li>Questions diverses</li>
          </ol>
          <Alert icon="scale" title="La désignation du syndic est portée en tête de l'ordre du jour, conformément à l'objet de la mission." />
        </Panel>
      </div>
      <CreateModal
        open={open}
        onClose={() => setOpen(false)}
        title="Convoquer l'AG élective"
        icon="bank"
        fields={[
          { label: 'Copropriété', type: 'select', options: COPRO_NAMES, required: true, full: true },
          { label: "Date de l'assemblée", type: 'date', required: true },
          { label: 'Lieu', placeholder: 'Salle / visioconférence' },
          { label: "Mode d'envoi", type: 'select', options: ['LRAR', 'Voie électronique (accord exprès)', 'Remise contre émargement'] },
          { label: 'Délai de convocation', value: '21 jours francs', hint: 'Délai minimal légal' },
          { label: 'Observations', type: 'textarea', full: true, placeholder: "Précisions sur l'ordre du jour…" },
        ]}
        submitLabel="Générer la convocation"
        onDone={() => push({ kind: 'success', title: 'Convocation générée', desc: "Les convocations sont prêtes à l'envoi" })}
      />
    </>
  )
}
