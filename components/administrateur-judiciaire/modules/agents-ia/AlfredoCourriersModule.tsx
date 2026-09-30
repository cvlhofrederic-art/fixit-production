'use client'

/* eslint-disable @next/next/no-img-element -- fidélité DOM : mascotte en <img> simple, comme dans la maquette */

import { useState } from 'react'
import {
  DEMO_COURRIELS_ALFREDO,
  type CourrielAlfredo,
} from '@/components/administrateur-judiciaire/data/courriels-alfredo'
import { AVATARS_AGENTS } from '@/components/administrateur-judiciaire/ui/avatars'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Alfredo — Courriers (démo) : boîte e-mail connectée du cabinet, messages reçus (sélectionner un message le marque
 * lu), fil de l'échange et brouillon de réponse proposé. Envoi, modification et régénération sont simulés.
 */
export function AlfredoCourriersModule() {
  const { push } = useToast()
  const [courriels, setCourriels] = useState<CourrielAlfredo[]>(DEMO_COURRIELS_ALFREDO)
  const [idSelectionne, setIdSelectionne] = useState('e1')
  const courriel = courriels.find((candidat) => candidat.id === idSelectionne) || courriels[0]

  const selectionner = (id: string) => {
    setIdSelectionne(id)
    setCourriels((liste) =>
      liste.map((element) =>
        element.id === id
          ? {
              ...element,
              unread: false,
            }
          : element,
      ),
    )
  }

  const nbNonLus = courriels.filter((element) => element.unread).length

  return (
    <>
      <PageHead
        eyebrow="Agents IA · Courriers"
        title="Alfredo — Courriers"
        lede="Boîte e-mail connectée du cabinet. Alfredo lit les messages des copropriétaires et propose un brouillon de réponse, prêt à relire et envoyer."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'mail',
                title: 'Nouveau courrier',
                fields: [
                  {
                    label: 'Destinataire',
                    placeholder: 'Copropriétaire, conseil syndical…',
                    full: true,
                  },
                  {
                    label: 'Objet',
                    full: true,
                  },
                  {
                    label: 'Message',
                    type: 'textarea',
                    rows: 4,
                    placeholder: 'Alfredo peut aussi rédiger pour vous…',
                    full: true,
                  },
                ],
                submitLabel: 'Envoyer',
                toast: {
                  title: 'Courrier envoyé',
                },
              })
            }
          >
            <Icon name="pencil" />
            Nouveau courrier
          </button>
        }
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
          fontSize: 13,
          color: 'var(--navy-500)',
        }}
      >
        <img
          src={AVATARS_AGENTS.alfredo}
          alt=""
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
          }}
        />
        <span>
          {'Boîte connectée : '}
          <b>direction@cabinet-delaunay.fr</b>
        </span>
        <Pill kind="amber" noDot>
          {nbNonLus}
          {' non lus'}
        </Pill>
      </div>
      <div className="alf-grid">
        <div className="alf-list" role="list" aria-label="Messages reçus">
          {courriels.map((element) => (
            <button
              type="button"
              className={`alf-item ${idSelectionne === element.id ? 'active' : ''}`}
              onClick={() => selectionner(element.id)}
              aria-current={idSelectionne === element.id ? 'true' : undefined}
              key={element.id}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 3,
                }}
              >
                {element.unread && (
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--gold-500)',
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    fontWeight: element.unread ? 700 : 600,
                    fontSize: 13,
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {element.from}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--navy-300)',
                    flexShrink: 0,
                  }}
                >
                  {element.date}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: element.unread ? 600 : 500,
                  marginBottom: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {element.subject}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Pill kind={element.tagk} noDot>
                  {element.tag}
                </Pill>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--navy-300)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {element.copro}
                </span>
              </div>
            </button>
          ))}
        </div>
        <div className="alf-pane">
          <div
            style={{
              borderBottom: '1px solid var(--line)',
              paddingBottom: 14,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontFamily: 'Cormorant Garamond,serif',
                fontSize: 22,
                lineHeight: 1.2,
                marginBottom: 6,
              }}
            >
              {courriel.subject}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12.5,
                color: 'var(--navy-500)',
              }}
            >
              <span
                className="team-dd-avatar accent-sage"
                style={{
                  width: 30,
                  height: 30,
                  fontSize: 11,
                }}
              >
                {courriel.init}
              </span>
              <div>
                <b>{courriel.from}</b>
                {' · '}
                {courriel.email}
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--navy-300)',
                  }}
                >
                  {courriel.copro}
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gap: 12,
              marginBottom: 20,
            }}
          >
            {courriel.thread.map((message, index) => (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: message.who === 'me' ? 'flex-end' : 'flex-start',
                }}
                key={index}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--navy-300)',
                    marginBottom: 3,
                  }}
                >
                  {message.who === 'me' ? 'Cabinet Delaunay' : courriel.from}
                  {' · '}
                  {message.when}
                </div>
                <div
                  className={`alf-bubble ${message.who === 'me' ? 'me' : ''}`}
                  style={{
                    maxWidth: '85%',
                  }}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>
          <div className="alf-draft">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <img
                src={AVATARS_AGENTS.alfredo}
                alt=""
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                }}
              />
              <b
                style={{
                  fontSize: 12.5,
                }}
              >
                Brouillon proposé par Alfredo
              </b>
              <Pill kind="gold" noDot>
                IA
              </Pill>
            </div>
            {courriel.draft}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 14,
              flexWrap: 'wrap',
            }}
          >
            <button
              className="btn gold"
              onClick={() =>
                push({
                  kind: 'success',
                  title: 'Simulation',
                  desc: "Aucun message n'a été envoyé à " + courriel.from,
                })
              }
            >
              <Icon name="arrow" />
              Envoyer la réponse
            </button>
            <button
              className="btn"
              onClick={() =>
                push({
                  kind: 'form',
                  icon: 'pencil',
                  title: 'Modifier le brouillon',
                  fields: [
                    {
                      label: 'Réponse',
                      type: 'textarea',
                      rows: 8,
                      value: courriel.draft,
                      full: true,
                    },
                  ],
                  submitLabel: 'Enregistrer',
                  toast: {
                    title: 'Brouillon mis à jour',
                  },
                })
              }
            >
              <Icon name="pencil" />
              Modifier
            </button>
            <button
              className="btn ghost"
              onClick={() =>
                push({
                  kind: 'info',
                  title: 'Nouveau brouillon',
                  desc: 'Alfredo régénère une proposition',
                })
              }
            >
              <Icon name="refresh" />
              Régénérer
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
