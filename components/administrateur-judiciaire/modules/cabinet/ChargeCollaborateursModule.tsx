'use client'

import {
  DEMO_COLLABORATEURS_CHARGE,
  type CollaborateurCharge,
} from '@/components/administrateur-judiciaire/data/collaborateurs'
import { DEMO_PORTEFEUILLE_MANDATS } from '@/components/administrateur-judiciaire/data/portefeuille-mandats'
import { DEMO_TACHES } from '@/components/administrateur-judiciaire/data/taches'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/** Niveau de charge d'un collaborateur et couleur de pastille associée. */
export type EtatChargeCollaborateur = 'Surchargé' | 'Équilibré' | 'Disponible'

/** Collaborateur enrichi de sa charge : mandats menés, tâches ouvertes, niveau de charge (0-100) et état. */
export interface ChargeCollaborateur extends CollaborateurCharge {
  mandats: number
  tasks: number
  load: number
  state: EtatChargeCollaborateur
  pill: 'rust' | 'sage' | 'gold'
}

/**
 * Charge de chaque collaborateur : mandats dont il est responsable + 60 % des tâches de son rôle (arrondi) ;
 * niveau = points / 9 (borné à 100 %) ; 8 points et plus → « Surchargé », 4 et plus → « Équilibré », sinon « Disponible ».
 */
export function calculerChargeCollaborateurs(
  collaborateurs: readonly CollaborateurCharge[] = DEMO_COLLABORATEURS_CHARGE,
): ChargeCollaborateur[] {
  return collaborateurs.map((collaborateur) => {
    const mandats = DEMO_PORTEFEUILLE_MANDATS.filter((mandat) => mandat.resp === collaborateur.nom).length,
      taches = DEMO_TACHES.filter((tache) => tache.role === collaborateur.taskRole).length,
      points = mandats + Math.round(taches * 0.6),
      niveau = Math.min(100, Math.round((points / 9) * 100)),
      etat: EtatChargeCollaborateur = points >= 8 ? 'Surchargé' : points >= 4 ? 'Équilibré' : 'Disponible',
      pastille: ChargeCollaborateur['pill'] = points >= 8 ? 'rust' : points >= 4 ? 'sage' : 'gold'
    return {
      ...collaborateur,
      mandats,
      tasks: taches,
      load: niveau,
      state: etat,
      pill: pastille,
    }
  })
}

/** Initiales affichées dans la vignette : première lettre de chaque mot, deux au plus. */
const initialesCollaborateur = (nom: string): string =>
  nom
    .split(' ')
    .map((mot) => mot[0])
    .join('')
    .slice(0, 2)

/** Dégradé de la barre de charge selon la couleur de pastille. */
const degradeBarreCharge = (pastille: ChargeCollaborateur['pill']): string =>
  pastille === 'rust'
    ? 'linear-gradient(90deg,var(--rust-700),var(--rust-500))'
    : pastille === 'gold'
      ? 'linear-gradient(90deg,var(--gold-600),var(--gold-500))'
      : 'linear-gradient(90deg,var(--sage-700),var(--sage-500))'

/** Charge des collaborateurs : répartition des mandats et des tâches par membre du cabinet (démo). */
export function ChargeCollaborateursModule() {
  const { push } = useToast()
  const charges = calculerChargeCollaborateurs()
  const surcharges = charges.filter((charge) => charge.state === 'Surchargé').length
  return (
    <>
      <PageHead
        eyebrow="Cabinet & supervision"
        title="Charge des collaborateurs"
        lede="Répartition des mandats et des tâches par membre du cabinet, pour repérer les surcharges et rééquilibrer le portefeuille."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'success',
                title: 'Simulation',
                desc: "Aucune proposition n'a été générée.",
              })
            }
          >
            <Icon name="users" />
            Rééquilibrer automatiquement
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'users',
            num: DEMO_COLLABORATEURS_CHARGE.length,
            lbl: 'Collaborateurs',
            sub: 'cabinet',
          },
          {
            icon: 'scale',
            num: DEMO_PORTEFEUILLE_MANDATS.length,
            lbl: 'Mandats répartis',
          },
          {
            icon: 'alert',
            num: surcharges,
            lbl: 'Collaborateurs surchargés',
            sub: surcharges ? 'à soulager' : 'charge saine',
            accent: surcharges ? 'rust' : 'sage',
          },
          {
            icon: 'check',
            num: DEMO_TACHES.length,
            lbl: 'Tâches en circulation',
            accent: 'amber',
          },
        ]}
      />
      <Panel
        title="Charge par collaborateur"
        sub="Mandats menés + tâches ouvertes · barre = niveau de charge"
        icon="users"
        flush
      >
        {charges.map((charge, index) => (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '15px 22px',
              borderBottom: '1px solid var(--line)',
            }}
            key={index}
          >
            <div
              className="thumb"
              style={{
                flexShrink: 0,
              }}
            >
              {initialesCollaborateur(charge.nom)}
            </div>
            <div
              style={{
                width: 170,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                }}
              >
                {charge.nom}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--navy-300)',
                }}
              >
                {charge.role}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 80,
              }}
            >
              <div
                style={{
                  height: 8,
                  borderRadius: 5,
                  background: 'var(--cream)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${charge.load}%`,
                    height: '100%',
                    background: degradeBarreCharge(charge.pill),
                  }}
                />
              </div>
            </div>
            <span
              style={{
                fontSize: 12,
                color: 'var(--navy-500)',
                width: 72,
                textAlign: 'right',
              }}
            >
              {charge.mandats}
              {' mandats'}
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--navy-500)',
                width: 64,
                textAlign: 'right',
              }}
            >
              {charge.tasks}
              {' tâches'}
            </span>
            <Pill kind={charge.pill} noDot>
              {charge.state}
            </Pill>
            <button
              className="btn ghost sm"
              onClick={() =>
                push({
                  kind: 'info',
                  title: 'Réaffectation',
                  desc: `Réaffecter un mandat de ${charge.nom}`,
                })
              }
            >
              Réaffecter
            </button>
          </div>
        ))}
      </Panel>
    </>
  )
}
