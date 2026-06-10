'use client'

// Assistant de mandat — port byte-exact du MandateWizard du mockup v8.
// Saisie de l'ordonnance → computeMandatePlan génère le calendrier légal,
// les tâches par rôle et la liste d'actes à pré-rédiger (démo : toast).

import { useEffect, useState } from 'react'
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/syndic-dashboard/v54/primitives/modal'
import { Field } from '@/components/syndic-dashboard/v54/primitives/field'
import FormRow from '@/components/syndic-dashboard/v54/primitives/form-row/FormRow'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import { COPRO_NAMES } from '../data/mock'
import { computeMandatePlan, type MandatePlan } from '../lib/mandate-plan'

export interface MandateWizardProps {
  open: boolean
  onClose: () => void
}

const INIT = {
  copro: COPRO_NAMES[1] || COPRO_NAMES[0] || '',
  tribunal: 'Tribunal judiciaire de Nanterre',
  rg: 'RG 26/0',
  ordonnance: '04/06/2026',
  duree: '12',
  fondement: 'art. 46 décret du 17 mars 1967 (carence)',
}

const FONDEMENTS = [
  'art. 46 décret du 17 mars 1967 (carence)',
  'art. 29-1 loi du 10 juillet 1965 (copropriété en difficulté)',
]

export default function MandateWizard({ open, onClose }: Readonly<MandateWizardProps>) {
  const { push } = useToast()
  const [f, setF] = useState(INIT)
  const [plan, setPlan] = useState<MandatePlan | null>(null)
  useEffect(() => {
    if (open) {
      setF(INIT)
      setPlan(null)
    }
  }, [open])
  if (!open) return null
  const set = (k: keyof typeof INIT, v: string) => setF((s) => ({ ...s, [k]: v }))
  const generate = () => setPlan(computeMandatePlan(f))
  const confirm = () => {
    const p = plan || computeMandatePlan(f)
    push({
      kind: 'success',
      title: 'Mandat configuré automatiquement',
      desc: `${p.calendar.length} échéances planifiées · ${p.calendar.length} tâches créées · ${p.docs.length} actes pré-rédigés`,
    })
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} size="lg" labelledBy="mw-t">
      <ModalHead id="mw-t" icon="scale" title="Assistant de mandat — auto-planification" onClose={onClose} closeLabel="Fermer" />
      <ModalBody>
        <p style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', margin: '0 0 16px' }}>
          Saisissez l'ordonnance : le calendrier légal, les tâches par rôle et les actes à pré-rédiger sont calculés et mis en place automatiquement.
        </p>
        <FormRow>
          <Field label="Copropriété" name="mw-copro" full>
            <select value={f.copro} onChange={(e) => set('copro', e.target.value)}>
              {[...COPRO_NAMES, '+ Nouvelle copropriété'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>
          <Field label="Tribunal" name="mw-trib">
            <input type="text" value={f.tribunal} onChange={(e) => set('tribunal', e.target.value)} />
          </Field>
          <Field label="N° RG" name="mw-rg">
            <input type="text" value={f.rg} onChange={(e) => set('rg', e.target.value)} />
          </Field>
          <Field label="Date de l'ordonnance" name="mw-date">
            <input type="text" value={f.ordonnance} onChange={(e) => set('ordonnance', e.target.value)} placeholder="JJ/MM/AAAA" />
          </Field>
          <Field label="Durée (mois)" name="mw-duree">
            <input type="text" value={f.duree} onChange={(e) => set('duree', e.target.value)} />
          </Field>
          <Field label="Fondement" name="mw-fond" full>
            <select value={f.fondement} onChange={(e) => set('fondement', e.target.value)}>
              {FONDEMENTS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>
        </FormRow>
        {!plan && (
          <Button variant="gold" style={{ marginTop: 6 }} onClick={generate}>
            <Icon name="sparkle" aria-hidden />Générer le plan automatiquement
          </Button>
        )}
        {plan && (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <Pill kind="sage" noDot>Plan généré</Pill>
              <span style={{ fontSize: 12, color: 'var(--v54-navy-500)' }}>
                Fin de mission calculée : <b>{plan.ech}</b>
              </span>
            </div>
            <div style={{ background: 'var(--v54-paper)', border: '1px solid var(--v54-line)', borderRadius: 10, overflow: 'hidden' }}>
              {plan.calendar.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: i < plan.calendar.length - 1 ? '1px solid var(--v54-line)' : 'none',
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background: 'var(--v54-cream)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--v54-navy-700)',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{c.basis} · {c.role}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--v54-font-mono)', fontSize: 12, color: 'var(--v54-navy-700)', fontWeight: 600 }}>{c.date}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Pill kind="dark" noDot>{plan.calendar.length} tâches créées</Pill>
              <Pill kind="gold" noDot>{plan.docs.length} actes pré-rédigés</Pill>
              <span style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', alignSelf: 'center' }}>{plan.docs.join(' · ')}</span>
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFoot>
        <Button onClick={onClose}>Annuler</Button>
        {plan ? (
          <Button variant="gold" onClick={confirm}>
            <Icon name="check" aria-hidden />Confirmer la mise en place
          </Button>
        ) : (
          <Button onClick={generate}>
            <Icon name="sparkle" aria-hidden />Générer le plan
          </Button>
        )}
      </ModalFoot>
    </Modal>
  )
}
