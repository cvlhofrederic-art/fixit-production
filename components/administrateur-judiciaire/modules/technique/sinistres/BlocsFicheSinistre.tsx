'use client'

import type { OptionContratSinistre } from '@/components/administrateur-judiciaire/data/sinistres'
import {
  CaseModifiable,
  ChoixOuSaisie,
  RangeeCases,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/ChampsFiche'
import type {
  ChoixSinistre,
  CoproChoixSinistre,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/choix-sinistre'
import type {
  ErreursChamps,
  ValeursFicheSinistre,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/formulaire-sinistre'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'
import { PHASE_SINISTRE, STATUT_SINISTRE, TYPE_SINISTRE } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Contenu des blocs de la fiche sinistre, groupés comme la fiche Gestéam : en-tête ; rattachement ; assurance ;
 * qualification ; indemnités ; notes ; responsable et assistant (parties et suivi : BlocsPartiesSuivi.tsx). Libellés
 * repris de Gestéam (« Origine, cause », « Lieu, situation », « Clos le »…). Champs obligatoires (survenance,
 * copropriété, type) marqués `required` (aria-required, astérisque) ; après un enregistrement refusé, chaque champ en
 * erreur porte son message (aria-invalid), convention de l'interface AJ (Field).
 */

/** Modifie un champ du formulaire. */
export type ChangerValeur = <K extends keyof ValeursFicheSinistre>(cle: K, valeur: ValeursFicheSinistre[K]) => void

export interface PropsBloc {
  valeurs: ValeursFicheSinistre
  changer: ChangerValeur
  /** Erreurs bloquantes par champ, affichées après une tentative d'enregistrement (vide avant). */
  erreurs: ErreursChamps
}

/** Valeurs du formulaire saisies dans un simple champ texte (dates et heure comprises). */
type CleTexte = Exclude<
  { [K in keyof ValeursFicheSinistre]: ValeursFicheSinistre[K] extends string ? K : never }[keyof ValeursFicheSinistre],
  'type' | 'phase' | 'statut' | 'coproprieteId' | 'mandatId' | 'contratId' | 'indemniteImmediate' | 'indemniteDifferee' | 'notes'
>

/** Champ texte (ou date, heure) relié à une valeur du formulaire ; son erreur (après une tentative) lui est rattachée. */
export function ChampTexte({
  libelle,
  cle,
  valeurs,
  changer,
  erreurs,
  type = 'text',
  hint,
  full,
  required,
}: PropsBloc & {
  libelle: string
  cle: CleTexte
  type?: 'text' | 'date' | 'time'
  hint?: string
  full?: boolean
  required?: boolean
}) {
  return (
    <Field label={libelle} name={`sinistre-${cle}`} hint={hint} full={full} required={required} error={erreurs[cle]}>
      <input type={type} value={valeurs[cle]} onChange={(evenement) => changer(cle, evenement.target.value)} />
    </Field>
  )
}

export function BlocEnTete({ valeurs, changer, erreurs }: PropsBloc) {
  const props = { valeurs, changer, erreurs }
  return (
    <FieldRow>
      <ChampTexte
        {...props}
        libelle="N°"
        cle="numero"
        hint="🔵 Proposé : code de la copropriété + « . » + rang sur 5 chiffres (Gestéam : code du mandat) ; modifiable."
      />
      <ChampTexte {...props} libelle="Dossier (ouverture)" cle="dateOuverture" type="date" />
      <ChampTexte {...props} libelle="Sinistre (survenance)" cle="dateSurvenance" type="date" required />
      <ChampTexte
        {...props}
        libelle="Connaissance (si postérieure)"
        cle="dateConnaissance"
        type="date"
        hint="VitFix, hors Gestéam : connaissance du sinistre par l’assuré, si elle suit la survenance (C. assur. L. 113-2)."
      />
      <Field label="Phase" name="sinistre-phase" hint="Où en est le traitement : saisie, jamais déduite des dates.">
        <select
          value={valeurs.phase}
          onChange={(evenement) => changer('phase', evenement.target.value as ValeursFicheSinistre['phase'])}
        >
          <option value="">— Non précisée —</option>
          {PHASE_SINISTRE.map((phase) => (
            <option key={phase}>{phase}</option>
          ))}
        </select>
      </Field>
      <Field
        label="Statut"
        name="sinistre-statut"
        hint="« Terminé » exige la date « Clos le » (bloc Suivi)."
        error={erreurs.statut}
      >
        <select
          value={valeurs.statut}
          onChange={(evenement) => changer('statut', evenement.target.value as ValeursFicheSinistre['statut'])}
        >
          {STATUT_SINISTRE.map((statut) => (
            <option key={statut}>{statut}</option>
          ))}
        </select>
      </Field>
    </FieldRow>
  )
}

/** Libellé de l'option d'une copropriété : son nom, suivi de son code si deux copropriétés portent le même nom. */
export function libelleCopro(copro: CoproChoixSinistre, copros: readonly CoproChoixSinistre[]): string {
  const homonymes = copros.filter((autre) => autre.nom === copro.nom).length
  return homonymes > 1 ? `${copro.nom} (${copro.code})` : copro.nom
}

/** Indication du champ « Mandat » : aucun mandat, mandat proposé 🔵 (seul mandat de la copropriété), ou rien. */
function indicationMandat(nombre: number, propose: boolean): string | undefined {
  if (nombre === 0) return 'Aucun mandat enregistré pour cette copropriété.'
  if (propose) return '🔵 Proposé : seul mandat de cette copropriété, à confirmer (« — Non renseigné — » : aucun rattachement).'
  return undefined
}

export function BlocRattachement({
  valeurs,
  changer,
  erreurs,
  choix,
  changerCopro,
  mandatPropose,
}: PropsBloc & {
  choix: ChoixSinistre
  changerCopro: (coproprieteId: string) => void
  /** Le mandat affiché est la proposition automatique (seul mandat de la copropriété), non encore enregistrée. */
  mandatPropose: boolean
}) {
  const mandats = choix.mandatsDe(valeurs.coproprieteId)
  const coproChoisie = choix.copros.find((copro) => copro.id === valeurs.coproprieteId)
  const idDuLibelle = (libelle: string) =>
    choix.copros.find((copro) => libelleCopro(copro, choix.copros) === libelle)?.id ?? ''
  return (
    <FieldRow>
      <Field label="Copropriété" name="sinistre-copropriete" required error={erreurs.coproprieteId}>
        <select
          value={coproChoisie ? libelleCopro(coproChoisie, choix.copros) : ''}
          onChange={(evenement) => changerCopro(idDuLibelle(evenement.target.value))}
        >
          {!coproChoisie && <option value="">— Choisir —</option>}
          {choix.copros.map((copro) => (
            <option key={copro.id}>{libelleCopro(copro, choix.copros)}</option>
          ))}
        </select>
      </Field>
      <Field
        label="Mandat"
        name="sinistre-mandat"
        hint={indicationMandat(mandats.length, mandatPropose)}
      >
        <select value={valeurs.mandatId} onChange={(evenement) => changer('mandatId', evenement.target.value)}>
          <option value="">— Non renseigné —</option>
          {mandats.map((mandat) => (
            <option key={mandat.id} value={mandat.id}>
              {mandat.libelle}
            </option>
          ))}
        </select>
      </Field>
      <ChampTexte
        valeurs={valeurs}
        changer={changer}
        erreurs={erreurs}
        libelle="Bail"
        cle="bail"
        hint="Saisie libre : gérance, hors périmètre VitFix."
        full
      />
    </FieldRow>
  )
}

const INDICATION_CONTRATS = {
  aucun: 'Aucun contrat d’assurance enregistré pour cette copropriété : saisir le n° du contrat ci-contre.',
  liste: 'Contrats d’assurance de la copropriété : la compagnie et le n° de police se reprennent.',
}

export function BlocAssurance({
  valeurs,
  changer,
  erreurs,
  choix,
  choisirContrat,
}: PropsBloc & { choix: ChoixSinistre; choisirContrat: (contrat: OptionContratSinistre | null) => void }) {
  const contrats = choix.contratsDe(valeurs.coproprieteId)
  const props = { valeurs, changer, erreurs }
  return (
    <FieldRow>
      <ChoixOuSaisie
        libelle="Compagnie"
        name="sinistre-compagnie"
        options={choix.compagnies}
        valeur={valeurs.compagnie}
        onChange={(compagnie) => changer('compagnie', compagnie)}
        indicationVide="Saisie libre : aucune compagnie d’assurance dans l’annuaire."
      />
      <ChampTexte {...props} libelle="N° compagnie" cle="numeroSinistre" hint="Référence du sinistre chez l’assureur." />
      <ChoixOuSaisie
        libelle="Courtier"
        name="sinistre-courtier"
        options={choix.courtiers}
        valeur={valeurs.courtier}
        onChange={(courtier) => changer('courtier', courtier)}
        indicationVide="Saisie libre : aucun courtier dans l’annuaire."
      />
      <ChampTexte {...props} libelle="N° courtier" cle="numeroCourtier" hint="Référence du sinistre chez le courtier." />
      <Field
        label="Contrat"
        name="sinistre-contrat-assurance"
        hint={contrats.length === 0 ? INDICATION_CONTRATS.aucun : INDICATION_CONTRATS.liste}
      >
        <select
          value={valeurs.contratId}
          onChange={(evenement) =>
            choisirContrat(contrats.find((contrat) => contrat.id === evenement.target.value) ?? null)
          }
        >
          <option value="">— Aucun —</option>
          {contrats.map((contrat) => (
            <option key={contrat.id} value={contrat.id}>
              {contrat.libelle}
            </option>
          ))}
        </select>
      </Field>
      <ChampTexte {...props} libelle="N° du contrat" cle="contrat" hint="N° de police." />
    </FieldRow>
  )
}

export function BlocQualification({ valeurs, changer, erreurs }: PropsBloc) {
  const props = { valeurs, changer, erreurs }
  return (
    <>
      <Field label="Type de sinistre" name="sinistre-type" hint="Les 19 types de Gestéam." required error={erreurs.type}>
        <select
          value={valeurs.type}
          onChange={(evenement) => changer('type', evenement.target.value as ValeursFicheSinistre['type'])}
        >
          <option value="">— Choisir —</option>
          {TYPE_SINISTRE.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </Field>
      <RangeeCases>
        <CaseModifiable
          libelle="Parties communes lésées"
          cochee={valeurs.partiesCommunesLesees}
          onChange={(cochee) => changer('partiesCommunesLesees', cochee)}
        />
        <CaseModifiable
          libelle="Parties communes responsables"
          cochee={valeurs.partiesCommunesResponsables}
          onChange={(cochee) => changer('partiesCommunesResponsables', cochee)}
        />
      </RangeeCases>
      <FieldRow>
        <ChampTexte {...props} libelle="Origine, cause" cle="origine" />
        <ChampTexte {...props} libelle="Lieu, situation" cle="lieu" />
        <ChampTexte {...props} libelle="Dommages" cle="dommages" full />
      </FieldRow>
      <RangeeCases>
        <CaseModifiable
          libelle="Causes supprimées"
          cochee={valeurs.causesSupprimees}
          onChange={(cochee) => changer('causesSupprimees', cochee)}
        />
        <CaseModifiable
          libelle="Réparations faites"
          cochee={valeurs.reparationsFaites}
          onChange={(cochee) => changer('reparationsFaites', cochee)}
        />
      </RangeeCases>
    </>
  )
}

/** Une indemnité (immédiate ou différée) : montant en euros et case « réglée ». */
function ChampIndemnite({
  libelle,
  libelleReglee,
  cle,
  cleReglee,
  valeurs,
  changer,
  erreurs,
}: PropsBloc & {
  libelle: string
  libelleReglee: string
  cle: 'indemniteImmediate' | 'indemniteDifferee'
  cleReglee: 'indemniteImmediateReglee' | 'indemniteDiffereeReglee'
}) {
  return (
    <div>
      <Field
        label={libelle}
        name={`sinistre-${cle}`}
        suffix="€"
        hint="En euros, deux décimales au plus."
        error={erreurs[cle]}
      >
        <input inputMode="decimal" value={valeurs[cle]} onChange={(evenement) => changer(cle, evenement.target.value)} />
      </Field>
      <RangeeCases>
        <CaseModifiable libelle={libelleReglee} cochee={valeurs[cleReglee]} onChange={(cochee) => changer(cleReglee, cochee)} />
      </RangeeCases>
    </div>
  )
}

export function BlocIndemnites({ valeurs, changer, erreurs }: PropsBloc) {
  const props = { valeurs, changer, erreurs }
  return (
    <FieldRow>
      <ChampIndemnite
        {...props}
        libelle="Indemnité immédiate"
        libelleReglee="Immédiate réglée"
        cle="indemniteImmediate"
        cleReglee="indemniteImmediateReglee"
      />
      <ChampIndemnite
        {...props}
        libelle="Indemnité différée"
        libelleReglee="Différée réglée"
        cle="indemniteDifferee"
        cleReglee="indemniteDiffereeReglee"
      />
    </FieldRow>
  )
}

export function BlocNotes({ valeurs, changer }: PropsBloc) {
  return (
    <Field label="Notes du dossier" name="sinistre-notes" full>
      <textarea rows={4} value={valeurs.notes} onChange={(evenement) => changer('notes', evenement.target.value)} />
    </Field>
  )
}

export function BlocEquipe({ valeurs, changer, choix }: PropsBloc & { choix: ChoixSinistre }) {
  return (
    <FieldRow>
      <ChoixOuSaisie
        libelle="Responsable"
        name="sinistre-responsable"
        options={choix.collaborateurs}
        valeur={valeurs.responsable}
        onChange={(responsable) => changer('responsable', responsable)}
        indicationVide="Saisie libre : aucun collaborateur dans l’annuaire."
      />
      <ChoixOuSaisie
        libelle="Assistant"
        name="sinistre-assistant"
        options={choix.collaborateurs}
        valeur={valeurs.assistant}
        onChange={(assistant) => changer('assistant', assistant)}
        indicationVide="Saisie libre : aucun collaborateur dans l’annuaire."
      />
    </FieldRow>
  )
}
