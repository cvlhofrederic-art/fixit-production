'use client'

import { surActivationClavier } from '@/components/administrateur-judiciaire/ui/clavier'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { Tabs } from '@/components/administrateur-judiciaire/ui/Tabs'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/** Espace de la légende du calendrier : [libellé, couleur CSS de la pastille]. */
export type EspaceLegendeReservation = [libelle: string, couleur: string]

/** En-têtes des colonnes du calendrier (semaine commençant le lundi). */
const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/**
 * Légende du calendrier. Elle diffère volontairement des espaces proposés dans le formulaire
 * « Nouvelle réservation » (Salle commune, Local vélos, Place visiteur), comme dans la maquette.
 */
const LEGENDE_ESPACES: readonly EspaceLegendeReservation[] = [
  ['Salle commune', 'var(--gold-500)'],
  ['Local vélos', 'var(--sage-500)'],
  ['Parking visiteurs', 'var(--rust-500)'],
  ['Terrasse', 'var(--sage-700)'],
  ['Buanderie', 'var(--amber-500)'],
  ['Salle de réunion', 'var(--gold-700)'],
]

/**
 * Cases du calendrier de juin 2026 (qui commence un lundi) : jours 1 à 30, complétés par des 0 (cases vides)
 * jusqu'à 35 cases.
 */
const construireCasesCalendrier = (): number[] => {
  const cases: number[] = []
  for (let jour = 1; jour <= 30; jour++) cases.push(jour)
  while (cases.length < 35) cases.push(0)
  return cases
}

const CASES_CALENDRIER = construireCasesCalendrier()

/**
 * Réservation des espaces communs (écran de démonstration). Le surtitre vaut « Gestion courante » alors que
 * l'écran est rangé dans la section Extranet de la barre latérale (conservé).
 * Calendrier figé sur juin 2026 : le jour 4 est « aujourd'hui » en dur et les réservations sont saisies en dur
 * (jours 5, 8, 11, 15, 22 et 27). Les boutons de navigation et de vue n'affichent qu'un toast ; les cases non vides
 * ont role=button (comme dans la maquette), ainsi que tabIndex et activation au clavier (écart volontaire : la
 * maquette ne les rendait pas accessibles au clavier).
 */
export function ReservationEspacesCommunsModule() {
  const { push } = useToast()

  return (
    <>
      <PageHead
        eyebrow="Gestion courante"
        title="Réservation des espaces communs"
        lede="Gérez les réservations, les espaces et les règles d'utilisation de la copropriété."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'calendar',
                title: 'Nouvelle réservation',
                fields: [
                  {
                    label: 'Copropriété',
                    type: 'select',
                    options: ['Résidence Le Méridien', 'Le Clos des Vignes', 'Copropriété Les Tilleuls', 'Villa Montaigne'],
                    full: true,
                  },
                  {
                    label: 'Espace',
                    type: 'select',
                    options: ['Salle commune', 'Local vélos', 'Place visiteur'],
                    full: true,
                  },
                  {
                    label: 'Copropriétaire',
                    placeholder: 'Nom · lot',
                    full: true,
                  },
                  {
                    label: 'Date',
                    placeholder: 'JJ/MM/AAAA',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Réservation enregistrée',
                },
              })
            }
          >
            <Icon name="plus" />
            Nouvelle réservation
          </button>
        }
      />
      <Tabs
        defaultActive="cal"
        tabs={[
          {
            id: 'cal',
            icon: 'calendar',
            label: 'Calendrier',
          },
          {
            id: 'esp',
            icon: 'home',
            label: 'Espaces',
          },
          {
            id: 'reg',
            icon: 'clipboard',
            label: 'Règles',
          },
          {
            id: 'rel',
            icon: 'chart',
            label: 'Rapport',
          },
        ]}
      />
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 14,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {LEGENDE_ESPACES.map((espace, index) => (
          <Pill noDot key={index}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: espace[1],
                display: 'inline-block',
                marginRight: 4,
              }}
            />
            {espace[0]}
          </Pill>
        ))}
        <div
          style={{
            flex: 1,
          }}
        />
        <button
          className="btn ghost"
          onClick={() =>
            push({
              kind: 'info',
              title: 'Mois précédent',
            })
          }
          aria-label="Mois précédent"
        >
          ←
        </button>
        <div
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 18,
            padding: '8px 16px',
          }}
        >
          Juin 2026
        </div>
        <button
          className="btn ghost"
          onClick={() =>
            push({
              kind: 'info',
              title: 'Mois suivant',
            })
          }
          aria-label="Mois suivant"
        >
          →
        </button>
        <button
          className="btn"
          onClick={() =>
            push({
              kind: 'info',
              title: "Aujourd'hui",
              desc: 'Calendrier centré sur la date du jour',
            })
          }
        >
          {"Aujourd'hui"}
        </button>
        <button
          className="btn"
          onClick={() =>
            push({
              kind: 'info',
              title: 'Vue semaine',
              desc: 'Affichage hebdomadaire',
            })
          }
        >
          Semaine
        </button>
        <button
          className="btn primary"
          onClick={() =>
            push({
              kind: 'info',
              title: 'Vue mois',
              desc: 'Affichage mensuel',
            })
          }
        >
          Mois
        </button>
      </div>
      <Panel flush>
        <div className="calendar">
          {JOURS_SEMAINE.map((jourSemaine) => (
            <div className="dow" key={jourSemaine}>
              {jourSemaine}
            </div>
          ))}
          {CASES_CALENDRIER.map((jour, index) => {
            const afficherJour = () =>
              jour &&
              push({
                kind: 'info',
                title: `${jour} juin`,
                desc: 'Voir les réservations du jour',
              })
            return (
              <div
                className={`day ${jour === 4 ? 'today' : ''} ${jour === 0 ? 'muted' : ''}`}
                onClick={afficherJour}
                onKeyDown={jour ? surActivationClavier(afficherJour) : undefined}
                role={jour ? 'button' : undefined}
                tabIndex={jour ? 0 : undefined}
                key={index}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 2,
                  }}
                >
                  {jour || ''}
                </div>
                {jour === 5 && <div className="ev gold">14:00 Salle réunion</div>}
                {jour === 8 && (
                  <>
                    <div className="ev gold">10:00 Salle commune</div>
                    <div className="ev green">18:00 Terrasse</div>
                  </>
                )}
                {jour === 11 && <div className="ev green">17:30 Local vélos</div>}
                {jour === 15 && (
                  <>
                    <div className="ev gold">09:00 Salle réunion</div>
                    <div className="ev green">14:00 Terrasse</div>
                  </>
                )}
                {jour === 22 && <div className="ev gold">18:30 Salle commune (CS)</div>}
                {jour === 27 && <div className="ev green">11:00 Buanderie</div>}
              </div>
            )
          })}
        </div>
      </Panel>
    </>
  )
}
