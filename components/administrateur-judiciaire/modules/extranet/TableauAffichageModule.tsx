'use client'

import { DEMO_AVIS_AFFICHAGE, type TeinteAvis } from '@/components/administrateur-judiciaire/data/avis-affichage'
import { CHAMP_COPROPRIETE } from '@/components/administrateur-judiciaire/data/elements-communs'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/** Catégorie du panneau latéral : [libellé, nombre d'avis, teinte de la pastille]. */
export type CategorieAffichage = [libelle: string, nombre: number, teinte: string]

/** Compteurs par catégorie, saisis en dur (non dérivés des avis affichés). */
const CATEGORIES_AFFICHAGE: readonly CategorieAffichage[] = [
  ['Assemblée', 3, 'gold'],
  ['Technique', 5, 'sage'],
  ['Finances', 2, 'amber'],
  ['Juridique', 4, 'rust'],
]

/** Variable CSS de la bordure gauche d'un avis selon sa teinte (sauge par défaut). */
const variableBordureAvis = (teinte: TeinteAvis): string =>
  teinte === 'rust' ? '--rust-500' : teinte === 'amber' ? '--amber-500' : teinte === 'gold' ? '--gold-500' : '--sage-500'

/**
 * Panneau d'affichage (barre latérale : « Tableau d'affichage » ; surtitre « Gestion courante »).
 * La recherche et les trois listes déroulantes ne sont pas branchées ; « Détails » n'affiche qu'un toast.
 */
export function TableauAffichageModule() {
  const { push } = useToast()

  return (
    <>
      <PageHead
        eyebrow="Gestion courante"
        title="Panneau d'affichage"
        lede="Communiquez avec les copropriétaires de façon claire et tracée."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'bell',
                title: "Nouvel avis d'affichage",
                fields: [
                  CHAMP_COPROPRIETE,
                  {
                    label: 'Titre',
                    placeholder: "ex. Coupure d'eau programmée",
                    full: true,
                  },
                  {
                    label: 'Catégorie',
                    type: 'select',
                    options: ['Information', 'Travaux', 'Urgent', 'Réglementaire'],
                    full: true,
                  },
                  {
                    label: 'Contenu',
                    type: 'textarea',
                    placeholder: "Texte de l'avis…",
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Avis publié',
                },
              })
            }
          >
            <Icon name="plus" />
            Nouvel avis
          </button>
        }
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            position: 'relative',
          }}
        >
          <Icon
            name="search"
            style={{
              position: 'absolute',
              left: 12,
              top: 11,
              width: 14,
              height: 14,
              color: 'var(--navy-300)',
            }}
          />
          <input
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              border: '1px solid var(--line-strong)',
              borderRadius: 8,
              fontSize: 13,
            }}
            aria-label="Rechercher un avis"
            placeholder="Rechercher un avis…"
          />
        </div>
        <select className="btn" aria-label="Statut">
          <option>Actifs</option>
          <option>Archivés</option>
        </select>
        <select className="btn" aria-label="Catégorie">
          <option>Toutes catégories</option>
        </select>
        <select className="btn" aria-label="Copropriété">
          <option>Toutes copropriétés</option>
        </select>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 16,
        }}
      >
        <div>
          {DEMO_AVIS_AFFICHAGE.map((avis, index) => (
            <div
              className="panel"
              style={{
                padding: '18px 20px',
                marginBottom: 12,
                borderLeft: `3px solid var(${variableBordureAvis(avis[7])})`,
              }}
              key={index}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 8,
                  flexWrap: 'wrap',
                }}
              >
                <Pill kind="gold" noDot>
                  {avis[0]}
                </Pill>
                <Pill noDot>{avis[1]}</Pill>
                {avis[2] && (
                  <Pill kind={avis[2] === 'Urgente' ? 'rust' : 'gold'} noDot>
                    {avis[2]}
                  </Pill>
                )}
                <Pill noDot>{avis[3]}</Pill>
              </div>
              <div
                style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: 20,
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                {avis[4]}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--navy-500)',
                  marginBottom: 10,
                }}
              >
                {avis[5]}
              </div>
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
                  {avis[6] !== '—' ? `Échéance ${avis[6]}` : 'Sans échéance'}
                </span>
                <button
                  className="btn ghost sm"
                  onClick={() =>
                    push({
                      kind: 'info',
                      title: avis[4],
                      desc: "Ouvrir l'avis",
                    })
                  }
                >
                  Détails
                </button>
              </div>
            </div>
          ))}
        </div>
        <div>
          <Panel title="Catégories" icon="grid">
            {CATEGORIES_AFFICHAGE.map((categorie, index) => (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: index < 3 ? '1px solid var(--line)' : 'none',
                }}
                key={index}
              >
                <span
                  style={{
                    fontSize: 13,
                  }}
                >
                  <span className={`dot-status ${categorie[2]}`} />
                  {' '}
                  {categorie[0]}
                </span>
                <b
                  style={{
                    fontSize: 13,
                  }}
                >
                  {categorie[1]}
                </b>
              </div>
            ))}
          </Panel>
          <div
            style={{
              height: 12,
            }}
          />
          <Panel title="Diffusion" icon="mail">
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--navy-500)',
                lineHeight: 1.6,
              }}
            >
              {
                "Les avis sont diffusés sur l'extranet copropriétaire et par e-mail. Les avis urgents déclenchent une notification."
              }
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}
