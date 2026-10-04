import type {
  DossierImpayeActe,
  ObjectifActeJuge,
  TypeActeJuge,
} from '@/lib/administrateur-judiciaire/domain/actes/actes-juge'
import { dateIsoVersFr, dateVersIso, ecartJours } from '@/lib/administrateur-judiciaire/domain/dates'
import type { EcheanceCalculee } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { badgeStatutEcheance } from '@/lib/administrateur-judiciaire/domain/echeances-affichage'
import type { Fiche360Copropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import { formatDateOuPoint, formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { LIBELLES_REGIMES, regimeDepuisFondement } from '@/lib/administrateur-judiciaire/domain/fondements'

/**
 * Dossier du juge : proposition automatique du document à rédiger (Mode IA), rapport au tribunal et aide-mémoire
 * d'audience composés à partir de la fiche 360 d'une copropriété. Textes repris de la maquette au caractère près.
 */

/** Document proposé au juge (clé de TYPES_ACTES_JUGE). */
export type TypeDocumentJuge = TypeActeJuge

/** Demande adressée au juge (clé de LIBELLES_OBJECTIFS_ACTE_JUGE). */
export type ObjectifDemandeJuge = ObjectifActeJuge

export interface PropositionDocumentJuge {
  type: TypeDocumentJuge
  /** Dans l'ordre où les règles les ont retenus. */
  objectifs: ObjectifDemandeJuge[]
  /** 12 mois en régime art. 29-1, 6 sinon ; null si aucune prorogation n'est proposée. */
  dureeProrogation: number | null
  /** Raisons de la proposition, affichées dans l'encadré « Analyse du dossier ». */
  motifs: string[]
}

/**
 * Ligne du document généré (visualiseur « gendoc ») : paragraphe, intertitre { h }, couple { k, v } ou puce { li }.
 * Compatible avec LigneDocument de ui/toast.
 */
export type LigneDocumentJuge = string | { h: string } | { k: string; v: string } | { li: string }

type EcheanceDatee = EcheanceCalculee & { dateRetenue: string }

/** Seules les Date sont lues comme dates (une chaîne donne « · », comme dans formatDateOuPoint). */
const dateSeulement = (valeur: Date | string): Date | null => (valeur instanceof Date ? valeur : null)

/**
 * Analyse le dossier et propose le document, les demandes et la durée de prorogation. Règles, dans l'ordre :
 * rapport intermédiaire art. 29-1 dû sous 60 jours ; fin de mission sous 60 jours ou dépassée (prorogation) ;
 * convocation de l'AG (syndic judiciaire) échue ; redressement ; obligations échues ; rémunération si la mission
 * a expiré ; à défaut, rapport d'étape sans demande particulière.
 */
export function proposerDocumentJuge(
  fiche: Fiche360Copropriete,
  impayes: readonly DossierImpayeActe[],
  referenceIso: string,
): PropositionDocumentJuge {
  const vue = fiche.vue,
    regime = regimeDepuisFondement(vue.fondement),
    echeances = fiche.echeances.echeances,
    finMission = dateVersIso(vue.echeance),
    joursAvantFin = finMission ? ecartJours(referenceIso, finMission) : null,
    motifs: string[] = [],
    objectifs = new Set<ObjectifDemandeJuge>()
  let type: TypeDocumentJuge = 'rapport_etape'

  const rapportIntermediaire = echeances.find((echeance) => echeance.regleId === 'rapport-intermediaire-ap291')
  if (regime === 'ap291' && rapportIntermediaire && !rapportIntermediaire.accomplie && rapportIntermediaire.dateRetenue) {
    const jours = ecartJours(referenceIso, rapportIntermediaire.dateRetenue)
    if (jours <= 60) {
      type = 'rapport_intermediaire'
      motifs.push(
        `Rapport intermédiaire de l'art. 29-1 ${jours < 0 ? `échu depuis ${-jours} j` : `dû le ${dateIsoVersFr(rapportIntermediaire.dateRetenue)}`}, non enregistré comme rendu.`,
      )
    }
  }

  // joursAvantFin non nul implique finMission non nul.
  if (finMission && joursAvantFin != null && joursAvantFin <= 60) {
    if (type !== 'rapport_intermediaire') type = 'requete_prorogation'
    objectifs.add('prorogation')
    motifs.push(
      joursAvantFin < 0
        ? `Mission expirée depuis ${-joursAvantFin} j : sans prorogation, elle a cessé à la date fixée (Cass. 3e civ., 14 janv. 2016).`
        : `Mission expirant dans ${joursAvantFin} j : la prorogation doit être demandée avant le ${dateIsoVersFr(finMission)}.`,
    )
  }

  const dureeProrogation = objectifs.has('prorogation') ? (regime === 'ap291' ? 12 : 6) : null
  if (dureeProrogation)
    motifs.push(
      `Durée proposée : ${dureeProrogation} mois${regime === 'ap291' ? " (minimum légal pour l'art. 29-1)" : ''}.`,
    )

  const convocationAg = echeances.find((echeance) => echeance.regleId === 'convocation-ag-sj')
  if (
    regime === 'sj' &&
    convocationAg &&
    !convocationAg.accomplie &&
    convocationAg.dateRetenue &&
    convocationAg.dateRetenue < referenceIso
  ) {
    objectifs.add('designation_syndic')
    objectifs.add('difficultes')
    motifs.push(
      `Convocation de l'assemblée en vue de désigner un syndic échue depuis le ${dateIsoVersFr(convocationAg.dateRetenue)} : à expliquer au juge.`,
    )
  }

  const dossiersEnCours = impayes.filter((dossier) => !dossier.statut.startsWith('solde'))
  if (
    regime === 'ap291' ||
    (fiche.tauxImpayes != null && fiche.tauxImpayes >= fiche.seuilAdHoc) ||
    dossiersEnCours.length > 0
  ) {
    objectifs.add('redressement')
    motifs.push(
      `${fiche.debiteurs.length} débiteur${fiche.debiteurs.length > 1 ? 's' : ''} pour ${formatEuros(-fiche.totalDebiteur)}${dossiersEnCours.length ? `, ${dossiersEnCours.length} dossier${dossiersEnCours.length > 1 ? 's' : ''} de recouvrement en cours` : ''}${fiche.tauxImpayes != null && fiche.tauxImpayes >= fiche.seuilAdHoc ? `, impayés à ${Math.round(fiche.tauxImpayes * 100)} % du budget` : ''} : mesures de redressement à exposer.`,
    )
  }

  const obligationsEchues = echeances.filter(
    (echeance) =>
      !echeance.accomplie &&
      echeance.dateRetenue &&
      echeance.dateRetenue < referenceIso &&
      echeance.nature === 'obligation',
  )
  if (obligationsEchues.length) {
    objectifs.add('difficultes')
    motifs.push(
      `${obligationsEchues.length} obligation${obligationsEchues.length > 1 ? 's' : ''} échue${obligationsEchues.length > 1 ? 's' : ''} (${obligationsEchues
        .map((echeance) => echeance.libelle.toLowerCase())
        .slice(0, 2)
        .join(' ; ')}${obligationsEchues.length > 2 ? ' ; …' : ''}) : à expliquer.`,
    )
  }
  if (type === 'requete_prorogation' && joursAvantFin != null && joursAvantFin < 0) {
    objectifs.add('remuneration')
    motifs.push('Mission expirée : demander en même temps la fixation de la rémunération pour la période écoulée.')
  }
  if (motifs.length === 0) motifs.push("Rien de pressant dans le dossier : rapport d'étape sans demande particulière.")
  return {
    type,
    objectifs: Array.from(objectifs),
    dureeProrogation,
    motifs,
  }
}

/**
 * Rapport au tribunal (document « gendoc ») : mission, diligences accomplies, échéances en cours, situation
 * financière déclarée, points d'attention, chronologie (12 derniers événements) et périmètre non couvert.
 */
export function composerRapportJuge(fiche: Fiche360Copropriete, referenceIso: string): LigneDocumentJuge[] {
  const {
      vue,
      personnes,
      debiteurs,
      totalDebiteur,
      tauxImpayes,
      seuilAdHoc,
      echeances: resultatEcheances,
      chronologie,
    } = fiche,
    regime = regimeDepuisFondement(vue.fondement),
    lignes: LigneDocumentJuge[] = []
  lignes.push(
    `Rapport établi au ${dateIsoVersFr(referenceIso)} à partir des données enregistrées dans VitFix Pro pour la copropriété ${vue.nom}.`,
  )
  lignes.push({
    h: 'Mission',
  })
  lignes.push({
    k: 'Fondement',
    v: regime ? LIBELLES_REGIMES[regime].fondement : vue.fondement,
  })
  lignes.push({
    k: 'Décision',
    v: `${vue.tribunal || 'tribunal non renseigné'} · ordonnance du ${formatDateOuPoint(dateSeulement(vue.ordonnance))} · RG ${vue.rg || '·'}`,
  })
  lignes.push({
    k: 'Durée',
    v: `${vue.dureeMois || '·'} mois · fin le ${formatDateOuPoint(dateSeulement(vue.echeance))}`,
  })
  lignes.push({
    k: "Notification de l'ordonnance",
    v: vue.notifOrdonnance || 'non renseignée',
  })
  lignes.push({
    h: 'Diligences accomplies (échéances légales)',
  })
  const accomplies = resultatEcheances.echeances.filter((echeance) => echeance.accomplie)
  if (accomplies.length === 0) lignes.push('Aucun acte enregistré comme accompli.')
  accomplies.forEach((echeance) =>
    lignes.push({
      li: `${echeance.libelle} (${echeance.fondements.join(', ')})${echeance.dateRetenue ? ` · échéance ${dateIsoVersFr(echeance.dateRetenue)}` : ''}`,
    }),
  )
  lignes.push({
    h: 'Échéances en cours',
  })
  const enCours = resultatEcheances.echeances.filter(
    (echeance): echeance is EcheanceDatee =>
      !echeance.accomplie &&
      !!echeance.dateRetenue &&
      (echeance.nature === 'obligation' || echeance.nature === 'repere'),
  )
  if (enCours.length === 0) lignes.push('Aucune.')
  enCours.forEach((echeance) => {
    const badge = badgeStatutEcheance(echeance, referenceIso)
    lignes.push({
      li: `${dateIsoVersFr(echeance.dateRetenue)} · ${echeance.libelle} (${echeance.fondements.join(', ')}) · ${badge.label}`,
    })
  })
  lignes.push({
    h: 'Situation financière déclarée',
  })
  lignes.push({
    k: 'Budget prévisionnel',
    v: formatEuros(vue.budget),
  })
  lignes.push({
    k: 'Charges engagées',
    v: formatEuros(vue.depense),
  })
  lignes.push({
    k: 'Impayés',
    v: `${formatEuros(vue.impayes)}${tauxImpayes != null ? ` (${Math.round(tauxImpayes * 100)} % du budget, seuil de l'art. 29-1 A à ${Math.round(seuilAdHoc * 100)} %)` : ''}`,
  })
  lignes.push({
    k: 'Fonds de travaux',
    v: formatEuros(vue.fondsTravaux),
  })
  lignes.push({
    k: 'Copropriétaires enregistrés',
    v: `${personnes.length}, dont ${debiteurs.length} débiteur${debiteurs.length > 1 ? 's' : ''} pour ${formatEuros(-totalDebiteur)}`,
  })
  lignes.push({
    h: "Points d'attention",
  })
  const enRetard = enCours.filter((echeance) => badgeStatutEcheance(echeance, referenceIso).kind === 'rust')
  if (
    enRetard.length === 0 &&
    (tauxImpayes == null || tauxImpayes < seuilAdHoc || regime === 'ap291') &&
    resultatEcheances.echeances.every((echeance) => echeance.certitude === 'TEXTE')
  )
    lignes.push('Aucun signalement calculé.')
  enRetard.forEach((echeance) =>
    lignes.push({
      li: `${echeance.libelle} : ${badgeStatutEcheance(echeance, referenceIso).label.toLowerCase()} (${echeance.fondements.join(', ')})`,
    }),
  )
  if (tauxImpayes != null && tauxImpayes >= seuilAdHoc && regime !== 'ap291')
    lignes.push({
      li: 'Impayés au-dessus du seuil de saisine pour un mandataire ad hoc (L. 1965 art. 29-1 A).',
    })
  const nonTextuels = resultatEcheances.echeances.filter((echeance) => echeance.certitude !== 'TEXTE')
  if (nonTextuels.length)
    lignes.push({
      li: `${nonTextuels.length} délai${nonTextuels.length > 1 ? 's' : ''} du moteur marqué${nonTextuels.length > 1 ? 's' : ''} à confirmer ou de source secondaire : lecture juridique à valider avant de s'en prévaloir.`,
    })
  lignes.push({
    h: 'Chronologie',
  })
  chronologie.slice(-12).forEach((evenement) =>
    lignes.push({
      li: `${dateIsoVersFr(evenement.date)} · ${evenement.libelle}`,
    }),
  )
  lignes.push(
    'Non couvert par ce rapport, faute de données enregistrées : comptes bancaires et rapprochements, procédures en cours, sinistres, honoraires et frais (taxation au barème à établir séparément).',
  )
  return lignes
}

/**
 * Aide-mémoire d'audience : la copropriété en une ligne, trois chiffres, ce qui est échu (obligations et repères),
 * ce qui vient (5 premières échéances datées, toutes natures) et ce qu'il faut demander au juge.
 * Bizarrerie conservée : le signalement du mandataire ad hoc compare au seuil 0,25 codé en dur (et non fiche.seuilAdHoc).
 */
export function composerAideMemoireAudience(fiche: Fiche360Copropriete, referenceIso: string): LigneDocumentJuge[] {
  const { vue, debiteurs, totalDebiteur, tauxImpayes, echeances: resultatEcheances } = fiche,
    regime = regimeDepuisFondement(vue.fondement),
    aVenir = resultatEcheances.echeances
      .filter(
        (echeance): echeance is EcheanceDatee =>
          !echeance.accomplie && !!echeance.dateRetenue && echeance.dateRetenue >= referenceIso,
      )
      .slice(0, 5),
    echues = resultatEcheances.echeances.filter(
      (echeance): echeance is EcheanceDatee =>
        !echeance.accomplie &&
        !!echeance.dateRetenue &&
        echeance.dateRetenue < referenceIso &&
        (echeance.nature === 'obligation' || echeance.nature === 'repere'),
    )
  return [
    `${vue.nom} · ${vue.adresse} · ${vue.lots} lots · ${regime ? LIBELLES_REGIMES[regime].libelle : vue.fondement}.`,
    {
      h: 'En trois chiffres',
    },
    {
      k: 'Impayés',
      v: `${formatEuros(vue.impayes)}${tauxImpayes != null ? ` · ${Math.round(tauxImpayes * 100)} % du budget` : ''}`,
    },
    {
      k: 'Débiteurs enregistrés',
      v: `${debiteurs.length} · ${formatEuros(-totalDebiteur)}`,
    },
    {
      k: 'Fin de mission',
      v: formatDateOuPoint(dateSeulement(vue.echeance)),
    },
    {
      h: 'Ce qui est échu',
    },
    ...(echues.length
      ? echues.map((echeance) => ({
          li: `${dateIsoVersFr(echeance.dateRetenue)} · ${echeance.libelle}`,
        }))
      : ['Rien.']),
    {
      h: 'Ce qui vient',
    },
    ...(aVenir.length
      ? aVenir.map((echeance) => ({
          li: `${dateIsoVersFr(echeance.dateRetenue)} · ${echeance.libelle} (${echeance.fondements.join(', ')})`,
        }))
      : ['Rien de daté.']),
    {
      h: 'À demander au juge',
    },
    ...(vue.echeance &&
    formatDateOuPoint(dateSeulement(vue.echeance)) !== '·' &&
    resultatEcheances.echeances.some(
      (echeance) =>
        echeance.nature === 'repere' &&
        echeance.dateRetenue &&
        echeance.dateRetenue < referenceIso &&
        !echeance.accomplie,
    )
      ? [
          {
            li: 'Prorogation de la mission : la date fixée est dépassée, la mission cesse à cette date sans prorogation (Cass. 3e civ., 14 janv. 2016).',
          },
        ]
      : []),
    ...(tauxImpayes != null && tauxImpayes >= 0.25 && regime !== 'ap291'
      ? [
          {
            li: 'Signalement : impayés au niveau du seuil de saisine pour un mandataire ad hoc (art. 29-1 A).',
          },
        ]
      : []),
    {
      li: 'Honoraires et frais : état à soumettre séparément, au barème applicable.',
    },
  ]
}
