'use client'

/* eslint-disable @next/next/no-img-element -- fidélité DOM : photo du signalement en <img> simple, comme dans la maquette */

import { useState } from 'react'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import {
  COULEUR_POINT_MISSION,
  DEMO_MISSIONS_CANAL,
  type MessageMission,
  type MissionCanal,
} from '@/components/administrateur-judiciaire/data/missions-canal'
import { DEMO_PRESTATAIRES } from '@/components/administrateur-judiciaire/data/prestataires'
import {
  FilMissionFuiteColonne,
  type WorkflowMissionFuite,
} from '@/components/administrateur-judiciaire/modules/gestion/canal/FilMissionFuiteColonne'
import { VignettePhotoMission } from '@/components/administrateur-judiciaire/modules/gestion/canal/VignettePhotoMission'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { Toggle } from '@/components/administrateur-judiciaire/ui/Toggle'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { etapesWorkflowMissionFuite } from '@/lib/administrateur-judiciaire/domain/ordre-mission'

/** Filtre de la liste des ordres de mission. */
type FiltreMissions = 'all' | 'unread'

/** Fils de messages par identifiant de mission. */
type MessagesParMission = Record<string, MessageMission[]>

/** Workflows suivis par mission (seule la mission « mfuite » en a un). */
interface WorkflowsMissions {
  mfuite?: WorkflowMissionFuite
}

/** Saisie de l'assistant « Nouvel ordre de mission ». */
interface SaisieOrdreMission {
  pro: string
  area: string
  building: string
  batiment: string
  etage: string
  gardien: string
  tel: string
  code: string
  origine: string
  photos: boolean
  desc: string
  date: string
}

/** Saisie de la modale « Dispatcher l'ordre de mission ». */
interface SaisieDispatch {
  prestataire: string
  technicien: string
  date: string
  heure: string
}

const ORIGINES_DEMANDE = ['Gardien — via app', 'Copropriétaire — via app', 'Conseil syndical', 'Cabinet (constat direct)']

const HEURES_INTERVENTION = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']

/**
 * Suffixe aléatoire d'un identifiant de mission : entier de 0 à 999, la plage du tirage de la maquette
 * (Math.floor(Math.random() * 1e3)), tiré avec crypto.getRandomValues comme les identifiants de la base locale.
 */
const tirerSuffixeMission = (): number => crypto.getRandomValues(new Uint32Array(1))[0] % 1e3

/**
 * Canal de communication : ordres de mission, du signalement (gardien ou copropriétaire via l'app) au dispatch vers
 * l'artisan puis à la validation de la mission. Données de démonstration, actions simulées.
 */
export function CanalCommunicationModule() {
  const { push } = useToast()
  const [missions, setMissions] = useState<MissionCanal[]>(DEMO_MISSIONS_CANAL)
  const [missionActiveId, setMissionActiveId] = useState('mfuite')
  const [brouillon, setBrouillon] = useState('')
  const [filtre, setFiltre] = useState<FiltreMissions>('all')
  const [messagesParMission, setMessagesParMission] = useState<MessagesParMission>(() => {
    const messages: MessagesParMission = {}
    DEMO_MISSIONS_CANAL.forEach((mission) => {
      messages[mission.id] = mission.msgs.slice()
    })
    return messages
  })
  const [assistantOuvert, setAssistantOuvert] = useState(false)
  // Valeurs par défaut de l'assistant, recalculées à chaque rendu (comme dans la maquette).
  const saisieOrdreParDefaut: SaisieOrdreMission = {
    pro: DEMO_PRESTATAIRES[0].nom,
    area: DEMO_PRESTATAIRES[0].metier,
    building: DEMO_NOMS_COPROPRIETES[0],
    batiment: '',
    etage: '',
    gardien: '',
    tel: '',
    code: '',
    origine: 'Gardien — via app',
    photos: true,
    desc: '',
    date: '',
  }
  const [saisieOrdre, setSaisieOrdre] = useState<SaisieOrdreMission>(saisieOrdreParDefaut)
  const [workflows, setWorkflows] = useState<WorkflowsMissions>({
    mfuite: {
      state: 'signale',
    },
  })
  const [dispatchOuvert, setDispatchOuvert] = useState(false)
  const saisieDispatchParDefaut: SaisieDispatch = {
    prestataire: 'Atlantic Plomberie SARL',
    technicien: 'Équipe Atlantic (2 techniciens)',
    date: '19/06/2026',
    heure: '14:00',
  }
  const [saisieDispatch, setSaisieDispatch] = useState<SaisieDispatch>(saisieDispatchParDefaut)

  const validerDispatch = () => {
    setWorkflows((precedents) => ({
      ...precedents,
      mfuite: {
        state: 'reported',
        ...saisieDispatch,
      },
    }))
    setDispatchOuvert(false)
    push({
      kind: 'success',
      title: 'Simulation',
      desc: "Aucun ordre n'a été transmis à " + saisieDispatch.prestataire + '.',
    })
  }

  const transmettreComptabilite = () => {
    setWorkflows((precedents) => ({
      ...precedents,
      mfuite: {
        ...(precedents.mfuite || {}),
        state: 'compta',
      },
    }))
    push({
      kind: 'success',
      title: 'Simulation',
      desc: "Aucune transmission à la comptabilité n'a eu lieu.",
    })
  }

  const missionActive = missions.find((mission) => mission.id === missionActiveId) || missions[0]
  const missionsAffichees = filtre === 'unread' ? missions.filter((mission) => mission.unread > 0) : missions

  const envoyerMessage = () => {
    const texte = brouillon.trim()
    if (texte) {
      setMessagesParMission((precedents) => ({
        ...precedents,
        [missionActiveId]: [...(precedents[missionActiveId] || []), ['Vous', "À l'instant", texte, 'me']],
      }))
      setBrouillon('')
    }
  }

  /** Changer d'artisan recopie son métier. */
  const choisirArtisan = (nom: string) => {
    const prestataire = DEMO_PRESTATAIRES.find((candidat) => candidat.nom === nom) || DEMO_PRESTATAIRES[0]
    setSaisieOrdre((precedente) => ({
      ...precedente,
      pro: nom,
      area: prestataire.metier,
    }))
  }

  const creerOrdreMission = () => {
    if (!saisieOrdre.desc.trim()) {
      push({
        kind: 'info',
        title: 'Description requise',
        desc: "Décrivez l'intervention demandée.",
      })
      return
    }
    // Identifiant non déterministe, comme dans la maquette (même plage de tirage). Correctif d'un défaut hérité de la
    // maquette : on tire à nouveau tant que l'identifiant désigne une mission existante. Une collision (environ une
    // chance sur mille dès la deuxième création) effaçait le fil de messages de l'ancienne mission, dupliquait la clé
    // React et rendait l'ancienne carte inaccessible (find renvoyait la nouvelle). Une valeur libre existe toujours :
    // au plus 999 missions créées ont pu tirer dans la plage courante, qui compte mille valeurs.
    let id = 'm' + (missions.length + 1 + tirerSuffixeMission())
    while (missions.some((mission) => mission.id === id)) id = 'm' + (missions.length + 1 + tirerSuffixeMission())
    const initialesArtisan = saisieOrdre.pro
      .split(/\s+/)
      .slice(0, 2)
      .map((mot) => mot[0])
      .join('')
      .toUpperCase()
    const nouvelleMission: MissionCanal = {
      id,
      dot: 'gold',
      title:
        saisieOrdre.area.split('/')[0].trim() +
        ' — ' +
        saisieOrdre.building.replace('Résidence ', '').replace('Copropriété ', ''),
      sub: saisieOrdre.pro,
      tags: ['Ordre', 'Transmis'],
      unread: 0,
      area: saisieOrdre.area,
      pro: saisieOrdre.pro,
      proInit: initialesArtisan,
      building: saisieOrdre.building,
      batiment: saisieOrdre.batiment || '—',
      etage: saisieOrdre.etage || '—',
      gardien: saisieOrdre.gardien || '—',
      gardienTel: saisieOrdre.tel || '—',
      code: saisieOrdre.code || '—',
      origine: saisieOrdre.origine,
      date: saisieOrdre.date || 'à planifier',
      duration: '—',
      desc: saisieOrdre.desc.trim(),
      photos: saisieOrdre.photos ? ['Photo signalement 1', 'Photo signalement 2'] : [],
      parts: [
        ['ML', 'Marc Léautaud', 'Gestionnaire technique', 'on'],
        [initialesArtisan, saisieOrdre.pro.split(' ')[0], 'Artisan', ''],
      ],
      steps: [
        ['Signalement (app)', "Aujourd'hui", 'done'],
        ['Dispatch gestionnaire', "Aujourd'hui", 'now'],
        ['Intervention artisan', '—', 'todo'],
        ['Validation artisan', '—', 'todo'],
      ],
      msgs: [],
    }
    setMissions((precedentes) => [nouvelleMission, ...precedentes])
    setMessagesParMission((precedents) => ({
      ...precedents,
      [id]: [],
    }))
    setMissionActiveId(id)
    setAssistantOuvert(false)
    setSaisieOrdre(saisieOrdreParDefaut)
    push({
      kind: 'success',
      title: 'Simulation',
      desc: "Aucun ordre de mission n'a été transmis.",
    })
  }

  const etapesAffichees =
    missionActive.id === 'mfuite'
      ? etapesWorkflowMissionFuite(workflows.mfuite && workflows.mfuite.state)
      : missionActive.steps

  return (
    <>
      <PageHead
        eyebrow="Gestion courante"
        title="Canal de communication"
        lede="Du signalement (gardien ou copropriétaire via l'app) au dispatch vers l'artisan, jusqu'à la validation de la mission."
        actions={
          <button className="btn gold" onClick={() => setAssistantOuvert(true)}>
            <Icon name="plus" />
            Nouvel ordre de mission
          </button>
        }
      />
      <div className="canal-grid">
        <div className="canal-missions-col">
          <div className="canal-missions-head">
            <span className="canal-missions-label">Ordres de mission</span>
            <div className="canal-search">
              <Icon name="search" />
              <input aria-label="Rechercher un ordre" placeholder="Rechercher…" />
            </div>
          </div>
          <div className="canal-missions-subtabs">
            <button className={`canal-chip ${filtre === 'all' ? 'active' : ''}`} onClick={() => setFiltre('all')}>
              {'Tous '}
              <span className="canal-chip-count">{missions.length}</span>
            </button>
            <button className={`canal-chip ${filtre === 'unread' ? 'active' : ''}`} onClick={() => setFiltre('unread')}>
              {'Non lus '}
              <span className="canal-chip-count">{missions.filter((mission) => mission.unread).length}</span>
            </button>
          </div>
          <div className="canal-missions-list">
            {missionsAffichees.map((mission) => (
              <button
                type="button"
                className={`canal-mission-card ${missionActiveId === mission.id ? 'active' : ''}`}
                onClick={() => setMissionActiveId(mission.id)}
                aria-current={missionActiveId === mission.id ? 'true' : undefined}
                key={mission.id}
              >
                <div className="canal-mission-title">{mission.title}</div>
                <div className="canal-mission-sub">
                  <span
                    className="canal-mission-dot"
                    style={{
                      background: COULEUR_POINT_MISSION[mission.dot],
                    }}
                  />
                  {mission.sub}
                </div>
                <div className="canal-mission-tags">
                  {mission.tags.map((tag, index) => (
                    <Pill noDot key={index}>
                      {tag}
                    </Pill>
                  ))}
                </div>
                {mission.unread > 0 && <span className="canal-mission-unread">{mission.unread}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="canal-chat-col">
          <div className="canal-chat-head">
            <div className="canal-chat-head-info">
              <div className="canal-chat-title">{missionActive.title}</div>
              <div className="canal-chat-meta">
                <span className="canal-chat-meta-id">{missionActive.pro}</span>
                <span className="canal-chat-meta-sep">·</span>
                <span>{missionActive.building}</span>
              </div>
            </div>
            <div className="canal-chat-head-actions">
              <button
                className="btn ghost sm"
                aria-label="Voir les participants"
                onClick={() =>
                  push({
                    kind: 'info',
                    title: 'Participants',
                    desc: missionActive.parts.length + ' membres',
                  })
                }
              >
                <Icon name="users" />
              </button>
            </div>
          </div>
          <div
            className="canal-chat-body"
            style={{
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'flex-start',
              gap: 0,
            }}
          >
            {missionActive.id === 'mfuite' ? (
              <FilMissionFuiteColonne
                mission={missionActive}
                wf={
                  workflows.mfuite || {
                    state: 'signale',
                  }
                }
                onValidate={() => setDispatchOuvert(true)}
                onCompta={transmettreComptabilite}
                push={push}
              />
            ) : (
              <div
                style={{
                  alignSelf: 'center',
                  width: '100%',
                  maxWidth: 580,
                  background: 'var(--gold-50)',
                  border: '1px solid var(--gold-200)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 700,
                    fontSize: 12.5,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--gold-700)',
                    marginBottom: 8,
                  }}
                >
                  <Icon name="clipboard" />
                  Ordre de mission
                </div>
                <div
                  style={{
                    fontFamily: 'Cormorant Garamond, serif',
                    fontSize: 18,
                    marginBottom: 10,
                  }}
                >
                  {missionActive.desc}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '5px 16px',
                    fontSize: 12.5,
                  }}
                >
                  <div>
                    <span
                      style={{
                        color: 'var(--navy-300)',
                      }}
                    >
                      {'Copropriété : '}
                    </span>
                    {missionActive.building}
                  </div>
                  <div>
                    <span
                      style={{
                        color: 'var(--navy-300)',
                      }}
                    >
                      {'Bâtiment : '}
                    </span>
                    {missionActive.batiment}
                  </div>
                  <div>
                    <span
                      style={{
                        color: 'var(--navy-300)',
                      }}
                    >
                      {'Localisation : '}
                    </span>
                    {missionActive.etage}
                  </div>
                  <div>
                    <span
                      style={{
                        color: 'var(--navy-300)',
                      }}
                    >
                      {'Métier : '}
                    </span>
                    {missionActive.area}
                  </div>
                  <div>
                    <span
                      style={{
                        color: 'var(--navy-300)',
                      }}
                    >
                      {'Gardien : '}
                    </span>
                    {missionActive.gardien}
                    {missionActive.gardienTel && missionActive.gardienTel !== '—' ? ' · ' + missionActive.gardienTel : ''}
                  </div>
                  <div>
                    <span
                      style={{
                        color: 'var(--navy-300)',
                      }}
                    >
                      {"Code d'accès : "}
                    </span>
                    {missionActive.code}
                  </div>
                  <div
                    style={{
                      gridColumn: '1 / -1',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--navy-300)',
                      }}
                    >
                      {'Origine : '}
                    </span>
                    {missionActive.origine}
                  </div>
                  <div
                    style={{
                      gridColumn: '1 / -1',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--navy-300)',
                      }}
                    >
                      {'Intervention : '}
                    </span>
                    {missionActive.date}
                    {' · '}
                    {missionActive.duration}
                  </div>
                </div>
                {missionActive.photos && missionActive.photos.length > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      borderTop: '1px solid var(--gold-200)',
                      paddingTop: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--navy-400)',
                        marginBottom: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {"Photos transmises via l'app"}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 8,
                      }}
                    >
                      {missionActive.photos.map((photo, index) => (
                        <VignettePhotoMission label={photo} key={index} />
                      ))}
                    </div>
                  </div>
                )}
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--navy-400)',
                    marginTop: 10,
                    borderTop: '1px solid var(--gold-200)',
                    paddingTop: 8,
                  }}
                >
                  {'Transmis à '}
                  {missionActive.pro}
                  {". Validation par l'artisan en fin de mission."}
                </div>
              </div>
            )}
            {(messagesParMission[missionActiveId] || []).map((message, index) => (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: message[3] === 'me' ? 'flex-end' : 'flex-start',
                  marginBottom: 14,
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
                  {message[0]}
                  {' · '}
                  {message[1]}
                </div>
                <div
                  style={{
                    maxWidth: '78%',
                    padding: '10px 14px',
                    borderRadius: 14,
                    fontSize: 13,
                    lineHeight: 1.45,
                    background: message[3] === 'me' ? 'var(--navy-700)' : 'var(--cream)',
                    color: message[3] === 'me' ? '#fff' : 'var(--ink)',
                    border: message[3] === 'me' ? 'none' : '1px solid var(--line)',
                  }}
                >
                  {message[2]}
                </div>
              </div>
            ))}
          </div>
          <div className="canal-chat-quickactions">
            <button
              className="canal-action gold"
              onClick={() =>
                push({
                  kind: 'info',
                  title: "Relancer l'artisan",
                  desc: missionActive.pro,
                })
              }
            >
              <Icon name="mail" />
              Relancer
            </button>
            <button
              className="canal-action sage"
              onClick={() =>
                push({
                  kind: 'form',
                  icon: 'doc',
                  title: 'Joindre une pièce',
                  fields: [
                    {
                      label: 'Type',
                      type: 'select',
                      options: ['Devis', 'Facture', 'Compte rendu', 'Photo'],
                      full: true,
                    },
                    {
                      label: 'Nom du fichier',
                      placeholder: 'ex. facture.pdf',
                      full: true,
                    },
                  ],
                  submitLabel: 'Joindre',
                  toast: {
                    title: 'Pièce jointe au dossier',
                  },
                })
              }
            >
              <Icon name="doc" />
              Pièce
            </button>
            <button
              className="canal-action rust"
              onClick={() =>
                push({
                  kind: 'success',
                  title: 'Simulation',
                  desc: "La mission n'a pas été validée dans le dossier (" + missionActive.title + ').',
                })
              }
            >
              <Icon name="check" />
              Valider la mission
            </button>
          </div>
          <div className="canal-chat-footer">
            <div className="canal-chat-input-row">
              <input
                aria-label="Message"
                className="canal-chat-input"
                value={brouillon}
                onChange={(evenement) => setBrouillon(evenement.target.value)}
                onKeyDown={(evenement) => {
                  if (evenement.key === 'Enter') envoyerMessage()
                }}
                placeholder={`Répondre à ${missionActive.pro}…`}
              />
              <button aria-label="Envoyer le message" className="canal-chat-send btn primary" onClick={envoyerMessage}>
                <Icon name="arrow" />
              </button>
            </div>
            <div className="canal-chat-hint">Les échanges sont horodatés et versés au journal du mandat.</div>
          </div>
        </div>
        <div className="canal-details-col">
          <div className="canal-details-section">
            <div className="canal-details-label">Ordre de mission</div>
            <div className="canal-details-title">{missionActive.title}</div>
            <div className="canal-details-pills">
              {missionActive.tags.map((tag, index) => (
                <Pill noDot key={index}>
                  {tag}
                </Pill>
              ))}
            </div>
          </div>
          <div className="canal-details-section">
            <div className="canal-details-label">Informations</div>
            <ul className="canal-info-list">
              <li>
                <Icon name="building" />
                <div>
                  <div className="canal-info-k">Copropriété</div>
                  <div className="canal-info-v">{missionActive.building}</div>
                </div>
              </li>
              <li>
                <Icon name="home" />
                <div>
                  <div className="canal-info-k">Bâtiment</div>
                  <div className="canal-info-v">{missionActive.batiment}</div>
                </div>
              </li>
              <li>
                <Icon name="pin" />
                <div>
                  <div className="canal-info-k">Localisation / étage</div>
                  <div className="canal-info-v">{missionActive.etage}</div>
                </div>
              </li>
              <li>
                <Icon name="wrench" />
                <div>
                  <div className="canal-info-k">Métier</div>
                  <div className="canal-info-v">{missionActive.area}</div>
                </div>
              </li>
              <li>
                <Icon name="flag" />
                <div>
                  <div className="canal-info-k">Origine de la demande</div>
                  <div className="canal-info-v">{missionActive.origine}</div>
                </div>
              </li>
              <li>
                <Icon name="users" />
                <div>
                  <div className="canal-info-k">Gardien à contacter</div>
                  <div className="canal-info-v">
                    {missionActive.gardien}
                    {missionActive.gardienTel && missionActive.gardienTel !== '—' ? ' · ' + missionActive.gardienTel : ''}
                  </div>
                </div>
              </li>
              <li>
                <Icon name="lock" />
                <div>
                  <div className="canal-info-k">{"Code d'accès"}</div>
                  <div className="canal-info-v">{missionActive.code}</div>
                </div>
              </li>
              <li>
                <Icon name="calendar" />
                <div>
                  <div className="canal-info-k">Intervention</div>
                  <div className="canal-info-v">{missionActive.date}</div>
                </div>
              </li>
            </ul>
          </div>
          {((missionActive.photos && missionActive.photos.length > 0) || missionActive.realPhoto) && (
            <div className="canal-details-section">
              <div className="canal-details-label">{missionActive.realPhoto ? 'Photo transmise' : 'Photos transmises'}</div>
              {missionActive.realPhoto ? (
                <img
                  src={missionActive.realPhoto}
                  alt="Photo du signalement"
                  style={{
                    width: '100%',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 8,
                  }}
                >
                  {missionActive.photos.map((photo, index) => (
                    <VignettePhotoMission label={photo} key={index} />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="canal-details-section">
            <div className="canal-details-label">Participants</div>
            <div className="canal-participants">
              {missionActive.parts.map((participant, index) => (
                <div className="canal-participant" key={index}>
                  <span className="canal-participant-avatar">
                    {participant[0]}
                    {participant[3] === 'on' && <span className="canal-participant-online" />}
                  </span>
                  <span className="canal-participant-info">
                    <span className="canal-participant-name">{participant[1]}</span>
                    <span className="canal-participant-role">{participant[2]}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="canal-details-section">
            <div className="canal-details-label">Workflow de la mission</div>
            <ol className="canal-progress">
              {etapesAffichees.map((etape, index) => {
                // L'état est le dernier élément de l'étape ; la date n'est affichée que si l'étape en compte plus de 2.
                const statut = etape[etape.length - 1]
                const classeEtat = statut === 'done' ? 'done' : statut === 'now' ? 'now' : 'todo'
                return (
                  <li className={`canal-progress-step state-${classeEtat}`} key={index}>
                    <span className="canal-progress-marker" />
                    <div className="canal-progress-content">
                      <div className="canal-progress-step-name">{etape[0]}</div>
                      <div className="canal-progress-step-date">{etape.length > 2 ? etape[1] : '—'}</div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>
      <Modal open={dispatchOuvert} onClose={() => setDispatchOuvert(false)} size="md" labelledBy="disp-t">
        <ModalHeader
          id="disp-t"
          icon="handshake"
          title="Dispatcher l'ordre de mission"
          onClose={() => setDispatchOuvert(false)}
        />
        <ModalBody>
          <div
            style={{
              background: 'var(--cream)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 12.5,
              marginBottom: 14,
              lineHeight: 1.45,
            }}
          >
            {
              "Fuite colonne EU — partie commune · Résidence Le Méridien, Bâtiment B. Choisissez le prestataire et l'heure d'intervention."
            }
          </div>
          <FieldRow>
            <Field label="Prestataire / technicien">
              <select
                value={saisieDispatch.prestataire}
                onChange={(evenement) =>
                  setSaisieDispatch((precedente) => ({
                    ...precedente,
                    prestataire: evenement.target.value,
                  }))
                }
              >
                {DEMO_PRESTATAIRES.map((prestataire) => (
                  <option value={prestataire.nom} key={prestataire.id}>
                    {prestataire.nom}
                    {' — '}
                    {prestataire.metier}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Équipe / intervenant">
              <input
                value={saisieDispatch.technicien}
                onChange={(evenement) =>
                  setSaisieDispatch((precedente) => ({
                    ...precedente,
                    technicien: evenement.target.value,
                  }))
                }
                placeholder="ex. 2 techniciens"
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Date d'intervention">
              <input
                value={saisieDispatch.date}
                onChange={(evenement) =>
                  setSaisieDispatch((precedente) => ({
                    ...precedente,
                    date: evenement.target.value,
                  }))
                }
                placeholder="JJ/MM/AAAA"
              />
            </Field>
            <Field label="Heure d'intervention">
              <select
                value={saisieDispatch.heure}
                onChange={(evenement) =>
                  setSaisieDispatch((precedente) => ({
                    ...precedente,
                    heure: evenement.target.value,
                  }))
                }
              >
                {HEURES_INTERVENTION.map((heure) => (
                  <option key={heure}>{heure}</option>
                ))}
              </select>
            </Field>
          </FieldRow>
        </ModalBody>
        <ModalFooter>
          <button className="btn ghost" onClick={() => setDispatchOuvert(false)}>
            Annuler
          </button>
          <button className="btn gold" onClick={validerDispatch}>
            <Icon name="arrow" />
            {"Valider et envoyer l'ordre"}
          </button>
        </ModalFooter>
      </Modal>
      <Modal open={assistantOuvert} onClose={() => setAssistantOuvert(false)} size="lg" labelledBy="canal-wiz-t">
        <ModalHeader
          id="canal-wiz-t"
          icon="clipboard"
          title="Nouvel ordre de mission"
          onClose={() => setAssistantOuvert(false)}
        />
        <ModalBody>
          <div
            style={{
              background: 'var(--cream)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 12.5,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              lineHeight: 1.4,
            }}
          >
            <Icon name="info" width="16" height="16" />
            <span>
              {
                "Signalement déclenché par le gardien ou un copropriétaire via l'app. Le gestionnaire technique complète et transmet à l'artisan, qui valide en fin de mission."
              }
            </span>
          </div>
          <FieldRow>
            <Field label="Origine de la demande">
              <select
                value={saisieOrdre.origine}
                onChange={(evenement) =>
                  setSaisieOrdre((precedente) => ({
                    ...precedente,
                    origine: evenement.target.value,
                  }))
                }
              >
                {ORIGINES_DEMANDE.map((origine) => (
                  <option key={origine}>{origine}</option>
                ))}
              </select>
            </Field>
            <Field label="Copropriété">
              <select
                value={saisieOrdre.building}
                onChange={(evenement) =>
                  setSaisieOrdre((precedente) => ({
                    ...precedente,
                    building: evenement.target.value,
                  }))
                }
              >
                {DEMO_NOMS_COPROPRIETES.map((nom) => (
                  <option key={nom}>{nom}</option>
                ))}
              </select>
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Bâtiment / n°">
              <input
                placeholder="ex. Bâtiment A"
                value={saisieOrdre.batiment}
                onChange={(evenement) =>
                  setSaisieOrdre((precedente) => ({
                    ...precedente,
                    batiment: evenement.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Localisation / étage">
              <input
                placeholder="ex. 4e étage, porte gauche"
                value={saisieOrdre.etage}
                onChange={(evenement) =>
                  setSaisieOrdre((precedente) => ({
                    ...precedente,
                    etage: evenement.target.value,
                  }))
                }
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Gardien à contacter">
              <input
                placeholder="ex. M. Da Silva"
                value={saisieOrdre.gardien}
                onChange={(evenement) =>
                  setSaisieOrdre((precedente) => ({
                    ...precedente,
                    gardien: evenement.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Téléphone gardien">
              <input
                placeholder="06 …"
                value={saisieOrdre.tel}
                onChange={(evenement) =>
                  setSaisieOrdre((precedente) => ({
                    ...precedente,
                    tel: evenement.target.value,
                  }))
                }
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Code portail / digicode">
              <input
                placeholder="ex. Portail A-1234, digicode 45B"
                value={saisieOrdre.code}
                onChange={(evenement) =>
                  setSaisieOrdre((precedente) => ({
                    ...precedente,
                    code: evenement.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Date d'intervention">
              <input
                placeholder="JJ/MM/AAAA"
                value={saisieOrdre.date}
                onChange={(evenement) =>
                  setSaisieOrdre((precedente) => ({
                    ...precedente,
                    date: evenement.target.value,
                  }))
                }
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Artisan / prestataire">
              <select value={saisieOrdre.pro} onChange={(evenement) => choisirArtisan(evenement.target.value)}>
                {DEMO_PRESTATAIRES.map((prestataire) => (
                  <option value={prestataire.nom} key={prestataire.id}>
                    {prestataire.nom}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Métier">
              <input
                value={saisieOrdre.area}
                onChange={(evenement) =>
                  setSaisieOrdre((precedente) => ({
                    ...precedente,
                    area: evenement.target.value,
                  }))
                }
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Intervention demandée" full>
              <textarea
                rows={3}
                value={saisieOrdre.desc}
                onChange={(evenement) =>
                  setSaisieOrdre((precedente) => ({
                    ...precedente,
                    desc: evenement.target.value,
                  }))
                }
                placeholder="Décrivez le problème signalé et la prestation à réaliser…"
                style={{
                  width: '100%',
                  resize: 'vertical',
                }}
              />
            </Field>
          </FieldRow>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              cursor: 'pointer',
              padding: '4px 2px',
            }}
          >
            <Toggle
              on={saisieOrdre.photos}
              onToggle={() =>
                setSaisieOrdre((precedente) => ({
                  ...precedente,
                  photos: !precedente.photos,
                }))
              }
            />
            <span>
              {"Reprendre les photos transmises via l'app ("}
              {saisieOrdre.photos ? '2 photos jointes' : 'aucune'})
            </span>
          </label>
        </ModalBody>
        <ModalFooter>
          <button className="btn ghost" onClick={() => setAssistantOuvert(false)}>
            Annuler
          </button>
          <button className="btn gold" onClick={creerOrdreMission}>
            <Icon name="mail" />
            {"Transmettre à l'artisan"}
          </button>
        </ModalFooter>
      </Modal>
    </>
  )
}
