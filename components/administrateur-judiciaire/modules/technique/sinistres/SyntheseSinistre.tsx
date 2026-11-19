'use client'

import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Champ, Section } from '@/components/administrateur-judiciaire/ui/FicheBlocs'
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
    `${controle.avertissement} (${controle.fondements.join(' · ')})`,
    `Prescription, repère indicatif : ${reperes.justificationPrescription}`,
    reperes.prescriptionAConfirmer === null ? null : `Prescription à confirmer : ${reperes.prescriptionAConfirmer}.`,
  ]
  return lignes.filter((ligne): ligne is string => ligne !== null)
}

export function SyntheseSinistre({ fiche, aujourdhui }: { fiche: FicheSinistre | null; aujourdhui: string }) {
  if (!fiche) return null
  const rang = ETAPES.findIndex((etape) => etape.cle === etapeSuiviSinistre(fiche))
  const indemnites = indemnitesSinistre(fiche)
  const reperes = reperesDelaisSinistre(fiche)
  const controle = controlerDelaiDeclaration({ id: 'fiche', fiche }, AUCUN_COURRIER, { aujourdhui })
  const chronologie = controlerChronologieSinistre(fiche)
  return (
    <Section titre="Synthèse" icone="history" large>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <ol
          aria-label="Étapes du suivi"
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap', listStyle: 'none', margin: 0, padding: 0 }}
        >
          {ETAPES.map((etape, index) => (
            <li key={etape.cle} aria-current={index === rang ? 'step' : undefined}>
              <Pill kind={index === rang ? 'gold' : index < rang ? 'sage' : undefined}>{etape.libelle}</Pill>
            </li>
          ))}
        </ol>
        <span style={{ marginLeft: 'auto', fontSize: 12.5 }}>
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
    </Section>
  )
}
