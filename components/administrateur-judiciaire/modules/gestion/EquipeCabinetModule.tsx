'use client'

import { useState } from 'react'
import { DEMO_EQUIPE_CABINET } from '@/components/administrateur-judiciaire/data/equipe-cabinet'
import { AccesCollaborateurModal } from '@/components/administrateur-judiciaire/modules/gestion/equipe/AccesCollaborateurModal'
import {
  listerGroupesModulesAttribuables,
  modulesParDefautDuRole,
  PERIMETRE_PAR_ROLE,
  ROLES_EQUIPE_CABINET,
  SECTIONS_PAR_ROLE,
  teinteDuRole,
  type AccesCollaborateurSaisi,
  type MembreEquipe,
} from '@/components/administrateur-judiciaire/modules/gestion/equipe/acces-par-role'
import { DataTable, type ColonneTableau } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/** Modale d'accès ouverte : création d'un compte, ou modification du membre d'index idx. */
type ModaleAcces = { mode: 'create'; idx?: undefined } | { mode: 'edit'; idx: number }

/** Ligne du tableau des accès par défaut : [rôle, nombre de modules, périmètre]. */
type LignePresetRole = [role: string, modules: string, perimetre: string]

const COLONNES_PRESETS: ColonneTableau<LignePresetRole>[] = [
  {
    h: 'Rôle',
    render: (ligne) => <b>{ligne[0]}</b>,
  },
  {
    h: 'Modules par défaut',
    render: (ligne) => (
      <Pill kind="navy" noDot>
        {ligne[1]}
      </Pill>
    ),
  },
  {
    h: 'Périmètre',
    render: (ligne) => (
      <span
        style={{
          fontSize: 12.5,
          color: 'var(--navy-500)',
        }}
      >
        {ligne[2]}
      </span>
    ),
  },
]

/**
 * Équipe du cabinet : collaborateurs, rôles et accès par module (création de compte et gestion des accès simulées).
 * Surtitre « Cabinet » bien que l'écran soit rangé dans « Gestion courante » (comme dans la maquette).
 */
export function EquipeCabinetModule() {
  const { push } = useToast()
  const [membres, setMembres] = useState<MembreEquipe[]>(() =>
    DEMO_EQUIPE_CABINET.map((membre) => ({
      init: membre[0],
      name: membre[1],
      role: membre[2],
      email: membre[3],
      accent: membre[4],
      access: Array.from(modulesParDefautDuRole(membre[2])),
    })),
  )
  const [modale, setModale] = useState<ModaleAcces | null>(null)
  const totalModules = listerGroupesModulesAttribuables().flatMap((groupe) => groupe.items).length
  const lignesPresets: LignePresetRole[] = ROLES_EQUIPE_CABINET.map((role) => [
    role,
    SECTIONS_PAR_ROLE[role] === '*'
      ? 'Tous (' + totalModules + ')'
      : modulesParDefautDuRole(role).size + ' modules',
    PERIMETRE_PAR_ROLE[role],
  ])

  const enregistrer = (saisie: AccesCollaborateurSaisi) => {
    // La modale n'est rendue (et ne peut donc enregistrer) que lorsqu'elle est ouverte.
    if (!modale) return
    if (modale.mode === 'edit') {
      setMembres((precedents) =>
        precedents.map((membre, index) =>
          index === modale.idx
            ? {
                ...membre,
                role: saisie.role,
                access: saisie.access,
                accent: teinteDuRole(saisie.role) || 'sage',
              }
            : membre,
        ),
      )
      push({
        kind: 'success',
        title: 'Simulation',
        desc: "Les accès n'ont pas été modifiés dans le système pour " + saisie.name + '.',
      })
    } else {
      const initiales =
        saisie.name
          .split(/\s+/)
          .slice(0, 2)
          .map((mot) => mot[0] || '')
          .join('')
          .toUpperCase() || '?'
      setMembres((precedents) => [
        ...precedents,
        {
          init: initiales,
          name: saisie.name,
          // Adresse déduite du nom : les lettres accentuées deviennent des points (comme dans la maquette).
          email: saisie.email || saisie.name.toLowerCase().replace(/[^a-z]+/g, '.') + '@cabinet-delaunay.fr',
          role: saisie.role,
          accent: teinteDuRole(saisie.role) || 'sage',
          access: saisie.access,
        },
      ])
      push({
        kind: 'success',
        title: 'Simulation',
        desc: "Aucun compte ni accès n'a été créé pour " + saisie.name + '.',
      })
    }
    setModale(null)
  }

  return (
    <>
      <PageHead
        eyebrow="Cabinet"
        title="Équipe du cabinet"
        lede="Collaborateurs, rôles et accès par module. Le chef du cabinet choisit précisément les modules accessibles à chaque compte."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              setModale({
                mode: 'create',
              })
            }
          >
            <Icon name="plus" />
            Créer un compte
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'team',
            num: membres.length,
            lbl: 'Collaborateurs',
          },
          {
            icon: 'shield',
            num: new Set(membres.map((membre) => membre.role)).size,
            lbl: 'Rôles distincts',
          },
          {
            icon: 'grid',
            num: totalModules,
            lbl: 'Modules de la plateforme',
          },
        ]}
      />
      <Panel title="Collaborateurs & accès" sub="Gérez le périmètre de chaque compte" icon="team" flush>
        <div
          style={{
            padding: 16,
            display: 'grid',
            gap: 10,
          }}
        >
          {membres.map((membre, index) => {
            const estDirection = membre.role.indexOf('Direction') === 0
            return (
              <div
                className="entity-card"
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                  padding: '12px 14px',
                }}
                key={index}
              >
                <span
                  className={`team-dd-avatar accent-${membre.accent}`}
                  style={{
                    flexShrink: 0,
                  }}
                >
                  {membre.init}
                </span>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13.5,
                    }}
                  >
                    {membre.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--navy-500)',
                    }}
                  >
                    {membre.role}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--navy-300)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {membre.email}
                  </div>
                </div>
                <div
                  style={{
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  <Pill kind={estDirection ? 'gold' : 'navy'} noDot>
                    {estDirection ? 'Tous les modules' : membre.access.length + ' modules'}
                  </Pill>
                  <div
                    style={{
                      marginTop: 8,
                    }}
                  >
                    <button
                      className="btn ghost sm"
                      onClick={() =>
                        setModale({
                          mode: 'edit',
                          idx: index,
                        })
                      }
                    >
                      <Icon name="shield" width="15" height="15" />
                      {"Gérer l'accès"}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
      <Panel
        title="Accès par défaut selon le rôle"
        sub="Presets appliqués automatiquement à la création — toujours ajustables compte par compte"
        icon="shield"
        flush
      >
        {/* rowKey « 0 » (chaîne) : la clé React de chaque ligne est le rôle, pas l'index. */}
        <DataTable rowKey="0" columns={COLONNES_PRESETS} rows={lignesPresets} />
      </Panel>
      {modale && (
        <AccesCollaborateurModal
          mode={modale.mode}
          member={modale.mode === 'edit' ? membres[modale.idx] : null}
          total={totalModules}
          onClose={() => setModale(null)}
          onSave={enregistrer}
          key={modale.mode + (modale.idx == null ? 'new' : modale.idx)}
        />
      )}
    </>
  )
}
