'use client'

import { useState } from 'react'
import {
  listerGroupesModulesAttribuables,
  modulesParDefautDuRole,
  ROLES_EQUIPE_CABINET,
  type AccesCollaborateurSaisi,
  type GroupeModules,
  type MembreEquipe,
} from '@/components/administrateur-judiciaire/modules/gestion/equipe/acces-par-role'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { Toggle } from '@/components/administrateur-judiciaire/ui/Toggle'

/** Rôle proposé par défaut à la création d'un compte. */
const ROLE_PAR_DEFAUT = 'Gestionnaire de mandats'

export interface AccesCollaborateurModalProps {
  mode: 'create' | 'edit'
  /** Membre modifié (null en création). */
  member: MembreEquipe | null
  /** Nombre total de modules attribuables. */
  total: number
  onClose: () => void
  onSave: (saisie: AccesCollaborateurSaisi) => void
}

/**
 * Création d'un compte collaborateur ou modification de ses accès, module par module. Toujours ouverte : le parent
 * la monte et la démonte (avec une key). Changer de rôle remplace les accès par le préréglage du nouveau rôle.
 */
export function AccesCollaborateurModal({ mode, member, total, onClose, onSave }: AccesCollaborateurModalProps) {
  const groupes = listerGroupesModulesAttribuables()
  const [role, setRole] = useState<string>(member ? member.role : ROLE_PAR_DEFAUT)
  const [nom, setNom] = useState(member ? member.name : '')
  const [email, setEmail] = useState(member ? member.email : '')
  const [acces, setAcces] = useState<Set<string>>(
    () => new Set(member ? member.access : Array.from(modulesParDefautDuRole(ROLE_PAR_DEFAUT))),
  )

  /** Le nouveau rôle réapplique son préréglage et efface les ajustements manuels. */
  const changerRole = (nouveauRole: string) => {
    setRole(nouveauRole)
    setAcces(new Set(modulesParDefautDuRole(nouveauRole)))
  }

  const basculerModule = (id: string) =>
    setAcces((precedents) => {
      const modules = new Set(precedents)
      if (modules.has(id)) modules.delete(id)
      else modules.add(id)
      return modules
    })

  const reglerGroupe = (groupe: GroupeModules, accorde: boolean) =>
    setAcces((precedents) => {
      const modules = new Set(precedents)
      groupe.items.forEach((entree) => {
        if (accorde) modules.add(entree.id)
        else modules.delete(entree.id)
      })
      return modules
    })

  const enregistrer = () => {
    onSave({
      name: nom.trim() || (member && member.name) || 'Nouveau compte',
      email: email.trim(),
      role,
      access: Array.from(acces),
    })
  }

  return (
    <Modal open onClose={onClose} size="lg" labelledBy="acc-t">
      <ModalHeader
        id="acc-t"
        icon="team"
        title={mode === 'edit' ? 'Accès — ' + member?.name : 'Créer un compte collaborateur'}
        onClose={onClose}
      />
      <ModalBody>
        <FieldRow>
          <Field label="Nom complet">
            <input
              value={nom}
              onChange={(evenement) => setNom(evenement.target.value)}
              placeholder="ex. Claire Fontaine"
              disabled={mode === 'edit'}
            />
          </Field>
          <Field label="Adresse e-mail">
            <input
              value={email}
              onChange={(evenement) => setEmail(evenement.target.value)}
              placeholder="prenom@cabinet-delaunay.fr"
              disabled={mode === 'edit'}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Rôle" full>
            <select value={role} onChange={(evenement) => changerRole(evenement.target.value)}>
              {ROLES_EQUIPE_CABINET.map((libelle) => (
                <option key={libelle}>{libelle}</option>
              ))}
            </select>
          </Field>
        </FieldRow>
        <div
          style={{
            background: 'var(--gold-50)',
            border: '1px solid var(--gold-200)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12.5,
            margin: '4px 0 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            lineHeight: 1.4,
          }}
        >
          <Icon name="info" width="16" height="16" />
          <span>
            {
              'Le rôle pré-coche un ensemble cohérent de modules. Le chef du cabinet ajuste ensuite librement, module par module.'
            }
          </span>
        </div>
        {groupes.map((groupe, indexGroupe) => {
          const accordes = groupe.items.filter((entree) => acces.has(entree.id)).length
          return (
            <div
              style={{
                marginBottom: 10,
              }}
              key={indexGroupe}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--line)',
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
                    color: 'var(--navy-400)',
                  }}
                >
                  {groupe.title}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--navy-300)',
                  }}
                >
                  {accordes}/{groupe.items.length}
                  <button
                    type="button"
                    onClick={() => reglerGroupe(groupe, true)}
                    style={{
                      marginLeft: 10,
                      background: 'none',
                      border: 'none',
                      color: 'var(--gold-700)',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: 11,
                      padding: 0,
                    }}
                  >
                    tout
                  </button>
                  <span
                    style={{
                      margin: '0 4px',
                      color: 'var(--line-strong)',
                    }}
                  >
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={() => reglerGroupe(groupe, false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--navy-300)',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: 11,
                      padding: 0,
                    }}
                  >
                    aucun
                  </button>
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0 24px',
                }}
              >
                {groupe.items.map((entree) => (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 2px',
                      cursor: 'pointer',
                    }}
                    key={entree.id}
                  >
                    <Icon name={entree.icon} width="16" height="16" />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entree.label}
                    </span>
                    <Toggle on={acces.has(entree.id)} onToggle={() => basculerModule(entree.id)} />
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </ModalBody>
      <ModalFooter>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            color: 'var(--navy-500)',
            alignSelf: 'center',
          }}
        >
          <b>{acces.size}</b>
          {' module'}
          {acces.size > 1 ? 's' : ''}
          {' accordé'}
          {acces.size > 1 ? 's' : ''}
          {' sur '}
          {total}
        </span>
        <button className="btn ghost" onClick={onClose}>
          Annuler
        </button>
        <button className="btn gold" onClick={enregistrer}>
          <Icon name="check" />
          {mode === 'edit' ? "Enregistrer l'accès" : 'Créer le compte'}
        </button>
      </ModalFooter>
    </Modal>
  )
}
