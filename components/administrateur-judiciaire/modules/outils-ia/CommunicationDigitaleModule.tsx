'use client'

import { useState } from 'react'
import {
  DEMO_MESSAGES_COMMUNICATION_DIGITALE,
  type MessageCommunicationDigitale,
} from '@/components/administrateur-judiciaire/data/communication-digitale'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Communication digitale (barre latérale : section Outils IA ; surtitre « Gestion courante »).
 * Indicateurs en dur (6 envoyés, 1 en attente, 2 distribués, 3 lus) sans rapport avec les 4 messages listés :
 * incohérence de la maquette, conservée. « Nouveau message » ouvre un formulaire simulé (toast « Message envoyé »).
 */
export function CommunicationDigitaleModule() {
  const { push } = useToast()
  const [messageOuvert, setMessageOuvert] = useState<MessageCommunicationDigitale | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Gestion courante"
        title="Communication digitale"
        lede="Messages internes et communication avec les intervenants."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'chat',
                title: 'Nouveau message',
                fields: [
                  {
                    label: 'Destinataire',
                    placeholder: 'Artisan, copropriétaire…',
                    full: true,
                  },
                  {
                    label: 'Objet',
                    placeholder: 'Objet',
                    full: true,
                  },
                  {
                    label: 'Message',
                    type: 'textarea',
                    placeholder: 'Votre message…',
                    full: true,
                  },
                ],
                submitLabel: 'Envoyer',
                toast: {
                  title: 'Message envoyé',
                },
              })
            }
          >
            <Icon name="mail" />
            Nouveau message
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'chart',
            num: 6,
            lbl: 'Total envoyés',
          },
          {
            icon: 'mail',
            num: 1,
            lbl: 'En attente',
            accent: 'amber',
          },
          {
            icon: 'check',
            num: 2,
            lbl: 'Distribués',
            accent: 'gold',
          },
          {
            icon: 'check',
            num: 3,
            lbl: 'Lus',
            accent: 'sage',
          },
        ]}
      />
      <Panel title="Messages" icon="mail" flush>
        <DataTable
          columns={[
            {
              h: 'Objet',
              render: (message) => <b>{message[0]}</b>,
            },
            {
              h: 'Destinataire',
              render: (message) => message[1],
            },
            {
              h: 'Date',
              render: (message) => <span className="mono">{message[2]}</span>,
            },
            {
              h: 'Statut',
              render: (message) => (
                <Pill kind={message[3] === 'lu' ? 'sage' : message[3] === 'distribué' ? 'gold' : 'amber'} noDot>
                  {message[3]}
                </Pill>
              ),
            },
          ]}
          rows={DEMO_MESSAGES_COMMUNICATION_DIGITALE}
          onRow={setMessageOuvert}
        />
      </Panel>
      <DetailModal
        open={!!messageOuvert}
        onClose={() => setMessageOuvert(null)}
        title={messageOuvert ? messageOuvert[0] : ''}
        icon="mail"
        fields={
          messageOuvert
            ? [
                {
                  k: 'Destinataire',
                  v: messageOuvert[1],
                },
                {
                  k: 'Date',
                  v: messageOuvert[2],
                },
                {
                  k: 'Statut',
                  v: messageOuvert[3],
                },
              ]
            : []
        }
      />
    </>
  )
}
