'use client'

import { useState } from 'react'
import type { OptionChoixSinistre } from '@/components/administrateur-judiciaire/data/sinistres'
import {
  ChampTexte,
  type PropsBloc,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/BlocsFicheSinistre'
import {
  CaseModifiable,
  ChoixOuSaisie,
  RangeeCases,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/ChampsFiche'
import type {
  ChoixSinistre,
  CoproChoixSinistre,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/choix-sinistre'
import {
  CHOIX_VIDE,
  type ChoixIntervenant,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/formulaire-sinistre'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'
import { dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { suggestionForclusion } from '@/lib/administrateur-judiciaire/domain/fiche-sinistre'
import {
  NATURES_PARTIE_SINISTRE,
  ROLES_PARTIE_SINISTRE,
  type NaturePartieSinistre,
  type PartieSinistre,
  type RolePartieSinistre,
} from '@/lib/administrateur-judiciaire/domain/sinistres'

/**
 * Blocs « Parties » et « Suivi » de la fiche sinistre. Parties : grilles Gestéam « Entreprises / Imm. » et
 * « Personnes » réunies (rôle + nature + fiche de l'annuaire, ou saisie libre), carnet d'entretien ; Courriers et
 * Demandes ⚪ en lecture (aucun rattachement courrier / demande → sinistre : à décider avec Frédéric). Suivi : dates
 * Gestéam et suggestion de forclusion 🔵, jamais recopiée d'office.
 */

/** Annonce un message dans la région aria-live de la fiche. */
export type Annoncer = (message: string) => void

/** Fiches proposées pour une nature de partie : entreprises de l'annuaire, l'immeuble (copropriété), ses personnes. */
function optionsDeNature(
  nature: NaturePartieSinistre,
  choix: ChoixSinistre,
  copro: CoproChoixSinistre | undefined,
): OptionChoixSinistre[] {
  if (nature === 'Entreprise') return [...choix.entreprises]
  if (!copro) return []
  return nature === 'Immeuble' ? [{ id: copro.id, libelle: copro.nom }] : choix.personnesDe(copro.id)
}

const premierChoix = (options: readonly OptionChoixSinistre[]): ChoixIntervenant =>
  options[0] ? { id: options[0].id, nom: options[0].libelle } : CHOIX_VIDE

const libellePartie = (partie: PartieSinistre): string =>
  `${partie.role} · ${partie.nature} · ${partie.libelle}${partie.refId === null ? ' (saisie libre)' : ''}`

function ListeParties({ parties, retirer }: { parties: readonly PartieSinistre[]; retirer: (index: number) => void }) {
  if (parties.length === 0)
    return (
      <p className="muted" style={{ fontSize: 12.5, margin: '0 0 12px' }}>
        Aucune partie enregistrée.
      </p>
    )
  return (
    <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'grid', gap: 6 }}>
      {parties.map((partie, index) => (
        <li
          key={`${partie.role}-${partie.nature}-${partie.libelle}-${index}`}
          style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}
        >
          <span style={{ flex: 1 }}>{libellePartie(partie)}</span>
          <button
            type="button"
            className="btn ghost sm"
            aria-label={`Retirer la partie ${partie.libelle}`}
            onClick={() => retirer(index)}
          >
            Retirer
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Emplacement ⚪ d'une liste liée de Gestéam, sans rattachement dans VitFix. */
function ListeLieeNonRattachee({ titre, colonnes, aucun }: { titre: string; colonnes: string; aucun: string }) {
  return (
    <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
      ⚪ <b>{titre}</b> ({colonnes}) : {aucun} rattaché à un sinistre dans VitFix, rattachement à décider (Frédéric).
    </p>
  )
}

/**
 * Bloc « Parties ». Son état (rôle, nature, partie proposée) se calcule sur la copropriété de la fiche : l'appelant le
 * remonte à chaque changement de copropriété (clé = coproprieteId), sinon la partie proposée resterait celle de
 * l'ancienne copropriété. Une partie n'est rattachée à une fiche (refId) que si cette fiche figure parmi les options
 * proposées ; sinon elle est enregistrée en saisie libre.
 */
export function BlocParties({
  valeurs,
  changer,
  choix,
  annoncer,
}: PropsBloc & { choix: ChoixSinistre; annoncer: Annoncer }) {
  const copro = choix.copros.find((candidate) => candidate.id === valeurs.coproprieteId)
  const [role, setRole] = useState<RolePartieSinistre>('Lésé')
  const [nature, setNature] = useState<NaturePartieSinistre>('Immeuble')
  const options = optionsDeNature(nature, choix, copro)
  const [entite, setEntite] = useState<ChoixIntervenant>(() => premierChoix(options))
  const changerNature = (suivante: NaturePartieSinistre) => {
    setNature(suivante)
    setEntite(premierChoix(optionsDeNature(suivante, choix, copro)))
  }
  const ajouter = () => {
    const libelle = entite.nom.trim()
    if (!libelle) {
      annoncer('Choisir ou nommer la partie avant de l’ajouter.')
      return
    }
    const fichePropose = entite.id !== null && options.some((option) => option.id === entite.id)
    const partie: PartieSinistre = { role, nature, refId: fichePropose ? entite.id : null, libelle }
    changer('parties', [...valeurs.parties, partie])
    annoncer(`Partie ajoutée : ${libellePartie(partie)}.`)
    setEntite(premierChoix(options))
  }
  const retirer = (index: number) => {
    const retiree = valeurs.parties[index]
    changer(
      'parties',
      valeurs.parties.filter((_, rang) => rang !== index),
    )
    if (retiree) annoncer(`Partie retirée : ${libellePartie(retiree)}.`)
  }
  return (
    <>
      <ListeParties parties={valeurs.parties} retirer={retirer} />
      <FieldRow>
        <Field label="Rôle de la partie" name="sinistre-partie-role" hint="« Lésé » observé dans Gestéam ; « Responsable », « Autre » 🔵.">
          <select value={role} onChange={(evenement) => setRole(evenement.target.value as RolePartieSinistre)}>
            {ROLES_PARTIE_SINISTRE.map((possible) => (
              <option key={possible}>{possible}</option>
            ))}
          </select>
        </Field>
        <Field label="Nature de la partie" name="sinistre-partie-nature" hint="Entreprises / Imm. ou Personnes (grilles Gestéam).">
          <select value={nature} onChange={(evenement) => changerNature(evenement.target.value as NaturePartieSinistre)}>
            {NATURES_PARTIE_SINISTRE.map((possible) => (
              <option key={possible}>{possible}</option>
            ))}
          </select>
        </Field>
        <ChoixOuSaisie
          libelle="Partie"
          name="sinistre-partie"
          options={options}
          valeur={entite}
          onChange={setEntite}
          indicationVide="Saisie libre : aucune fiche de cette nature pour cette copropriété."
        />
      </FieldRow>
      <button type="button" className="btn sm" onClick={ajouter} style={{ marginBottom: 14 }}>
        Ajouter la partie
      </button>
      <RangeeCases>
        <CaseModifiable
          libelle="Carnet d’entretien"
          cochee={valeurs.carnetEntretien}
          onChange={(cochee) => changer('carnetEntretien', cochee)}
        />
      </RangeeCases>
      <ListeLieeNonRattachee titre="Courriers" colonnes="Date · Destinataire · Objet" aucun="aucun courrier n’est encore" />
      <ListeLieeNonRattachee titre="Demandes" colonnes="Date · Entreprise · Objet" aucun="aucune demande n’est encore" />
    </>
  )
}

/** Suggestion de forclusion 🔵 (C. assur. L. 114-1), à confirmer : l'utilisateur la reprend, ou non. */
function SuggestionForclusionVue({ valeurs, changer, annoncer }: PropsBloc & { annoncer: Annoncer }) {
  if (!estDateIsoValide(valeurs.dateSurvenance)) return null
  const suggestion = suggestionForclusion({
    dateSurvenance: valeurs.dateSurvenance,
    dateConnaissance: estDateIsoValide(valeurs.dateConnaissance) ? valeurs.dateConnaissance : null,
    type: valeurs.type || null,
  })
  const date = dateIsoVersFr(suggestion.date)
  return (
    <div>
      <Alert kind="" icon="info" title={`${suggestion.marqueur} Suggestion : ${date} (${suggestion.fondement}), à confirmer.`}>
        {suggestion.avertissements.join(' ')}
      </Alert>
      <button
        type="button"
        className="btn ghost sm"
        onClick={() => {
          changer('dateForclusion', suggestion.date)
          annoncer(`Suggestion reprise : forclusion au ${date}, modifiable.`)
        }}
      >
        Reprendre la suggestion
      </button>
    </div>
  )
}

export function BlocSuivi({ valeurs, changer, erreurs, annoncer }: PropsBloc & { annoncer: Annoncer }) {
  const props = { valeurs, changer, erreurs }
  return (
    <>
      <FieldRow>
        <ChampTexte {...props} libelle="Déclaration" cle="dateDeclaration" type="date" />
        <ChampTexte {...props} libelle="Expertise" cle="dateExpertise" type="date" />
        <ChampTexte {...props} libelle="Heure d’expertise" cle="heureExpertise" type="time" />
        <ChampTexte {...props} libelle="Règlement" cle="dateReglement" type="date" />
        <ChampTexte
          {...props}
          libelle="Forclusion"
          cle="dateForclusion"
          type="date"
          hint="Saisie à la main, comme dans Gestéam : jamais remplie d’office."
        />
        <ChampTexte {...props} libelle="Rapport" cle="dateRapport" type="date" />
        <ChampTexte {...props} libelle="Clos le" cle="dateCloture" type="date" hint="Daté : le dossier est « Terminé »." />
      </FieldRow>
      <SuggestionForclusionVue {...props} annoncer={annoncer} />
    </>
  )
}
