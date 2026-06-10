'use client'

// Tempo — Échéances & automatisations (lot A) — port du ModTempo du mockup v8 :
// vue Assistant (AgentChatPage) + vue Tableau (KPI, prochaines exécutions,
// table des automatisations, modale de création TempoCreate locale).

import { useEffect, useRef, useState } from 'react'
import {
  AgentChatPage,
} from '@/components/syndic-dashboard/v54/primitives/agent-chat-page'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/syndic-dashboard/v54/primitives/modal'
import { Field } from '@/components/syndic-dashboard/v54/primitives/field'
import FormRow from '@/components/syndic-dashboard/v54/primitives/form-row/FormRow'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import clsx from 'clsx'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import { COPRO_NAMES } from '../data/mock'
import { agentReply } from '../lib/agent-replies'
import { FR_LABELS, frAgentHandlers } from './ModFixy'

interface TempoAuto {
  id: string
  nom: string
  type: string
  agenda: string
  last: string
  statut: string
  pill: PillKind
}

interface TempoForm {
  nom: string
  type: string
  freq: string
  agenda: string
  copro: string
}

const TEMPO_AUTOS_SEED: TempoAuto[] = [
  { id: 'a1', nom: 'Sauvegarde des documents — hebdomadaire', type: 'Sauvegarde', agenda: 'Chaque dimanche à 2 h', last: '31 mai', statut: 'Succès', pill: 'sage' },
  { id: 'a2', nom: 'Relance des impayés (plus de 30 jours)', type: 'Recouvrement', agenda: 'Chaque lundi à 10 h', last: '1 juin', statut: 'Partiel', pill: 'amber' },
  { id: 'a3', nom: 'Alerte échéance de mission (J-90)', type: 'Échéance légale', agenda: 'Quotidien à 8 h', last: '4 juin', statut: 'Succès', pill: 'sage' },
  { id: 'a4', nom: 'Rapport de gestion mensuel au tribunal', type: 'Rapport', agenda: 'Dernier jour du mois à 18 h', last: '31 mai', statut: 'Succès', pill: 'sage' },
  { id: 'a5', nom: 'Rappel de convocation AG élective (J-30)', type: 'Convocation', agenda: "30 jours avant l'AG", last: '—', statut: 'En pause', pill: 'gold' },
  { id: 'a6', nom: 'Notification des nouvelles ordonnances', type: 'Notification', agenda: 'À la désignation', last: '12 mai', statut: 'Succès', pill: 'sage' },
  { id: 'a7', nom: 'Relance de la taxation des honoraires', type: 'Taxation', agenda: 'Mensuel', last: '28 mai', statut: 'Succès', pill: 'sage' },
]

const EMPTY_FORM: TempoForm = { nom: '', type: 'Sauvegarde', freq: 'Hebdomadaire', agenda: '', copro: 'Toutes les copropriétés' }

interface NextRun {
  t: string
  w: string
  k: PillKind
  s: string
}

const NEXT_RUNS: NextRun[] = [
  { t: 'Sauvegarde des documents', w: 'dim. 7 juin · 2 h', k: 'sage', s: 'Planifié' },
  { t: 'Relance des impayés', w: 'lun. 8 juin · 10 h', k: 'amber', s: 'Planifié' },
  { t: 'Alerte échéance — Le Méridien', w: 'quotidien · 8 h', k: 'sage', s: 'Planifié' },
  { t: 'Échec : relance quotas 21 mai', w: 'à rejouer', k: 'rust', s: 'Échec' },
]

const chipIconStyle = { width: 13, height: 13, verticalAlign: '-2px', marginRight: 5 } as const

function TempoCreate({ open, onClose, onCreate }: Readonly<{ open: boolean; onClose: () => void; onCreate: (f: TempoForm) => void }>) {
  const [f, setF] = useState<TempoForm>(EMPTY_FORM)
  useEffect(() => {
    if (open) setF(EMPTY_FORM)
  }, [open])
  if (!open) return null
  const set = (k: keyof TempoForm, v: string) => setF((s) => ({ ...s, [k]: v }))
  const submit = () => {
    if (!f.nom.trim()) return
    onCreate(f)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} size="md" labelledBy="tc-t">
      <ModalHead id="tc-t" icon="bot" title="Créer une automatisation" onClose={onClose} closeLabel="Fermer" />
      <ModalBody>
        <FormRow>
          <Field label="Nom de l'automatisation" name="tc-nom" required full>
            <input type="text" value={f.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Ex. Relance des impayés supérieurs à 30 jours" />
          </Field>
          <Field label="Type" name="tc-type">
            <select value={f.type} onChange={(e) => set('type', e.target.value)}>
              {['Sauvegarde', 'Recouvrement', 'Échéance légale', 'Rapport', 'Convocation', 'Notification', 'Taxation'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>
          <Field label="Fréquence" name="tc-freq">
            <select value={f.freq} onChange={(e) => set('freq', e.target.value)}>
              {['Quotidien', 'Hebdomadaire', 'Mensuel', 'Date relative (J- avant échéance)'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>
          <Field label="Heure / déclencheur" name="tc-agenda" full>
            <input type="text" value={f.agenda} onChange={(e) => set('agenda', e.target.value)} placeholder="Ex. Chaque lundi à 10 h — ou J-30 avant l'AG" />
          </Field>
          <Field label="Périmètre" name="tc-copro" full>
            <select value={f.copro} onChange={(e) => set('copro', e.target.value)}>
              {['Toutes les copropriétés', ...COPRO_NAMES].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>
        </FormRow>
      </ModalBody>
      <ModalFoot>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="gold" onClick={submit}><Icon name="plus" />Créer l&apos;automatisation</Button>
      </ModalFoot>
    </Modal>
  )
}

export default function ModTempo() {
  const { push } = useToast()
  const [view, setView] = useState<'assistant' | 'tableau'>('assistant')
  const [autos, setAutos] = useState<TempoAuto[]>(TEMPO_AUTOS_SEED)
  const [create, setCreate] = useState(false)
  // Compteur local pour les ids des nouvelles automatisations (le mockup
  // utilisait Date.now() — proscrit ici : dates non épinglées interdites).
  const seq = useRef(0)
  const togglePause = (id: string) =>
    setAutos((a) =>
      a.map((x) =>
        x.id === id
          ? x.statut === 'En pause'
            ? { ...x, statut: 'Succès', pill: 'sage' as PillKind }
            : { ...x, statut: 'En pause', pill: 'gold' as PillKind }
          : x,
      ),
    )
  const active = autos.filter((a) => a.statut !== 'En pause').length
  const paused = autos.filter((a) => a.statut === 'En pause').length
  const addAuto = (f: TempoForm) => {
    seq.current += 1
    setAutos((a) => [
      { id: `a-n${seq.current}`, nom: f.nom.trim(), type: f.type, agenda: f.agenda.trim() || f.freq, last: '—', statut: 'Succès', pill: 'sage' },
      ...a,
    ])
    push({ kind: 'success', title: 'Automatisation créée', desc: `${f.nom.trim()} — planifiée et activée` })
  }
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button type="button" className={clsx(m.chip, view === 'assistant' && m.chipActive)} onClick={() => setView('assistant')}>
          <Icon name="bot" style={chipIconStyle} />Assistant
        </button>
        <button type="button" className={clsx(m.chip, view === 'tableau' && m.chipActive)} onClick={() => setView('tableau')}>
          <Icon name="grid" style={chipIconStyle} />Tableau
        </button>
      </div>

      {view === 'assistant' && (
        <AgentChatPage
          mascot="/tempo-avatar.png"
          name="Tempo — Échéances"
          title="Pilotage des délais légaux, échéances de mission et obligations"
          intro="Bonjour, je suis Tempo."
          introDetail="Je surveille vos échéances : fin de mission, convocation de l'AG, reddition, taxation, obligations réglementaires. 7 automatisations actives, 90 exécutions ce mois."
          contextSelector={{ label: 'Copropriété', options: COPRO_NAMES }}
          suggestions={[
            'Quelles automatisations sont actives en ce moment ?',
            'Programme un rappel mensuel des échéances légales',
            'Quelles exécutions ont échoué cette semaine ?',
            "Mets en pause les relances d'impayés",
          ]}
          inputPlaceholder="Posez une question…"
          labels={FR_LABELS}
          onAsk={(q) => agentReply('Tempo', q)}
          {...frAgentHandlers(push, 'Tempo')}
        />
      )}

      {view === 'tableau' && (
        <>
          <PageHead
            eyebrow="Automatisations"
            title="Tableau des automatisations"
            lede="Routines planifiées — sauvegardes, relances, alertes d'échéances légales, rapports mensuels. Créez de nouvelles automatisations manuellement."
            actions={<Button variant="gold" onClick={() => setCreate(true)}><Icon name="plus" />Créer une automatisation</Button>}
          />
          <KPIGrid
            items={[
              { icon: 'bolt', num: active, lbl: 'Automatisations actives', accent: 'sage' },
              { icon: 'clock', num: paused, lbl: 'En pause', accent: 'gold' },
              { icon: 'check', num: 90, lbl: 'Exécutions ce mois' },
              { icon: 'alert', num: 1, lbl: 'Échecs cette semaine', sub: 'Relance quotas 21 mai', accent: 'rust' },
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
            <Panel title="Prochaines exécutions" sub="Cette semaine" icon="clock" flush>
              {NEXT_RUNS.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--v54-line)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--v54-${e.k}-500)`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{e.t}</div>
                    <div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{e.w}</div>
                  </div>
                  <Pill kind={e.k} noDot>{e.s}</Pill>
                </div>
              ))}
            </Panel>
            <Panel
              title="Automatisations actives"
              sub={`${active} actives · ${paused} en pause · 90 exécutions ce mois`}
              icon="bot"
              right={<Button variant="gold" onClick={() => setCreate(true)}><Icon name="plus" />Créer</Button>}
              flush
            >
              <DataTable<TempoAuto>
                rowKey="id"
                columns={[
                  { h: 'Nom', render: (r) => <b style={{ fontWeight: 600 }}>{r.nom}</b> },
                  { h: 'Type', render: (r) => <span style={{ fontSize: 12.5, color: 'var(--v54-navy-500)' }}>{r.type}</span> },
                  { h: 'Agenda', render: (r) => <span style={{ fontSize: 12, color: 'var(--v54-navy-300)' }}>{r.agenda}</span> },
                  { h: 'Dernière exéc.', render: (r) => r.last },
                  { h: 'Statut', render: (r) => <Pill kind={r.pill} noDot>{r.statut}</Pill> },
                  {
                    h: '',
                    style: { width: 120, textAlign: 'right' },
                    tdStyle: { textAlign: 'right' },
                    render: (r) => (
                      <Button variant="ghost" size="sm" onClick={() => togglePause(r.id)}>
                        {r.statut === 'En pause' ? 'Activer' : 'Mettre en pause'}
                      </Button>
                    ),
                  },
                ]}
                rows={autos}
              />
            </Panel>
          </div>
          <TempoCreate open={create} onClose={() => setCreate(false)} onCreate={addAuto} />
        </>
      )}
    </>
  )
}
