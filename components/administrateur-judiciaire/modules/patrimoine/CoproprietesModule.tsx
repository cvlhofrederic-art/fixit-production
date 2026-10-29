'use client'

import { useState } from 'react'
import { completerCoproAvecDemo } from '@/components/administrateur-judiciaire/data/coproprietes'
import { completerAvecDemo } from '@/components/administrateur-judiciaire/data/prestataires'
import {
  FicheCoproprieteDetail,
  type EntrepriseImmeuble,
} from '@/components/administrateur-judiciaire/modules/patrimoine/FicheCoproprieteDetail'
import { naviguerVers } from '@/components/administrateur-judiciaire/shell/navigation'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast, type ValeursFormulaireToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useCoproprietes, useDonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import type { Contrat, Prestataire } from '@/lib/administrateur-judiciaire/db/schema'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { nouvelleFicheCopropriete, type FicheCopropriete } from '@/lib/administrateur-judiciaire/domain/fiche-copropriete'
import { FONDEMENTS_FORMULAIRE_COPROPRIETE } from '@/lib/administrateur-judiciaire/domain/fondements'
import { formatDateFr, formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Entreprises de l'immeuble : prestataires sous contrat pour la copropriété, ou qui y interviennent selon leur fiche
 * (démonstration comprise) ; le contrat affiche son statut, sinon « Contrat cadre » ou « Sur demande ».
 */
function entreprisesDeLImmeuble(copro: CoproprieteVue, prestataires: Prestataire[], contrats: Contrat[]): EntrepriseImmeuble[] {
  return prestataires.map(completerAvecDemo).flatMap((prestataire) => {
    const contrat = contrats.find((c) => c.prestataireId === prestataire.id && c.coproprieteId === copro.id)
    if (!contrat && !prestataire.fiche?.intervientPour.includes(copro.nom)) return []
    const sansContrat = prestataire.statut === 'Contrat cadre' ? 'Contrat cadre' : 'Sur demande'
    return [{ nom: prestataire.nom, domaine: prestataire.metier, contrat: contrat?.statut ?? sansContrat }]
  })
}

/** Fiche détaillée après saisie : immatriculation, SIRET, ICS, alerte de trésorerie, notes et avertissement. */
function ficheSaisie(base: FicheCopropriete, valeurs: ValeursFormulaireToast): FicheCopropriete {
  const lire = (cle: string) => (valeurs[cle] ?? '').trim()
  const alerte = Number.parseInt(lire('alerteTresorerie'), 10)
  return {
    ...base,
    immatriculation: lire('immatriculation'),
    siret: lire('siret'),
    ics: lire('ics'),
    alerteTresorerieEuros: Number.isNaN(alerte) || alerte < 0 ? null : alerte,
    notes: lire('notes'),
    avertissement: lire('avertissement') || null,
  }
}

/**
 * Copropriétés administrées (données réelles : base locale, copropriétés fusionnées avec leur mandat).
 * « Détails » ouvre la fiche sur le modèle de la fiche Mandat de Gestéam (FicheCoproprieteDetail). Création et
 * modification passent par le formulaire rapide du ToastProvider (valeurs pré-remplies en modification, fiche détaillée
 * comprise) ; « Lots & copropriétaires » navigue vers l'écran « lots ». L'indicateur « Assurance RC » (100 %) est en dur.
 */
export function CoproprietesModule() {
  const { push } = useToast()
  const { copros, loading, create, update } = useCoproprietes()
  const { prestataires, contrats } = useDonneesLocales()
  const { choisirCopro } = useSelectionDossier()
  const [ficheId, setFicheId] = useState<string | null>(null)
  const totalLots = copros.reduce((total, copro) => total + copro.lots, 0)
  const totalBudgets = copros.reduce((total, copro) => total + copro.budget, 0)
  const trouvee = copros.find((copro) => copro.id === ficheId)
  const coproFiche = trouvee ? completerCoproAvecDemo(trouvee) : null

  const ouvrirFormulaire = (copro: CoproprieteVue | null) => {
    const fiche = copro ? (completerCoproAvecDemo(copro).fiche ?? nouvelleFicheCopropriete()) : null
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
        ...(fiche
          ? [
              { label: "N° d'immatriculation", name: 'immatriculation', value: fiche.immatriculation, full: false },
              { label: 'SIRET', name: 'siret', value: fiche.siret, full: false },
              { label: 'ICS (prélèvements)', name: 'ics', value: fiche.ics, full: false },
              {
                label: 'Alerte trésorerie sous (€)',
                name: 'alerteTresorerie',
                type: 'number',
                value: fiche.alerteTresorerieEuros === null ? '' : String(fiche.alerteTresorerieEuros),
                full: false,
              },
              { label: 'Notes', name: 'notes', type: 'textarea', value: fiche.notes },
              { label: 'Avertissement (affiché à l’ouverture)', name: 'avertissement', value: fiche.avertissement ?? '' },
            ]
          : []),
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
        return copro && fiche ? update(copro.id, { ...saisie, fiche: ficheSaisie(fiche, valeurs) }) : create(saisie)
      },
    })
  }

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
                  onClick={() => setFicheId(copro.id)}
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
      <FicheCoproprieteDetail
        copro={coproFiche}
        entreprises={coproFiche ? entreprisesDeLImmeuble(coproFiche, prestataires, contrats) : []}
        onClose={() => setFicheId(null)}
        onModifier={(copro) => {
          setFicheId(null)
          ouvrirFormulaire(copro)
        }}
        onFiche360={(copro) => {
          setFicheId(null)
          choisirCopro(copro.code)
          naviguerVers('fiche360')
        }}
      />
    </>
  )
}
