'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Tabs } from '@/components/syndic-dashboard/v54/primitives/tabs'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Field } from '@/components/syndic-dashboard/v54/primitives/field'
import { FormRow } from '@/components/syndic-dashboard/v54/primitives/form-row'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'
import { COPRO_NAMES } from '../data/mock'

/** Messages aux copropriétaires — port FR du ModWhatsapp du mockup v8
 * (composer SMS/e-mail 2 colonnes + modèles de messages + journal des envois). */

const SMS_TPL: Record<string, string> = {
  '': '',
  'Convocation AG': 'Bonjour, vous êtes convoqué(e) à l\'assemblée générale du [date] à [heure]. Convocation et pouvoirs envoyés par courrier.',
  'Rappel impayé': 'Bonjour, nous vous rappelons que des charges de copropriété restent dues. Merci de régulariser votre situation.',
  'Travaux': 'Bonjour, des travaux auront lieu du [date] au [date]. Merci de votre compréhension pour la gêne occasionnée.',
}

/** [objet, copropriété, destinataires, canal, statut] */
type SmsLog = [string, string, string, string, string]
const SMS_LOG: SmsLog[] = [
  ['Convocation AG', 'Le Clos des Vignes', '48 destinataires', 'SMS', 'distribué'],
  ['Rappel impayé', 'Les Tilleuls', '3 destinataires', 'Email', 'lu'],
  ['Travaux toiture', 'Les Tilleuls', '24 destinataires', 'SMS', 'distribué'],
]

export default function ModSMS() {
  const { push } = useToast()
  const [chan, setChan] = useState('SMS')
  const [tpl, setTpl] = useState('')
  const [msg, setMsg] = useState('')
  const [copro, setCopro] = useState(COPRO_NAMES[0])
  return (
    <>
      <PageHead eyebrow="Gestion courante" title="Messages aux copropriétaires"
        lede="SMS et e-mail : messages, modèles et envois en masse." />
      <Tabs defaultActive="msg" tabs={[
        { id: 'msg', icon: 'chat', label: 'Messages' },
        { id: 'mod', icon: 'clipboard', label: 'Modèles' },
        { id: 'env', icon: 'mail', label: 'Envoi en masse' },
        { id: 'cfg', icon: 'wrench', label: 'Configuration' },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        <Panel title="Destinataires" icon="users">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['SMS', 'Email'].map(c => (
              <button key={c} type="button" className={clsx(m.chip, chan === c && m.chipActive)} onClick={() => setChan(c)}>{c}</button>
            ))}
          </div>
          <FormRow>
            <Field label="Copropriété" name="sms-copro">
              <select value={copro} onChange={e => setCopro(e.target.value)}>
                {COPRO_NAMES.map(n => <option key={n}>{n}</option>)}
              </select>
            </Field>
          </FormRow>
          <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', marginTop: 8 }}>Tous les copropriétaires de <b>{copro}</b> recevront le message par {chan}.</div>
        </Panel>
        <Panel title="Composer le message" icon="chat">
          <FormRow>
            <Field label="Modèle" name="sms-tpl">
              <select value={tpl} onChange={e => { setTpl(e.target.value); setMsg(SMS_TPL[e.target.value] || '') }}>
                <option value="">— Aucun —</option>
                {Object.keys(SMS_TPL).filter(Boolean).map(k => <option key={k}>{k}</option>)}
              </select>
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Message" full name="sms-msg">
              <textarea rows={5} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Votre message…" style={{ width: '100%', resize: 'vertical' }} />
            </Field>
          </FormRow>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{msg.length} caractères</span>
            <Button variant="gold" onClick={() => {
              if (!msg.trim()) { push({ kind: 'info', title: 'Message vide' }); return }
              push({ kind: 'success', title: 'Envoyé', desc: `${chan} envoyé aux copropriétaires de ${copro}` })
            }}><Icon name="mail" />Envoyer</Button>
          </div>
        </Panel>
      </div>
      <div style={{ height: 14 }} />
      <Panel title="Derniers envois" icon="mail" flush>
        <DataTable<SmsLog> columns={[
          { h: 'Objet', render: r => <b>{r[0]}</b> },
          { h: 'Copropriété', render: r => r[1] },
          { h: 'Destinataires', render: r => r[2] },
          { h: 'Canal', render: r => <Pill noDot>{r[3]}</Pill> },
          { h: 'Statut', render: r => <Pill kind={r[4] === 'lu' ? 'sage' : 'gold'} noDot>{r[4]}</Pill> },
        ]} rows={SMS_LOG} />
      </Panel>
    </>
  )
}
