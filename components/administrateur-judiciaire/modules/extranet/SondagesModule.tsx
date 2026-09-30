'use client'

import { DEMO_SONDAGES } from '@/components/administrateur-judiciaire/data/sondages'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { ProgressBar } from '@/components/administrateur-judiciaire/ui/ProgressBar'
import { Tabs } from '@/components/administrateur-judiciaire/ui/Tabs'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { pourcentageArrondi } from '@/lib/administrateur-judiciaire/domain/format'

/**
 * Sondages & consultations (écran de démonstration ; surtitre « Gestion courante »).
 * Indicateurs en dur (2, 1, « 79% », 87) ; onglets autonomes avec pastilles 2 et 1.
 * Pour chaque sondage : pastilles, barre de participation (taux saisi en dur) puis, par option, le pourcentage
 * arrondi des voix sur le total des voix du sondage (la première barre en or). « Clôturer » n'apparaît que
 * pour un sondage « Active ».
 */
export function SondagesModule() {
  const { push } = useToast()

  return (
    <>
      <PageHead
        eyebrow="Gestion courante"
        title="Sondages & consultations"
        lede="Recueillez l'avis des copropriétaires de façon rapide et organisée (valeur consultative)."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'poll',
                title: 'Nouveau sondage',
                fields: [
                  {
                    label: 'Copropriété',
                    type: 'select',
                    options: ['Résidence Le Méridien', 'Le Clos des Vignes', 'Copropriété Les Tilleuls', 'Villa Montaigne'],
                    full: true,
                  },
                  {
                    label: 'Question',
                    placeholder: "ex. Préférence pour la date d'AG",
                    full: true,
                  },
                  {
                    label: 'Type',
                    type: 'select',
                    options: ['Choix unique', 'Choix multiple', 'Oui / Non'],
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Sondage créé',
                },
              })
            }
          >
            <Icon name="plus" />
            Nouveau sondage
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'poll',
            num: 2,
            lbl: 'Sondages actifs',
            accent: 'gold',
          },
          {
            icon: 'folder',
            num: 1,
            lbl: 'Historique',
          },
          {
            icon: 'chart',
            num: '79%',
            lbl: 'Participation moyenne',
            accent: 'sage',
          },
          {
            icon: 'users',
            num: 87,
            lbl: 'Réponses totales',
            accent: 'sage',
          },
        ]}
      />
      <Tabs
        defaultActive="actifs"
        tabs={[
          {
            id: 'actifs',
            icon: 'chart',
            label: 'Sondages actifs',
            badge: 2,
          },
          {
            id: 'hist',
            icon: 'folder',
            label: 'Historique',
            badge: 1,
          },
          {
            id: 'creer',
            icon: 'pencil',
            label: 'Créer',
          },
        ]}
      />
      {DEMO_SONDAGES.map((sondage, index) => (
        <div
          className="panel"
          style={{
            padding: 22,
            marginBottom: 16,
          }}
          key={index}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 10,
              gap: 12,
            }}
          >
            <div
              style={{
                flex: 1,
              }}
            >
              <div
                style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: 22,
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                {sondage[0]}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--navy-500)',
                }}
              >
                {sondage[1]}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 10,
                  flexWrap: 'wrap',
                }}
              >
                <Pill kind={sondage[2] === 'Active' ? 'sage' : 'amber'} noDot>
                  {sondage[2]}
                </Pill>
                <Pill noDot>{sondage[3]}</Pill>
                {sondage[5] && (
                  <Pill kind="gold" noDot>
                    Anonyme
                  </Pill>
                )}
                <Pill kind={sondage[4] === 'Terminée' ? 'rust' : 'gold'} noDot>
                  {sondage[4]}
                </Pill>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexShrink: 0,
              }}
            >
              <button
                className="btn"
                onClick={() =>
                  push({
                    kind: 'info',
                    title: sondage[0],
                    desc: 'Voir le détail des réponses',
                  })
                }
              >
                Détails
              </button>
              {sondage[2] === 'Active' && (
                <button
                  className="btn danger sm"
                  onClick={() =>
                    push({
                      kind: 'info',
                      title: 'Clôturer',
                      desc: sondage[0],
                    })
                  }
                >
                  Clôturer
                </button>
              )}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11.5,
              color: 'var(--navy-300)',
              margin: '14px 0 6px',
            }}
          >
            <span>
              {sondage[6]}/{sondage[7]}
              {' lots ont répondu'}
            </span>
            <span>
              <b
                style={{
                  color: 'var(--ink)',
                }}
              >
                {sondage[8]}%
              </b>
            </span>
          </div>
          <ProgressBar pct={sondage[8]} kind="sage" />
          <div
            style={{
              marginTop: 16,
            }}
          >
            {sondage[9].map((option, indexOption) => {
              const totalVoix = sondage[9].reduce((somme, autreOption) => somme + autreOption[1], 0)
              const pourcentage = pourcentageArrondi(option[1], totalVoix)
              return (
                <div
                  style={{
                    marginBottom: 10,
                  }}
                  key={indexOption}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12.5,
                      marginBottom: 4,
                    }}
                  >
                    <span>{option[0]}</span>
                    <span
                      style={{
                        color: 'var(--navy-500)',
                      }}
                    >
                      {option[1]}
                      {' · '}
                      {pourcentage}%
                    </span>
                  </div>
                  <ProgressBar pct={pourcentage} kind={indexOption === 0 ? 'gold' : ''} />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
