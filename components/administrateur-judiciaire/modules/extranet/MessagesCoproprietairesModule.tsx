'use client'

import { useState } from 'react'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import {
  DEMO_ENVOIS_MESSAGES_COPROPRIETAIRES,
  MODELES_MESSAGES_COPROPRIETAIRES,
  type EnvoiMessageCoproprietaires,
} from '@/components/administrateur-judiciaire/data/messages-coproprietaires'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { Tabs } from '@/components/administrateur-judiciaire/ui/Tabs'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/** Canal d'envoi des messages aux copropriétaires. */
export type CanalMessageCoproprietaires = EnvoiMessageCoproprietaires[3]

/** Canaux proposés, dans l'ordre des puces. */
const CANAUX_MESSAGE: readonly CanalMessageCoproprietaires[] = ['SMS', 'Email']

/**
 * Messages aux copropriétaires (barre latérale : « WhatsApp / SMS » ; surtitre « Gestion courante »).
 * L'envoi est simulé : un message vide affiche « Message vide », sinon un toast « Simulation » précise
 * qu'aucun message n'a été envoyé. Onglets autonomes ; le tableau des derniers envois n'est pas cliquable.
 */
export function MessagesCoproprietairesModule() {
  const { push } = useToast()
  const [canal, setCanal] = useState<CanalMessageCoproprietaires>('SMS')
  const [modele, setModele] = useState('')
  const [message, setMessage] = useState('')
  const [copropriete, setCopropriete] = useState(DEMO_NOMS_COPROPRIETES[0])

  return (
    <>
      <PageHead
        eyebrow="Gestion courante"
        title="Messages aux copropriétaires"
        lede="SMS et e-mail : messages, modèles et envois en masse."
      />
      <Tabs
        defaultActive="msg"
        tabs={[
          {
            id: 'msg',
            icon: 'chat',
            label: 'Messages',
          },
          {
            id: 'mod',
            icon: 'clipboard',
            label: 'Modèles',
          },
          {
            id: 'env',
            icon: 'mail',
            label: 'Envoi en masse',
          },
          {
            id: 'cfg',
            icon: 'wrench',
            label: 'Configuration',
          },
        ]}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: 16,
        }}
      >
        <Panel title="Destinataires" icon="users">
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 12,
            }}
          >
            {CANAUX_MESSAGE.map((canalPropose) => (
              <button
                className={`chip ${canal === canalPropose ? 'active' : ''}`}
                onClick={() => setCanal(canalPropose)}
                key={canalPropose}
              >
                {canalPropose}
              </button>
            ))}
          </div>
          <FieldRow>
            <Field label="Copropriété">
              <select
                aria-label="Copropriété"
                value={copropriete}
                onChange={(evenement) => setCopropriete(evenement.target.value)}
              >
                {DEMO_NOMS_COPROPRIETES.map((nom) => (
                  <option key={nom}>{nom}</option>
                ))}
              </select>
            </Field>
          </FieldRow>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--navy-500)',
              marginTop: 8,
            }}
          >
            {'Tous les copropriétaires de '}
            <b>{copropriete}</b>
            {' recevront le message par '}
            {canal}.
          </div>
        </Panel>
        <Panel title="Composer le message" icon="chat">
          <FieldRow>
            <Field label="Modèle">
              <select
                aria-label="Modèle de message"
                value={modele}
                onChange={(evenement) => {
                  setModele(evenement.target.value)
                  setMessage(MODELES_MESSAGES_COPROPRIETAIRES[evenement.target.value] || '')
                }}
              >
                <option value="">— Aucun —</option>
                {Object.keys(MODELES_MESSAGES_COPROPRIETAIRES)
                  .filter(Boolean)
                  .map((intitule) => (
                    <option key={intitule}>{intitule}</option>
                  ))}
              </select>
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Message" full>
              <textarea
                aria-label="Message"
                rows={5}
                value={message}
                onChange={(evenement) => setMessage(evenement.target.value)}
                placeholder="Votre message…"
                style={{
                  width: '100%',
                  resize: 'vertical',
                }}
              />
            </Field>
          </FieldRow>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 11.5,
                color: 'var(--navy-300)',
              }}
            >
              {message.length}
              {' caractères'}
            </span>
            <button
              className="btn gold"
              onClick={() => {
                if (!message.trim()) {
                  push({
                    kind: 'info',
                    title: 'Message vide',
                  })
                  return
                }
                push({
                  kind: 'success',
                  title: 'Simulation',
                  desc: `Aucun ${canal} n'a été envoyé aux copropriétaires de ${copropriete}.`,
                })
              }}
            >
              <Icon name="mail" />
              Envoyer
            </button>
          </div>
        </Panel>
      </div>
      <div
        style={{
          height: 14,
        }}
      />
      <Panel title="Derniers envois" icon="mail" flush>
        <DataTable
          columns={[
            {
              h: 'Objet',
              render: (envoi) => <b>{envoi[0]}</b>,
            },
            {
              h: 'Copropriété',
              render: (envoi) => envoi[1],
            },
            {
              h: 'Destinataires',
              render: (envoi) => envoi[2],
            },
            {
              h: 'Canal',
              render: (envoi) => <Pill noDot>{envoi[3]}</Pill>,
            },
            {
              h: 'Statut',
              render: (envoi) => (
                <Pill kind={envoi[4] === 'lu' ? 'sage' : 'gold'} noDot>
                  {envoi[4]}
                </Pill>
              ),
            },
          ]}
          rows={DEMO_ENVOIS_MESSAGES_COPROPRIETAIRES}
        />
      </Panel>
    </>
  )
}
