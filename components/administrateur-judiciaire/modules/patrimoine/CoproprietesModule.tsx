'use client'

import { useState } from 'react'
import { assembleesDeLaCopro } from '@/components/administrateur-judiciaire/data/assemblees'
import { completerCoproAvecDemo } from '@/components/administrateur-judiciaire/data/coproprietes'
import { FicheAssembleeDetail } from '@/components/administrateur-judiciaire/modules/patrimoine/FicheAssembleeDetail'
import { FormModal, type ValeursFormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { FicheAssemblee } from '@/lib/administrateur-judiciaire/domain/fiche-assemblee'
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
import { enPremierPourCopro, prestataireDeLaCopro } from '@/lib/administrateur-judiciaire/domain/patrimoine-copropriete'
import { useCodeCoproCourant, useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Entreprises de l'immeuble : prestataires sous contrat pour la copropriété, ou qui y interviennent selon leur fiche
 * (démonstration comprise) ; le contrat affiche son statut, sinon « Contrat cadre » ou « Sur demande ».
 */
function entreprisesDeLImmeuble(copro: CoproprieteVue, prestataires: Prestataire[], contrats: Contrat[]): EntrepriseImmeuble[] {
  return prestataires.map(completerAvecDemo).flatMap((prestataire) => {
    if (!prestataireDeLaCopro(prestataire, copro, contrats)) return []
    const contrat = contrats.find((c) => c.prestataireId === prestataire.id && c.coproprieteId === copro.id)
    const sansContrat = prestataire.statut === 'Contrat cadre' ? 'Contrat cadre' : 'Sur demande'
    return [{ nom: prestataire.nom, domaine: prestataire.metier, contrat: contrat?.statut ?? sansContrat }]
  })
}

/** Champs modifiables de la fiche d'une assemblée (tenue, convocation, procès-verbal, notes). */
const CHAMPS_ASSEMBLEE = [
  { name: 'lieu', label: 'Lieu', full: true },
  { name: 'heureDebut', label: 'Début' },
  { name: 'heureFin', label: 'Fin' },
  { name: 'convocationEnvoyeeLe', label: 'Convocation envoyée le', type: 'date' },
  { name: 'convocationPresenteeLe', label: 'Convocation présentée le', type: 'date' },
  { name: 'pvSigneLe', label: 'PV signé le', type: 'date' },
  { name: 'pvPresenteLe', label: 'Notification du PV présentée le', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea', full: true },
] as const

/** Assemblée après saisie : une date vide ou mal formée devient null. */
function modifierAssemblee(assemblee: FicheAssemblee, valeurs: ValeursFormModal): FicheAssemblee {
  const lire = (cle: string) => (valeurs[cle] ?? '').trim()
  const dateOuNull = (cle: string) => (/^\d{4}-\d{2}-\d{2}$/.test(lire(cle)) ? lire(cle) : null)
  return {
    ...assemblee,
    lieu: lire('lieu'),
    heureDebut: lire('heureDebut'),
    heureFin: lire('heureFin'),
    convocationEnvoyeeLe: dateOuNull('convocationEnvoyeeLe'),
    convocationPresenteeLe: dateOuNull('convocationPresenteeLe'),
    pvSigneLe: dateOuNull('pvSigneLe'),
    pvPresenteLe: dateOuNull('pvPresenteLe'),
    notes: lire('notes'),
  }
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
 * Copropriétés administrées (données réelles : base locale, copropriétés fusionnées avec leur mandat). Registre
 * complet : la copropriété choisie dans le sélecteur du haut de page vient en tête, marquée « Copropriété choisie » ;
 * « Lots & copropriétaires » choisit la copropriété de la carte, pour que l'écran des lots s'affiche sur elle.
 * « Détails » et « Modifier » ne changent pas le choix : la carte sur laquelle on travaille garde sa place dans la
 * grille. Sans copropriété choisie (écran rendu seul) : ordre de la base.
 * « Détails » ouvre la fiche sur le modèle de la fiche Mandat de Gestéam (FicheCoproprieteDetail). Création et
 * modification passent par le formulaire rapide du ToastProvider (valeurs pré-remplies en modification, fiche détaillée
 * comprise) ; « Lots & copropriétaires » navigue vers l'écran « lots ». L'indicateur « Assurance RC » (100 %) est en dur.
 */
export function CoproprietesModule() {
  const { push } = useToast()
  const { copros, loading, create, update } = useCoproprietes()
  const { prestataires, contrats } = useDonneesLocales()
  const { choisirCopro } = useSelectionDossier()
  const codeChoisi = useCodeCoproCourant()
  const registre = enPremierPourCopro(copros, (copro) => copro.code === codeChoisi, false)
  const [ficheId, setFicheId] = useState<string | null>(null)
  const [agOuverteId, setAgOuverteId] = useState<string | null>(null)
  const [agEditeeId, setAgEditeeId] = useState<string | null>(null)
  const [agModifiees, setAgModifiees] = useState<Record<string, FicheAssemblee>>({})
  const totalLots = copros.reduce((total, copro) => total + copro.lots, 0)
  const totalBudgets = copros.reduce((total, copro) => total + copro.budget, 0)
  const trouvee = copros.find((copro) => copro.id === ficheId)
  const coproFiche = trouvee ? completerCoproAvecDemo(trouvee) : null
  const assembleesDe = (code: string) => assembleesDeLaCopro(code).map((assemblee) => agModifiees[assemblee.id] ?? assemblee)
  const trouverAg = (id: string | null) =>
    copros.flatMap((copro) => assembleesDe(copro.code)).find((assemblee) => assemblee.id === id) ?? null
  const agOuverte = trouverAg(agOuverteId)
  const agEditee = trouverAg(agEditeeId)
  const coproDeLAg = (assemblee: FicheAssemblee | null) => copros.find((copro) => copro.code === assemblee?.coproCode)

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
          {registre.map((copro) => (
            <div
              className="panel entity-card"
              key={copro.id}
              aria-current={copro.code === codeChoisi ? 'true' : undefined}
            >
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
                    {copro.code === codeChoisi && (
                      <Pill kind="gold" noDot>
                        Copropriété choisie
                      </Pill>
                    )}
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
                    choisirCopro(copro.code)
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
        assemblees={coproFiche ? assembleesDe(coproFiche.code) : []}
        onOuvrirAssemblee={(id) => {
          setFicheId(null)
          setAgOuverteId(id)
        }}
      />
      <FicheAssembleeDetail
        assemblee={agOuverte}
        nomCopro={coproDeLAg(agOuverte)?.nom ?? ''}
        onClose={() => setAgOuverteId(null)}
        onFicheCopropriete={() => {
          setFicheId(coproDeLAg(agOuverte)?.id ?? null)
          setAgOuverteId(null)
        }}
        onModifier={(assemblee) => {
          setAgOuverteId(null)
          setAgEditeeId(assemblee.id)
        }}
      />
      <FormModal
        open={!!agEditee}
        onClose={() => {
          setAgOuverteId(agEditeeId)
          setAgEditeeId(null)
        }}
        title={agEditee ? `Modifier la fiche — AG du ${dateIsoVersFr(agEditee.date)}` : undefined}
        icon="pencil"
        fields={agEditee ? CHAMPS_ASSEMBLEE.map((champ) => ({ ...champ, value: agEditee[champ.name] ?? '' })) : []}
        submitLabel="Enregistrer"
        onDone={(valeurs) => {
          if (!agEditee) return
          setAgModifiees((precedentes) => ({ ...precedentes, [agEditee.id]: modifierAssemblee(agEditee, valeurs) }))
          push({
            kind: 'success',
            title: "Fiche de l'assemblée mise à jour",
            desc: 'Démonstration : la modification disparaît au rechargement de la page.',
          })
        }}
      />
    </>
  )
}
