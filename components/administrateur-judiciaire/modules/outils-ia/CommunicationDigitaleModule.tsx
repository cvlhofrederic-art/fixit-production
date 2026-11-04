'use client'

import { useState } from 'react'
import {
  DEMO_MESSAGES_COMMUNICATION_DIGITALE,
  type MessageCommunicationDigitale,
} from '@/components/administrateur-judiciaire/data/communication-digitale'
import { avecChampCopro, titreListeVide, useCoproChoisie } from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast, type ChampFormulaireToast } from '@/components/administrateur-judiciaire/ui/toast'
import { codeLigneDemo, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/** Indicateurs de l'écran : messages envoyés, en attente, distribués, lus. */
interface CompteursMessages {
  total: number
  enAttente: number
  distribues: number
  lus: number
}

/** Indicateurs en dur de la maquette, sans rapport avec les messages listés (affichés sans copropriété choisie). */
const COMPTEURS_MAQUETTE: CompteursMessages = { total: 6, enAttente: 1, distribues: 2, lus: 3 }

/** Indicateurs calculés sur les messages affichés. */
function compterMessages(messages: readonly MessageCommunicationDigitale[]): CompteursMessages {
  const nombre = (statut: MessageCommunicationDigitale[3]) => messages.filter((message) => message[3] === statut).length
  return { total: messages.length, enAttente: nombre('en attente'), distribues: nombre('distribué'), lus: nombre('lu') }
}

/** Couleur de la pastille de statut d'un message (ambre pour tout autre statut). */
const COULEUR_STATUT_MESSAGE: Readonly<Partial<Record<string, string>>> = { lu: 'sage', distribué: 'gold' }

/** Champs du formulaire « Nouveau message ». */
const CHAMPS_NOUVEAU_MESSAGE: readonly ChampFormulaireToast[] = [
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
]

/**
 * Communication digitale (barre latérale : section Outils IA ; surtitre « Gestion courante »).
 * Sans copropriété choisie en haut de page : tous les messages et les indicateurs en dur de la maquette (6 envoyés,
 * 1 en attente, 2 distribués, 3 lus, sans rapport avec les 4 messages listés : incohérence conservée). Avec une
 * copropriété choisie : ses messages, des indicateurs calculés sur eux, et la copropriété proposée dans le formulaire.
 * « Nouveau message » ouvre un formulaire simulé (toast « Message envoyé »).
 */
export function CommunicationDigitaleModule() {
  const { push } = useToast()
  const [messageOuvert, setMessageOuvert] = useState<MessageCommunicationDigitale | null>(null)
  const { code, nom: nomCopro } = useCoproChoisie()
  const messages = filtrerParCopro(DEMO_MESSAGES_COMMUNICATION_DIGITALE, code, (message) => codeLigneDemo(message[4]))
  const compteurs = code ? compterMessages(messages) : COMPTEURS_MAQUETTE

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
                fields: avecChampCopro(CHAMPS_NOUVEAU_MESSAGE, nomCopro),
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
            num: compteurs.total,
            lbl: 'Total envoyés',
          },
          {
            icon: 'mail',
            num: compteurs.enAttente,
            lbl: 'En attente',
            accent: 'amber',
          },
          {
            icon: 'check',
            num: compteurs.distribues,
            lbl: 'Distribués',
            accent: 'gold',
          },
          {
            icon: 'check',
            num: compteurs.lus,
            lbl: 'Lus',
            accent: 'sage',
          },
        ]}
      />
      <Panel title="Messages" icon="mail" flush>
        {code && messages.length === 0 ? (
          <EmptyState icon="mail" title={titreListeVide('Aucun message', nomCopro)} />
        ) : (
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
                  <Pill kind={COULEUR_STATUT_MESSAGE[message[3]] ?? 'amber'} noDot>
                    {message[3]}
                  </Pill>
                ),
              },
            ]}
            rows={messages}
            onRow={setMessageOuvert}
          />
        )}
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
