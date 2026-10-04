'use client'

import { useState, type ReactNode } from 'react'
import { METIERS_PRESTATAIRE } from '@/components/administrateur-judiciaire/data/prestataires'
import { naviguerVers } from '@/components/administrateur-judiciaire/shell/navigation'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { FormModal, type ChampFormModal, type ValeursFormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { usePrestataires } from '@/lib/administrateur-judiciaire/db/hooks'
import type { Prestataire } from '@/lib/administrateur-judiciaire/db/schema'

/** Fiche ouverte par le bouton « Fiche » d'une carte. */
interface FichePrestataire {
  title: ReactNode
  icon: string
  fields: ChampDetail[]
}

/** Formulaire fermé (null), création (« create ») ou modification du prestataire sélectionné. */
type EditionPrestataire = null | 'create' | Prestataire

/** Libellé de la pastille de statut : « Devis », « Sur appel », sinon « Actif » (y compris « Contrat cadre »). */
const libellePastille = (prestataire: Prestataire): string =>
  prestataire.statut === 'Devis en cours' ? 'Devis' : prestataire.statut === 'Sur appel' ? 'Sur appel' : 'Actif'

/** Style des pictogrammes de la grille d'informations d'une carte. */
const STYLE_PICTO_INFO = {
  width: 13,
  height: 13,
  verticalAlign: '-2px',
  marginRight: 4,
}

/**
 * Prestataires (données réelles : base locale). Création et modification via une FormModal (valeurs pré-remplies en
 * modification ; « Assurance décennale » Oui / N/A convertie en booléen). La création fixe ville « », note 0,
 * interventions 0, statut « Actif ». L'indicateur « Note moyenne » est figé à « 4,6 ». « Sync conformité » ne produit
 * qu'un toast de simulation ; « Nouvel OS » navigue vers l'écran des interventions.
 */
export function PrestatairesModule() {
  const { push } = useToast()
  const { prestataires, loading, create, update } = usePrestataires()
  const [fiche, setFiche] = useState<FichePrestataire | null>(null)
  const [edition, setEdition] = useState<EditionPrestataire>(null)

  /**
   * Enregistre la saisie (appelé par FormModal après la fermeture de la modale, sans attendre la promesse).
   * Correctif d'un défaut hérité de la maquette : un échec d'écriture (prestataire supprimé par la réinitialisation de
   * la base dans un autre onglet, quota dépassé…) devenait une promesse rejetée non gérée, sans aucun retour alors que
   * la modale fermée laissait croire l'enregistrement fait. Il est désormais signalé par un toast, comme les autres
   * écrans de la base locale. Le chemin de succès est inchangé.
   */
  const enregistrer = async (valeurs: ValeursFormModal) => {
    const decennale = valeurs.decennale === 'Oui'
    try {
      if (edition && edition !== 'create') {
        await update(edition.id, {
          nom: valeurs.nom,
          metier: valeurs.metier,
          siret: valeurs.siret,
          decennale,
        })
        push({
          kind: 'success',
          title: 'Prestataire modifié',
          desc: `${valeurs.nom} a été mis à jour.`,
        })
      } else {
        await create({
          nom: valeurs.nom,
          metier: valeurs.metier,
          siret: valeurs.siret,
          decennale,
          ville: '',
          note: 0,
          interventions: 0,
          statut: 'Actif',
          pill: 'sage',
        })
        push({
          kind: 'success',
          title: 'Prestataire créé',
          desc: `${valeurs.nom} a été ajouté.`,
        })
      }
      setEdition(null)
    } catch (erreur) {
      push({
        kind: 'warn',
        title: 'Enregistrement impossible',
        desc: erreur instanceof Error ? erreur.message : String(erreur),
      })
    }
  }

  const prestataireEdite = edition && edition !== 'create' ? edition : null
  const champs: ChampFormModal[] = [
    {
      label: 'Raison sociale',
      name: 'nom',
      required: true,
      full: true,
      value: prestataireEdite?.nom,
    },
    {
      label: 'Métier',
      name: 'metier',
      type: 'select',
      options: METIERS_PRESTATAIRE,
      value: prestataireEdite?.metier,
    },
    {
      label: 'SIRET',
      name: 'siret',
      value: prestataireEdite?.siret,
    },
    {
      label: 'Assurance décennale',
      name: 'decennale',
      type: 'select',
      options: ['Oui', 'N/A'],
      value: prestataireEdite ? (prestataireEdite.decennale ? 'Oui' : 'N/A') : undefined,
    },
  ]

  return (
    <>
      <PageHead
        eyebrow="Patrimoine"
        title="Prestataires"
        lede={`${prestataires.length} intervenants référencés · ${prestataires.filter((prestataire) => prestataire.decennale).length} avec assurance décennale · ${prestataires.filter((prestataire) => prestataire.statut === 'Contrat cadre').length} contrats cadre`}
        actions={
          <>
            <button
              className="btn"
              onClick={() =>
                push({
                  kind: 'success',
                  title: 'Simulation',
                  desc: "Aucune vérification de conformité n'a été effectuée.",
                })
              }
            >
              <Icon name="check" />
              Sync conformité
            </button>
            <button className="btn gold" onClick={() => setEdition('create')}>
              <Icon name="plus" />
              Ajouter un prestataire
            </button>
          </>
        }
      />
      <Kpis
        items={[
          {
            icon: 'wrench',
            num: prestataires.length,
            lbl: 'Prestataires référencés',
            sub: 'multi-métiers',
          },
          {
            icon: 'shield',
            num: prestataires.filter((prestataire) => prestataire.decennale).length,
            lbl: 'Avec décennale',
            accent: 'sage',
          },
          {
            icon: 'handshake',
            num: prestataires.filter((prestataire) => prestataire.statut === 'Contrat cadre').length,
            lbl: 'Contrats cadre',
            accent: 'gold',
          },
          {
            icon: 'check',
            num: '4,6',
            lbl: 'Note moyenne',
            accent: 'sage',
          },
        ]}
      />
      {loading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <div className="card-grid cols-2">
          {prestataires.map((prestataire) => (
            <div
              className="panel"
              style={{
                padding: 22,
              }}
              key={prestataire.id}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  gap: 12,
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'Cormorant Garamond, serif',
                        fontSize: 22,
                        fontWeight: 500,
                      }}
                    >
                      {prestataire.nom}
                    </div>
                    {prestataire.statut === 'Contrat cadre' && (
                      <Pill kind="gold" noDot>
                        Contrat cadre
                      </Pill>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--navy-500)',
                      marginTop: 2,
                    }}
                  >
                    {prestataire.metier}
                  </div>
                </div>
                <div
                  style={{
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      color: 'var(--gold-600)',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {'★ '}
                    {String(prestataire.note).replace('.', ',')}
                  </div>
                  <Pill kind={prestataire.pill} noDot>
                    {libellePastille(prestataire)}
                  </Pill>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  fontSize: 12.5,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    color: 'var(--navy-500)',
                  }}
                >
                  <Icon name="pin" style={STYLE_PICTO_INFO} />
                  {prestataire.ville}
                </div>
                <div
                  style={{
                    color: 'var(--navy-500)',
                  }}
                >
                  <Icon name="fact" style={STYLE_PICTO_INFO} />
                  {prestataire.siret}
                </div>
                <div
                  style={{
                    color: 'var(--navy-500)',
                  }}
                >
                  {'Décennale : '}
                  {prestataire.decennale ? 'Oui' : 'N/A'}
                </div>
                <div
                  style={{
                    color: 'var(--navy-500)',
                  }}
                >
                  {prestataire.interventions}
                  {' interventions'}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                }}
              >
                <button
                  className="btn ghost sm"
                  onClick={() =>
                    setFiche({
                      title: prestataire.nom,
                      icon: 'wrench',
                      fields: [
                        {
                          k: 'Métier',
                          v: prestataire.metier,
                        },
                        {
                          k: 'Ville',
                          v: prestataire.ville,
                        },
                        {
                          k: 'SIRET',
                          v: prestataire.siret,
                        },
                        {
                          k: 'Assurance décennale',
                          v: prestataire.decennale ? 'Oui' : 'N/A',
                        },
                        {
                          k: 'Note',
                          v: String(prestataire.note).replace('.', ','),
                        },
                        {
                          k: 'Interventions',
                          v: prestataire.interventions,
                        },
                        {
                          k: 'Statut',
                          v: prestataire.statut,
                        },
                      ],
                    })
                  }
                >
                  Fiche
                </button>
                <button className="btn ghost sm" onClick={() => setEdition(prestataire)}>
                  Modifier
                </button>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    naviguerVers('interventions')
                  }}
                >
                  Nouvel OS
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <FormModal
        open={!!edition}
        onClose={() => setEdition(null)}
        title={prestataireEdite ? `Modifier ${prestataireEdite.nom}` : 'Ajouter un prestataire'}
        icon="wrench"
        fields={champs}
        submitLabel={prestataireEdite ? 'Enregistrer' : 'Ajouter'}
        onDone={enregistrer}
      />
      <DetailModal
        open={!!fiche}
        onClose={() => setFiche(null)}
        title={fiche?.title}
        icon={fiche?.icon}
        fields={fiche?.fields || []}
      />
    </>
  )
}
