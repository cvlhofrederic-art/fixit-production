'use client'

import { useState } from 'react'
import { BlocFiche } from '@/components/administrateur-judiciaire/modules/technique/sinistres/ChampsFiche'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Champ } from '@/components/administrateur-judiciaire/ui/FicheBlocs'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import {
  controlerDelaiDeclaration,
  type ControleDelaiDeclaration,
  type EtatDelaiDeclaration,
} from '@/lib/administrateur-judiciaire/domain/declaration-sinistre'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  controlerChronologieSinistre,
  DELAIS_ASSURANCE_SINISTRE,
  etapeSuiviSinistre,
  indemnitesSinistre,
  reperesDelaisSinistre,
  statutSinistre,
  type EtapeSuiviSinistre,
  type FicheSinistre,
  type ReperesDelaisSinistre,
} from '@/lib/administrateur-judiciaire/domain/sinistres'

/**
 * Synthèse en tête de la fiche sinistre, d'après la maquette du 27/10/2026 (MaquetteSinistrePanel, sans son sélecteur
 * d'exemples) : frise des étapes, phase et statut, indemnités, repères de délai, chronologie. Tout est lu dans le
 * domaine : etapeSuiviSinistre, statutSinistre, indemnitesSinistre, reperesDelaisSinistre, controlerDelaiDeclaration et
 * controlerChronologieSinistre.
 * - Calculée sur la saisie en cours du formulaire (ficheDeSynthese), comme les points d'attention ; absente (fiche
 *   null) sans type ni survenance, ou sur une date illisible.
 * - Entrées non enregistrées, repli prévu par le domaine : délai du contrat absent (minimum légal) ; aucun courrier de
 *   déclaration rattaché (contrôle sur la date saisie) ; date de l'arrêté de catastrophe naturelle absente (pas de
 *   repère). Leur enregistrement reste à brancher.
 * - Les repères sont des signaux, jamais une déchéance : l'avertissement du contrôle du délai est toujours affiché.
 * - Chronologie signalée dès l'ouverture, comme la maquette (Alert « warn ») : la fiche ne la montre qu'après un clic
 *   sur « Enregistrer » (résumé des erreurs), et l'état du délai peut se lire sur une date que la chronologie refuse.
 * - Annoncés poliment : le message de l'état du délai et les alertes de chronologie, pas les textes de loi.
 * - Décision #699 : aucun délai entre étapes ; aucun délai de gestion du cabinet n'est enregistré.
 * - Repliable comme les neuf autres blocs (BlocFiche), décision du 19/11 (#759, point 12) : replié, le bouton dit
 *   « Déplier ».
 * Même affichage en démonstration et en données réelles : rien ici ne lit le mode.
 */

const ETAPES: readonly { cle: EtapeSuiviSinistre; libelle: string }[] = [
  { cle: 'a_declarer', libelle: 'À déclarer' },
  { cle: 'declare', libelle: 'Déclaré' },
  { cle: 'expertise', libelle: 'Expertise' },
  { cle: 'rapport', libelle: 'Rapport' },
  { cle: 'regle', libelle: 'Réglé' },
  { cle: 'clos', libelle: 'Clos' },
]

/** Couleur du bandeau : rouille au-delà du repère, information dans le repère ou sans repère, sinon à vérifier. */
const COULEUR_ETAT: Record<EtatDelaiDeclaration, string> = {
  tardive: 'rust',
  delai_depasse: 'rust',
  dans_le_delai: 'info',
  sans_repere: 'info',
  a_declarer: '',
  a_verifier: '',
  declaration_non_datee: '',
}

/** Aucun courrier de déclaration n'est encore rattaché au sinistre : le contrôle lit la date saisie. */
const AUCUN_COURRIER = [] as const

const euros = (centimes: number): string => formatEurosCentimes(centimes / 100)

/**
 * Avertissement du contrôle, suivi entre parenthèses de ses fondements qu'il ne cite pas déjà sous la même forme
 * (décision du 19/11, #759, point 20). Droit commun : le rappel cite déjà « C. assur. art. L. 113-2, 4° », la parenthèse
 * disparaît. L'autre forme (« C. assur. L. … ») vient du domaine et n'est pas comparée ici.
 */
function avertissementEtFondements(controle: ControleDelaiDeclaration): string {
  const nonCites = controle.fondements.filter((fondement) => !controle.avertissement.includes(fondement))
  return nonCites.length === 0 ? controle.avertissement : `${controle.avertissement} (${nonCites.join(' · ')})`
}

/**
 * Lignes du bandeau, sous l'état du délai. La justification du repère et sa raison « à confirmer » ne sont données que
 * si le contrôle retient ce même repère, ou aucun délai (dommages-ouvrage) : sans date d'arrêté, la catastrophe
 * naturelle n'a pas de repère, le titre en donne la raison.
 */
function lignesReperes(reperes: ReperesDelaisSinistre, controle: ControleDelaiDeclaration): string[] {
  const memeRepere = reperes.desLaConnaissance || controle.declarationAuPlusTard === reperes.declarationAuPlusTard
  const lignes = [
    memeRepere ? reperes.justificationDeclaration : null,
    memeRepere && reperes.declarationAConfirmer !== null ? `Repère à confirmer : ${reperes.declarationAConfirmer}.` : null,
    reperes.volPossible
      ? `Repère à confirmer : ${DELAIS_ASSURANCE_SINISTRE.declarationVolJoursOuvres} jours ouvrés s'il y a eu vol.`
      : null,
    avertissementEtFondements(controle),
    `Prescription, repère indicatif : ${reperes.justificationPrescription}`,
    reperes.prescriptionAConfirmer === null ? null : `Prescription à confirmer : ${reperes.prescriptionAConfirmer}.`,
  ]
  return lignes.filter((ligne): ligne is string => ligne !== null)
}

/** Couleur d'une étape de la frise : l'étape en cours, les étapes passées, puis les suivantes (sans couleur). */
function couleurEtape(index: number, rang: number): 'gold' | 'sage' | undefined {
  if (index === rang) return 'gold'
  if (index < rang) return 'sage'
  return undefined
}

/** Contenu de la synthèse, calculé seulement quand le bloc est ouvert (BlocFiche ne rend pas un contenu replié). */
function ContenuSynthese({ fiche, aujourdhui }: Readonly<{ fiche: FicheSinistre; aujourdhui: string }>) {
  const rang = ETAPES.findIndex((etape) => etape.cle === etapeSuiviSinistre(fiche))
  const indemnites = indemnitesSinistre(fiche)
  const reperes = reperesDelaisSinistre(fiche)
  const controle = controlerDelaiDeclaration({ id: 'fiche', fiche }, AUCUN_COURRIER, { aujourdhui })
  const chronologie = controlerChronologieSinistre(fiche)
  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <ol
          aria-label="Étapes du suivi"
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap', listStyle: 'none', margin: 0, padding: 0 }}
        >
          {ETAPES.map((etape, index) => (
            <li key={etape.cle} aria-current={index === rang ? 'step' : undefined}>
              <Pill kind={couleurEtape(index, rang)}>{etape.libelle}</Pill>
            </li>
          ))}
        </ol>
        {/*
          Sur la ligne de la frise, comme la maquette (décision du 19/11, #759, écart 24). Dans la fiche à sa largeur
          maximale (720 px), frise et phase ne tiennent pas côte à côte à leur largeur naturelle : la phase prend la
          place restante à droite de la frise (environ 190 px, 175 px avec une barre de défilement classique), son
          texte passe sur deux lignes, trois pour les phases les plus longues, aligné à droite. Base de 165 px : à cette
          largeur, chaque phase Gestéam tient sur trois lignes au plus (la plus longue, « Complément de document », dès
          161 px). S'il reste moins de place (écran de moins de 745 à 760 px environ, selon la barre de défilement), la
          phase passe sous la frise, sur une ligne, alignée à droite, comme sur téléphone.
        */}
        <span style={{ marginLeft: 'auto', fontSize: 12.5, flex: '1 1 165px', textAlign: 'right' }}>
          Phase Gestéam : <b>{fiche.phase ?? '—'}</b> · Statut : <b>{statutSinistre(fiche)}</b>
        </span>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Champ
          k="Indemnités"
          v={
            <>
              Total : {euros(indemnites.totalCentimes)} · Réglé : {euros(indemnites.regleCentimes)} ·{' '}
              <b>Reste à recevoir : {euros(indemnites.resteCentimes)}</b>
            </>
          }
        />
      </div>
      <Alert kind={COULEUR_ETAT[controle.etat]} icon="clock" title={<span aria-live="polite">{controle.message}</span>}>
        {lignesReperes(reperes, controle).map((ligne) => (
          <span key={ligne} style={{ display: 'block' }}>
            {ligne}
          </span>
        ))}
      </Alert>
      <div aria-live="polite">
        {chronologie.map((anomalie) => (
          <Alert key={anomalie.champ} kind="warn" icon="alert" title={anomalie.message} />
        ))}
      </div>
    </>
  )
}

/**
 * Bloc « Synthèse » : le bloc repliable des autres blocs de la fiche (BlocFiche), ouvert à l'ouverture de la fiche.
 * Replié, son bouton dit « Déplier » (rien à compléter ici). Il reste replié pendant la saisie, même si la synthèse
 * disparaît puis revient (type effacé puis choisi) : le composant reste monté.
 */
export function SyntheseSinistre({ fiche, aujourdhui }: Readonly<{ fiche: FicheSinistre | null; aujourdhui: string }>) {
  const [ouvert, setOuvert] = useState(true)
  if (!fiche) return null
  return (
    <BlocFiche
      titre="Synthèse"
      icone="history"
      ouvert={ouvert}
      onBasculer={() => setOuvert((precedent) => !precedent)}
      actionRepliee="Déplier"
    >
      <ContenuSynthese fiche={fiche} aujourdhui={aujourdhui} />
    </BlocFiche>
  )
}
