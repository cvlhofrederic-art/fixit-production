'use client'

import { useState, type ReactNode } from 'react'
import { naviguerVers } from '@/components/administrateur-judiciaire/shell/navigation'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useCoproprietes } from '@/lib/administrateur-judiciaire/db/hooks'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { FONDEMENTS_FORMULAIRE_COPROPRIETE } from '@/lib/administrateur-judiciaire/domain/fondements'
import { formatDateFr, formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

/** Fiche détail ouverte par le bouton « Détails » d'une carte. */
interface FicheCopropriete {
  title: string
  icon: string
  footnote?: ReactNode
  fields: ChampDetail[]
}

/**
 * Copropriétés administrées (données réelles : base locale, copropriétés fusionnées avec leur mandat).
 * Création et modification passent par le formulaire rapide du ToastProvider (valeurs pré-remplies en modification) ;
 * « Lots & copropriétaires » navigue vers l'écran « lots ». L'indicateur « Assurance RC » (100 %) est en dur.
 */
export function CoproprietesModule() {
  const { push } = useToast()
  const { copros, loading, create, update } = useCoproprietes()
  const [fiche, setFiche] = useState<FicheCopropriete | null>(null)
  const totalLots = copros.reduce((total, copro) => total + copro.lots, 0)
  const totalBudgets = copros.reduce((total, copro) => total + copro.budget, 0)

  const ouvrirFormulaire = (copro: CoproprieteVue | null) =>
    push({
      kind: 'form',
      icon: 'building',
      title: copro ? `Modifier ${copro.nom}` : 'Nouvelle copropriété',
      fields: [
        {
          label: 'Nom',
          name: 'nom',
          placeholder: 'ex. Résidence des Acacias',
          full: true,
          value: copro?.nom,
        },
        {
          label: 'Nombre de lots',
          name: 'nbLots',
          placeholder: 'ex. 30',
          full: true,
          value: copro ? String(copro.lots) : undefined,
        },
        {
          label: 'Adresse',
          name: 'adresse',
          placeholder: 'Adresse complète',
          full: true,
          value: copro?.adresse,
        },
        {
          label: 'Référence RG',
          name: 'rg',
          placeholder: 'ex. RG 26/01234',
          full: true,
          value: copro?.rg,
        },
        {
          label: 'Régime',
          name: 'fondement',
          type: 'select',
          options: FONDEMENTS_FORMULAIRE_COPROPRIETE,
          full: true,
          value: copro?.fondement,
        },
      ],
      submitLabel: 'Enregistrer',
      toast: {
        title: copro ? 'Copropriété modifiée' : 'Copropriété créée',
      },
      onSubmit: async (valeurs) => {
        const saisie = {
          nom: valeurs.nom,
          adresse: valeurs.adresse,
          nbLots: Number(valeurs.nbLots) || 0,
          rg: valeurs.rg,
          fondement: valeurs.fondement,
        }
        return copro ? update(copro.id, saisie) : create(saisie)
      },
    })

  return (
    <>
      <PageHead
        eyebrow="Patrimoine"
        title="Copropriétés"
        lede="Immeubles administrés dans le cadre des mandats judiciaires — caractéristiques, gestion et conformité."
        actions={
          <button className="btn gold" onClick={() => ouvrirFormulaire(null)}>
            <Icon name="plus" />
            Ajouter
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'building',
            num: copros.length,
            lbl: 'Copropriétés',
            sub: `${totalLots} lots au total`,
          },
          {
            icon: 'users',
            num: totalLots,
            lbl: 'Lots gérés',
            sub: 'résidentiel & mixte',
            accent: 'sage',
          },
          {
            icon: 'coin',
            num: formatEuros(totalBudgets),
            lbl: 'Budgets cumulés',
            sub: 'exercice 2026',
          },
          {
            icon: 'shield',
            num: '100%',
            lbl: 'Assurance RC',
            sub: 'à jour',
            accent: 'sage',
          },
        ]}
      />
      {loading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <div className="card-grid cols-2">
          {copros.map((copro) => (
            <div className="panel entity-card" key={copro.id}>
              <div className="entity-card__head">
                <div className="entity-card__avatar">{copro.code}</div>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div className="entity-card__title">{copro.nom}</div>
                  <div className="entity-card__sub">{copro.adresse}</div>
                  <div
                    style={{
                      marginTop: 6,
                      display: 'flex',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Pill kind={copro.pill}>{copro.statut}</Pill>
                    <Pill kind="navy" noDot>
                      {copro.fondement}
                    </Pill>
                  </div>
                </div>
              </div>
              <div className="entity-card__stats">
                <div>
                  <div className="entity-card__stat-val">{copro.lots}</div>
                  <div className="entity-card__stat-lbl">Lots</div>
                </div>
                <div>
                  <div className="entity-card__stat-val">{formatEuros(copro.budget)}</div>
                  <div className="entity-card__stat-lbl">Budget</div>
                </div>
                <div>
                  <div className="entity-card__stat-val">{formatDateFr(copro.echeance)}</div>
                  <div className="entity-card__stat-lbl">Fin de mission</div>
                </div>
              </div>
              <div className="entity-card__actions">
                <button
                  className="btn ghost sm"
                  onClick={() =>
                    setFiche({
                      title: copro.nom,
                      icon: 'building',
                      footnote: `Désignation : ${copro.tribunal || '—'} · RG ${copro.rg} · ordonnance du ${formatDateFr(copro.ordonnance)}.`,
                      fields: [
                        {
                          k: 'Adresse',
                          v: copro.adresse,
                          full: true,
                        },
                        {
                          k: 'Lots',
                          v: copro.lots,
                        },
                        {
                          k: 'Fondement',
                          v: copro.fondement,
                        },
                        {
                          k: 'Budget',
                          v: formatEuros(copro.budget),
                        },
                        {
                          k: 'Charges engagées',
                          v: formatEuros(copro.depense),
                        },
                        {
                          k: 'Impayés',
                          v: formatEuros(copro.impayes),
                        },
                        {
                          k: 'Fonds de travaux',
                          v: formatEuros(copro.fondsTravaux),
                        },
                        {
                          k: 'Notification ordonnance',
                          v: copro.notifOrdonnance,
                        },
                        {
                          k: 'Motif',
                          v: copro.motif || '—',
                          full: true,
                        },
                      ],
                    })
                  }
                >
                  Détails
                </button>
                <button className="btn ghost sm" onClick={() => ouvrirFormulaire(copro)}>
                  Modifier
                </button>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    naviguerVers('lots')
                  }}
                >
                  {'Lots & copropriétaires'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <DetailModal
        open={!!fiche}
        onClose={() => setFiche(null)}
        title={fiche?.title}
        icon={fiche?.icon}
        fields={fiche?.fields || []}
        footnote={fiche?.footnote}
      />
    </>
  )
}
