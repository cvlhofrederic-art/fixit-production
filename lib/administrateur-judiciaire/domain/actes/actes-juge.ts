import {
  ajouterMois,
  dateIsoVersFr,
  dateVersIso,
  ecartJours,
  estDateIsoValide,
} from '@/lib/administrateur-judiciaire/domain/dates'
import type { EcheanceCalculee } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import type { Fiche360Copropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { LIBELLES_REGIMES, regimeDepuisFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import { analyserRecouvrement } from '@/lib/administrateur-judiciaire/domain/recouvrement'

/**
 * Rédaction automatique des actes adressés au juge (rapports, requête en prorogation) à partir de la fiche 360
 * d'une copropriété. Les textes sont ceux de la maquette, au caractère près ; les données manquantes deviennent
 * des marqueurs « [À COMPLÉTER : …] », comptés dans le résultat.
 */

export interface DefinitionActeJuge {
  libelle: string
  base: string
  quand: string
}

/** Documents rédigeables pour le juge : libellé, base légale et moment où le produire. */
export const TYPES_ACTES_JUGE = {
  rapport_intermediaire: {
    libelle: 'Rapport intermédiaire',
    base: 'L. 1965 art. 29-1 I',
    quand: "administrateur provisoire, au plus tard à l'issue des six premiers mois",
  },
  rapport_etape: {
    libelle: "Rapport d'étape au juge",
    base: 'usage',
    quand: 'à tout moment de la mission, pour rendre compte',
  },
  rapport_fin_mission: {
    libelle: 'Rapport de fin de mission',
    base: 'D. 1967 art. 46 et 47 · L. 1965 art. 29-1',
    quand: "à l'expiration de la mission ou à la désignation d'un syndic",
  },
  requete_prorogation: {
    libelle: 'Requête en prorogation de mission',
    base: 'D. 1967 art. 46 et 47 · L. 1965 art. 29-1',
    quand: "avant la date fixée par l'ordonnance : la mission cesse à cette date (Cass. 3e civ., 14 janv. 2016)",
  },
} satisfies Record<string, DefinitionActeJuge>

export type TypeActeJuge = keyof typeof TYPES_ACTES_JUGE

/** Ce que le mandataire veut dire au juge (boutons de l'écran Dossier du juge). */
export const LIBELLES_OBJECTIFS_ACTE_JUGE = {
  prorogation: 'Demander la prorogation de la mission',
  autorisation_travaux: "Demander l'autorisation de travaux urgents",
  remuneration: 'Demander la fixation de la rémunération',
  redressement: 'Exposer les mesures de redressement financier',
  designation_syndic: "Rendre compte de la désignation d'un syndic",
  difficultes: 'Signaler des difficultés particulières',
} satisfies Record<string, string>

export type ObjectifActeJuge = keyof typeof LIBELLES_OBJECTIFS_ACTE_JUGE

/** Doublon exact de formatEuros dans la maquette. */
export const formatEurosActeJuge = formatEuros

/** Date locale → « JJ/MM/AAAA », ou marqueur « [À COMPLÉTER : date] ». */
export const dateActeOuACompleter = (valeur: Date | string | null | undefined): string => {
  const iso = dateVersIso(valeur ?? null)
  return iso ? dateIsoVersFr(iso) : '[À COMPLÉTER : date]'
}

/** Marqueur de donnée à compléter à la main (compté par la regex /\[À COMPLÉTER/g). */
export const marqueurACompleter = (libelle: string): string => `[À COMPLÉTER : ${libelle}]`

/** « n mot » accordé au pluriel au-delà de 1 (0 reste au singulier). */
export const pluraliserQuantite = (quantite: number, singulier: string, pluriel?: string): string =>
  `${quantite} ${quantite > 1 ? pluriel || singulier + 's' : singulier}`

/** Dossier de recouvrement enregistré (champs lus : copropriétaire concerné et statut « étape:date »). */
export interface DossierImpayeActe {
  coproprietaireId: string
  statut: string
}

export interface ParametresActeJuge {
  type: TypeActeJuge
  objectifs: ObjectifActeJuge[]
  /** Durée de prorogation demandée, en mois (12 à défaut). */
  dureeProrogation?: number
  observations?: string
  signataire?: string
  /** « Cabinet Delaunay » à défaut (l'écran ne le passe jamais). */
  cabinet?: string
}

export interface ActeJugeRedige {
  titre: string
  texte: string
  /** Nombre de marqueurs « [À COMPLÉTER » restant dans le texte. */
  aCompleter: number
  /** Points à vérifier avant envoi. */
  signalements: string[]
}

type EcheanceDatee = EcheanceCalculee & { dateRetenue: string }

const minusculeInitiale = (texte: string): string => texte.charAt(0).toLowerCase() + texte.slice(1)

/**
 * Rédige l'acte demandé. Les sections sont numérotées de IV à VII (au lieu de IV à VI) quand la section
 * « Mesures de redressement » est présente (régime art. 29-1 ou objectif « redressement »).
 */
export function genererActeJuge(
  fiche: Fiche360Copropriete,
  impayes: readonly DossierImpayeActe[],
  params: ParametresActeJuge,
  referenceIso: string,
): ActeJugeRedige {
  const vue = fiche.vue,
    regime = regimeDepuisFondement(vue.fondement),
    qualite =
      regime === 'ap291'
        ? 'administrateur provisoire (loi du 10 juillet 1965, art. 29-1)'
        : regime === 'ap47'
          ? 'administrateur provisoire (décret du 17 mars 1967, art. 47)'
          : 'syndic judiciaire (décret du 17 mars 1967, art. 46)',
    qualiteAvecArticle = (/^[aeiouy]/i.test(qualite) ? "d'" : 'de ') + qualite,
    cabinet = params.cabinet || 'Cabinet Delaunay',
    signataire = params.signataire || marqueurACompleter('nom et qualité du signataire'),
    tribunal = vue.tribunal || marqueurACompleter('tribunal'),
    rg = vue.rg || marqueurACompleter('numéro RG'),
    definition = TYPES_ACTES_JUGE[params.type],
    signalements: string[] = [],
    echeances = fiche.echeances.echeances,
    accomplies = echeances.filter((echeance) => echeance.accomplie),
    enRetard = echeances.filter(
      (echeance): echeance is EcheanceDatee =>
        !echeance.accomplie &&
        !!echeance.dateRetenue &&
        echeance.dateRetenue < referenceIso &&
        (echeance.nature === 'obligation' || echeance.nature === 'repere'),
    ),
    aVenir = echeances
      .filter(
        (echeance): echeance is EcheanceDatee =>
          !echeance.accomplie &&
          !!echeance.dateRetenue &&
          echeance.dateRetenue >= referenceIso &&
          (echeance.nature === 'obligation' || echeance.nature === 'repere' || echeance.nature === 'effet'),
      )
      .slice(0, 6),
    finMission = dateVersIso(vue.echeance),
    missionExpiree = !!finMission && finMission < referenceIso,
    joursAvantFin = finMission ? ecartJours(referenceIso, finMission) : null,
    dossiersEnCours = new Map(
      impayes.filter((dossier) => !dossier.statut.startsWith('solde')).map((dossier) => [dossier.coproprietaireId, dossier]),
    ),
    debiteursEnProcedure = fiche.debiteurs.filter((debiteur) => dossiersEnCours.has(debiteur.id)),
    // Section « Mesures de redressement » présente : décale la numérotation des sections suivantes.
    avecRedressement = regime === 'ap291' || params.objectifs.includes('redressement'),
    lignes: string[] = []

  lignes.push(vue.tribunal ? vue.tribunal.toUpperCase() : tribunal)
  lignes.push(`Affaire : syndicat des copropriétaires ${vue.nom}, ${vue.adresse || marqueurACompleter('adresse')}`)
  lignes.push(`RG ${rg} · Ordonnance du ${dateActeOuACompleter(vue.ordonnance)}`)
  lignes.push('')
  lignes.push(definition.libelle.toUpperCase())
  lignes.push(`Établi le ${dateIsoVersFr(referenceIso)} par ${cabinet}, ${qualite}`)
  lignes.push('')
  if (params.type === 'requete_prorogation') {
    lignes.push('À Monsieur ou Madame le Président du tribunal judiciaire,')
    lignes.push('')
    lignes.push(
      `Le ${cabinet}, désigné en qualité ${qualiteAvecArticle} du syndicat des copropriétaires ${vue.nom} par ordonnance du ${dateActeOuACompleter(vue.ordonnance)} pour une durée de ${vue.dureeMois || marqueurACompleter('durée')} mois, expirant le ${dateActeOuACompleter(vue.echeance)}, a l'honneur d'exposer ce qui suit.`,
    )
  } else {
    lignes.push('Monsieur ou Madame le Président,')
    lignes.push('')
    lignes.push(
      `Le ${cabinet}, désigné en qualité ${qualiteAvecArticle} du syndicat des copropriétaires ${vue.nom} par ordonnance du ${dateActeOuACompleter(vue.ordonnance)}, a l'honneur de vous rendre compte de sa mission dans les termes suivants.`,
    )
  }
  lignes.push('')

  // I. Rappel de la mission
  lignes.push('I. RAPPEL DE LA MISSION')
  lignes.push(
    `La désignation est intervenue sur le fondement de ${regime ? LIBELLES_REGIMES[regime].fondement : vue.fondement}${vue.motif ? `, au motif suivant : ${vue.motif}` : ''}. La mission a été fixée à ${vue.dureeMois || marqueurACompleter('durée')} mois, jusqu'au ${dateActeOuACompleter(vue.echeance)}.`,
  )
  lignes.push(
    vue.notifOrdonnance === 'Effectuée'
      ? `L'ordonnance a été notifiée à l'ensemble des copropriétaires${regime === 'ap291' ? ' (décret du 17 mars 1967, art. 62-5)' : ' (décret du 17 mars 1967, art. 59)'}.`
      : `La notification de l'ordonnance aux copropriétaires ${vue.notifOrdonnance === 'En cours' ? 'est en cours' : "n'est pas encore enregistrée comme effectuée"} ${marqueurACompleter('préciser la date de notification et le mode (voie électronique ou lettre recommandée)')}.`,
  )
  if (vue.notifOrdonnance !== 'Effectuée')
    signalements.push("La notification de l'ordonnance n'est pas enregistrée comme faite : à vérifier avant envoi.")
  lignes.push('')

  // II. Diligences accomplies
  lignes.push('II. DILIGENCES ACCOMPLIES')
  if (accomplies.length === 0) {
    lignes.push(
      `${marqueurACompleter('diligences accomplies depuis la désignation : prise de possession des archives, ouverture du compte, réunions, courriers')}.`,
    )
    signalements.push('Aucun acte enregistré comme accompli : la section II est à compléter à la main.')
  } else {
    lignes.push(`Depuis sa désignation, le ${cabinet} a accompli les diligences suivantes :`)
    for (const echeance of accomplies)
      lignes.push(
        `- ${minusculeInitiale(echeance.libelle)} (${echeance.fondements.join(', ')})${echeance.dateRetenue ? `, dans le délai expirant le ${dateIsoVersFr(echeance.dateRetenue)}` : ''} ;`,
      )
    lignes.push(
      `- ${marqueurACompleter("autres diligences : réunions avec le conseil syndical, correspondances, visites de l'immeuble")}.`,
    )
  }
  lignes.push('')

  // III. Situation de la copropriété
  lignes.push('III. SITUATION DE LA COPROPRIÉTÉ')
  lignes.push(
    `La copropriété comprend ${vue.lots || marqueurACompleter('nombre de lots')} lots. Le budget prévisionnel s'élève à ${formatEurosActeJuge(vue.budget)}, les charges engagées à ${formatEurosActeJuge(vue.depense)} et le fonds de travaux à ${formatEurosActeJuge(vue.fondsTravaux)}.`,
  )
  const tauxImpayes = fiche.tauxImpayes,
    pourcentageImpayes = tauxImpayes != null ? Math.round(tauxImpayes * 100) : null
  lignes.push(
    `Les impayés déclarés atteignent ${formatEurosActeJuge(vue.impayes)}${pourcentageImpayes != null ? `, soit ${pourcentageImpayes} % du budget prévisionnel` : ''}${tauxImpayes != null && tauxImpayes >= fiche.seuilAdHoc && regime !== 'ap291' ? `, au-delà du seuil de ${Math.round(fiche.seuilAdHoc * 100)} % prévu à l'article 29-1 A de la loi du 10 juillet 1965` : ''}.`,
  )
  if (tauxImpayes != null && tauxImpayes >= fiche.seuilAdHoc)
    signalements.push(`Impayés à ${pourcentageImpayes} % du budget : seuil de l'art. 29-1 A atteint.`)
  if (fiche.personnes.length) {
    lignes.push(
      `Sur ${pluraliserQuantite(fiche.personnes.length, 'copropriétaire')} enregistrés, ${pluraliserQuantite(fiche.debiteurs.length, 'est débiteur', 'sont débiteurs')} pour un total de ${formatEurosActeJuge(-fiche.totalDebiteur)}${debiteursEnProcedure.length ? `, dont ${pluraliserQuantite(debiteursEnProcedure.length, 'dossier')} de recouvrement en cours (loi du 10 juillet 1965, art. 19-2)` : ''}.`,
    )
    for (const debiteur of fiche.debiteurs.slice(0, 8)) {
      const dossier = dossiersEnCours.get(debiteur.id),
        // Bizarrerie de la maquette conservée : pas de date d'ouverture (3e argument) transmise.
        analyse = dossier ? analyserRecouvrement(dossier.statut, referenceIso) : null
      lignes.push(
        `- ${debiteur.nom}, ${debiteur.lot} : ${formatEurosActeJuge(-debiteur.solde)}${analyse ? ` · ${analyse.libelle.toLowerCase()}${analyse.depuis ? ` depuis le ${dateIsoVersFr(analyse.depuis)}` : ''}${analyse.exigibiliteLe ? `, exigibilité anticipée ${analyse.exigibiliteLe <= referenceIso ? 'acquise' : `au ${dateIsoVersFr(analyse.exigibiliteLe)}`}` : ''}` : ' · aucune procédure engagée'} ;`,
      )
    }
    if (fiche.debiteurs.length > 8)
      lignes.push(`- et ${fiche.debiteurs.length - 8} autres débiteurs, figurant sur l'état joint.`)
  } else {
    lignes.push(`${marqueurACompleter("état des copropriétaires et des soldes (liste non encore reprise dans l'outil)")}.`)
    signalements.push(
      'Aucun copropriétaire enregistré : importer la liste (écran Reprise judiciaire) avant de rendre compte des impayés.',
    )
  }
  lignes.push(
    `Trésorerie et comptes bancaires : ${marqueurACompleter('solde du compte séparé à la date du rapport et rapprochement bancaire')}.`,
  )
  lignes.push(
    fiche.contrats.length || fiche.sinistres.length
      ? `Contrats et sinistres : ${pluraliserQuantite(fiche.contrats.length, 'contrat')} et ${pluraliserQuantite(fiche.sinistres.length, 'sinistre')} enregistrés.`
      : `Travaux, sinistres et contrats : ${marqueurACompleter('état des contrats en cours, sinistres déclarés, travaux urgents ou votés')}.`,
  )
  lignes.push('')

  // IV. Mesures de redressement (régime art. 29-1 ou objectif « redressement »)
  if (avecRedressement) {
    lignes.push('IV. MESURES DE REDRESSEMENT DE LA SITUATION FINANCIÈRE')
    lignes.push(
      `Conformément à l'article 29-1 de la loi du 10 juillet 1965, les mesures suivantes sont ${params.type === 'rapport_intermediaire' ? 'proposées' : 'poursuivies'} :`,
    )
    lignes.push(
      `- recouvrement des impayés : ${fiche.debiteurs.length ? `${pluraliserQuantite(fiche.debiteurs.length, 'dossier')} pour ${formatEurosActeJuge(-fiche.totalDebiteur)}, par mise en demeure puis procédure accélérée au fond (art. 19-2)` : marqueurACompleter('dossiers de recouvrement')} ;`,
    )
    lignes.push(
      `- ${marqueurACompleter("plan d'apurement des dettes du syndicat (art. 29-5), échéancier négocié avec les créanciers")} ;`,
    )
    lignes.push(`- ${marqueurACompleter('maîtrise des charges : renégociation des contrats, travaux différés ou urgents')} ;`)
    lignes.push(`- ${marqueurACompleter("mobilisation des aides : Anah, MaPrimeRénov' Copropriété, collectivités")}.`)
    const finSuspension = echeances.find((echeance) => echeance.regleId === 'fin-suspension-exigibilite-ap291')
    if (finSuspension != null && finSuspension.dateRetenue)
      lignes.push(
        `La suspension de l'exigibilité des créances antérieures (art. 29-3) court jusqu'au ${dateIsoVersFr(finSuspension.dateRetenue)}${finSuspension.dateRetenue < referenceIso ? ', désormais échue' : ''}.`,
      )
    lignes.push('')
  }

  // Difficultés et points d'attention
  lignes.push(`${avecRedressement ? 'V' : 'IV'}. DIFFICULTÉS ET POINTS D'ATTENTION`)
  const pointsAttention: string[] = []
  if (missionExpiree) {
    pointsAttention.push(
      `la date fixée pour la fin de la mission, le ${dateActeOuACompleter(vue.echeance)}, est dépassée${params.objectifs.includes('prorogation') ? ' ; une prorogation est sollicitée ci-après' : ''}`,
    )
    signalements.push('Mission expirée : la mission cesse à la date fixée sans prorogation (Cass. 3e civ., 14 janv. 2016).')
  } else if (joursAvantFin != null && joursAvantFin <= 60) {
    pointsAttention.push(`la mission expire le ${dateActeOuACompleter(vue.echeance)}, dans ${joursAvantFin} jours`)
    if (!params.objectifs.includes('prorogation'))
      signalements.push(
        `Fin de mission dans ${joursAvantFin} jours : penser à la prorogation ou à l'assemblée de désignation.`,
      )
  }
  for (const echeance of enRetard)
    pointsAttention.push(
      `${minusculeInitiale(echeance.libelle)} (${echeance.fondements.join(', ')}), délai expiré le ${dateIsoVersFr(echeance.dateRetenue)}`,
    )
  if (params.objectifs.includes('difficultes'))
    pointsAttention.push(
      marqueurACompleter(
        'difficultés particulières rencontrées : refus de remise des archives, absence de conseil syndical, procédures en cours, immeuble en péril',
      ),
    )
  if (pointsAttention.length === 0)
    lignes.push(
      "Aucune difficulté particulière n'est à signaler à ce jour, sous réserve des points à compléter ci-dessus.",
    )
  else {
    lignes.push("Les points suivants appellent l'attention du tribunal :")
    for (const point of pointsAttention) lignes.push(`- ${point} ;`)
  }
  if (echeances.some((echeance) => echeance.certitude !== 'TEXTE'))
    signalements.push(
      `${echeances.filter((echeance) => echeance.certitude !== 'TEXTE').length} délai(s) du moteur marqué(s) à confirmer ou de source secondaire : ne pas les invoquer sans vérification.`,
    )
  lignes.push('')

  // Demandes (ou « Par ces motifs » pour la requête)
  const demandes: string[] = []
  if (params.objectifs.includes('prorogation') || params.type === 'requete_prorogation') {
    const dureeProrogation = params.dureeProrogation || 12,
      finProrogee = finMission ? ajouterMois(finMission, dureeProrogation) : null,
      // Durée décimale (« 6,5 ») ou démesurée : la date obtenue n'est pas une date ISO valide, elle n'est pas citée.
      nouvelleFin = finProrogee && estDateIsoValide(finProrogee) ? finProrogee : null
    demandes.push(
      `proroger la mission pour une durée de ${dureeProrogation} mois${nouvelleFin ? `, soit jusqu'au ${dateIsoVersFr(nouvelleFin)}` : ''}, aux fins de ${marqueurACompleter("achever le redressement, tenir l'assemblée de désignation, mener les procédures de recouvrement")}`,
    )
    if (regime === 'ap291' && dureeProrogation < 12)
      signalements.push(
        'Art. 29-1 : la durée de la mission ne peut être inférieure à douze mois ; vérifier la durée de prorogation demandée.',
      )
  }
  if (params.objectifs.includes('autorisation_travaux'))
    demandes.push(
      `autoriser les travaux urgents suivants : ${marqueurACompleter('nature, montant et devis des travaux, urgence caractérisée')}`,
    )
  if (params.objectifs.includes('remuneration'))
    demandes.push(
      `fixer la rémunération et les frais du ${cabinet} conformément à ${regime === 'ap291' ? "l'article 29-1 II de la loi du 10 juillet 1965 et à l'arrêté du 8 octobre 2015" : 'la procédure de taxation (CPC art. 704 et s.)'}, selon l'état joint ${marqueurACompleter("état de frais et d'honoraires")}`,
    )
  if (params.objectifs.includes('designation_syndic'))
    demandes.push(
      `prendre acte de la désignation d'un syndic par l'assemblée générale du ${marqueurACompleter("date de l'assemblée")}, à l'acceptation duquel la mission prendra fin de plein droit (décret du 17 mars 1967, art. 46)`,
    )
  if (params.type === 'rapport_fin_mission')
    demandes.push(
      `constater la fin de la mission au ${dateActeOuACompleter(vue.echeance)} et donner acte de la remise des fonds, documents et archives au syndic désigné, dans les délais de l'article 18-2 de la loi du 10 juillet 1965`,
    )
  lignes.push(
    `${avecRedressement ? 'VI' : 'V'}. ${params.type === 'requete_prorogation' ? 'PAR CES MOTIFS' : 'DEMANDES'}`,
  )
  if (demandes.length === 0)
    lignes.push(`Le ${cabinet} n'a pas de demande particulière à formuler et se tient à la disposition du tribunal.`)
  else {
    lignes.push(`Le ${cabinet} demande au Président du tribunal judiciaire de bien vouloir :`)
    for (const demande of demandes) lignes.push(`- ${demande} ;`)
  }
  lignes.push('')

  // Diligences à venir
  lignes.push(`${avecRedressement ? 'VII' : 'VI'}. DILIGENCES À VENIR`)
  if (aVenir.length === 0) lignes.push(`${marqueurACompleter('prochaines diligences')}.`)
  else
    for (const echeance of aVenir)
      lignes.push(
        `- ${dateIsoVersFr(echeance.dateRetenue)} : ${minusculeInitiale(echeance.libelle)} (${echeance.fondements.join(', ')}) ;`,
      )

  if (params.observations && params.observations.trim()) {
    lignes.push('')
    lignes.push('OBSERVATIONS COMPLÉMENTAIRES')
    lignes.push(params.observations.trim())
  }
  lignes.push('')
  lignes.push(`Le ${cabinet} se tient à la disposition du tribunal pour tout complément.`)
  lignes.push('')
  lignes.push(`Fait à ${marqueurACompleter('lieu')}, le ${dateIsoVersFr(referenceIso)}`)
  lignes.push(signataire)
  lignes.push(`${cabinet} · ${qualite}`)
  lignes.push('')
  lignes.push(
    'Pièces jointes : ' +
      [
        `ordonnance du ${dateActeOuACompleter(vue.ordonnance)}`,
        fiche.personnes.length ? 'état des copropriétaires et des soldes' : null,
        marqueurACompleter('relevés du compte séparé'),
        regime === 'ap291' ? marqueurACompleter('liste des créances déclarées') : null,
      ]
        .filter(Boolean)
        .join(' ; ') +
      '.',
  )

  const texte = lignes.join('\n')
  return {
    titre: `${definition.libelle} · ${vue.nom}`,
    texte,
    aCompleter: (texte.match(/\[À COMPLÉTER/g) || []).length,
    signalements,
  }
}
