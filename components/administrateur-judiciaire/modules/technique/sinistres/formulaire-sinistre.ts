import {
  centimesVersSaisieEuros,
  controlerFicheSinistre,
  saisieEurosVersCentimes,
  type ContexteControleFiche,
} from '@/lib/administrateur-judiciaire/domain/fiche-sinistre'
import {
  creerSinistre,
  erreursSaisieSinistre,
  statutSinistre,
  type FicheSinistre,
  type IntervenantSinistre,
  type PartieSinistre,
  type SaisieSinistre,
} from '@/lib/administrateur-judiciaire/domain/sinistres'
import type { PhaseSinistre, StatutSinistre, TypeSinistre } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Valeurs du formulaire de la fiche sinistre (chaînes des champs, cases, choix d'annuaire) et passage à la saisie du
 * domaine. Champ vide → null (jamais chaîne vide) : la connaissance vide reste null, creerSinistre la recopie depuis la
 * survenance ; la phase vide (« — Non précisée — ») reste null. Montants saisis en euros, convertis en centimes entiers.
 * Le statut choisi est contrôlé, jamais stocké. La compagnie et le n° de police d'un contrat choisi se recopient ; ils
 * suivent le contrat (remplacés au changement de contrat, effacés au changement de copropriété) tant qu'ils n'ont pas
 * été modifiés à la main.
 */

/** Choix dans l'annuaire (id) ou saisie libre (id null) ; vide : { id: null, nom: '' }. */
export type ChoixIntervenant = IntervenantSinistre

export const CHOIX_VIDE: ChoixIntervenant = { id: null, nom: '' }

export interface ValeursFicheSinistre {
  numero: string
  dateOuverture: string
  dateSurvenance: string
  dateConnaissance: string
  /** Phase saisie ; '' : non précisée (phase null du domaine). */
  phase: PhaseSinistre | ''
  statut: StatutSinistre
  coproprieteId: string
  mandatId: string
  bail: string
  compagnie: ChoixIntervenant
  numeroSinistre: string
  courtier: ChoixIntervenant
  numeroCourtier: string
  contratId: string
  contrat: string
  type: TypeSinistre | ''
  partiesCommunesLesees: boolean
  partiesCommunesResponsables: boolean
  origine: string
  lieu: string
  dommages: string
  causesSupprimees: boolean
  reparationsFaites: boolean
  indemniteImmediate: string
  indemniteImmediateReglee: boolean
  indemniteDifferee: string
  indemniteDiffereeReglee: boolean
  parties: PartieSinistre[]
  carnetEntretien: boolean
  dateDeclaration: string
  dateExpertise: string
  heureExpertise: string
  dateReglement: string
  dateForclusion: string
  dateRapport: string
  dateCloture: string
  notes: string
  responsable: ChoixIntervenant
  assistant: ChoixIntervenant
  publieExtranet: boolean
}

/** Valeurs d'une nouvelle déclaration : dossier ouvert aujourd'hui, phase « Général », statut « En cours ». */
export function valeursNouvelleDeclaration(defauts: {
  coproprieteId: string
  mandatId: string
  numero: string
  aujourdhui: string
}): ValeursFicheSinistre {
  return {
    numero: defauts.numero,
    dateOuverture: defauts.aujourdhui,
    dateSurvenance: '',
    dateConnaissance: '',
    phase: 'Général',
    statut: 'En cours',
    coproprieteId: defauts.coproprieteId,
    mandatId: defauts.mandatId,
    bail: '',
    compagnie: CHOIX_VIDE,
    numeroSinistre: '',
    courtier: CHOIX_VIDE,
    numeroCourtier: '',
    contratId: '',
    contrat: '',
    type: '',
    partiesCommunesLesees: false,
    partiesCommunesResponsables: false,
    origine: '',
    lieu: '',
    dommages: '',
    causesSupprimees: false,
    reparationsFaites: false,
    indemniteImmediate: '',
    indemniteImmediateReglee: false,
    indemniteDifferee: '',
    indemniteDiffereeReglee: false,
    parties: [],
    carnetEntretien: false,
    dateDeclaration: '',
    dateExpertise: '',
    heureExpertise: '',
    dateReglement: '',
    dateForclusion: '',
    dateRapport: '',
    dateCloture: '',
    notes: '',
    responsable: CHOIX_VIDE,
    assistant: CHOIX_VIDE,
    publieExtranet: false,
  }
}

const choixDe = (id: string | null, nom: string | null): ChoixIntervenant => ({ id, nom: texte(nom) })

/** Valeur d'un champ du formulaire : chaîne vide pour une valeur absente. */
const texte = (valeur: string | null): string => valeur ?? ''

const choixOuVide = (intervenant: IntervenantSinistre | null): ChoixIntervenant => intervenant ?? CHOIX_VIDE

/**
 * Valeurs d'une fiche existante (« Détails »). La connaissance égale à la survenance (recopiée par creerSinistre)
 * s'affiche vide ; une phase non précisée reste non précisée ; une fiche sans mandat reste sans mandat : un mandat null
 * enregistré peut être un choix (« — Non renseigné — », sinistre antérieur au mandat…), indiscernable d'un oubli, donc
 * jamais remplacé d'office par le seul mandat de la copropriété (proposé seulement à la déclaration ou au changement
 * de copropriété).
 */
export function valeursDepuisFiche(fiche: FicheSinistre): ValeursFicheSinistre {
  const { assurance } = fiche
  return {
    ...valeursNouvelleDeclaration({ coproprieteId: fiche.coproprieteId, mandatId: '', numero: '', aujourdhui: '' }),
    numero: texte(fiche.numero),
    dateOuverture: texte(fiche.dateOuverture),
    dateSurvenance: fiche.dateSurvenance,
    dateConnaissance: fiche.dateConnaissance === fiche.dateSurvenance ? '' : fiche.dateConnaissance,
    phase: fiche.phase ?? '',
    statut: statutSinistre(fiche),
    mandatId: texte(fiche.mandatId),
    bail: texte(fiche.bail),
    compagnie: choixDe(assurance.compagnieId, assurance.compagnie),
    numeroSinistre: texte(assurance.numeroSinistre),
    courtier: choixDe(assurance.courtierId, assurance.courtier),
    numeroCourtier: texte(assurance.numeroCourtier),
    contratId: texte(assurance.contratId),
    contrat: texte(assurance.contrat),
    type: fiche.type,
    partiesCommunesLesees: fiche.partiesCommunesLesees,
    partiesCommunesResponsables: fiche.partiesCommunesResponsables,
    origine: fiche.origine,
    lieu: fiche.lieu,
    dommages: fiche.dommages,
    causesSupprimees: fiche.causesSupprimees,
    reparationsFaites: fiche.reparationsFaites,
    indemniteImmediate: centimesVersSaisieEuros(fiche.indemniteImmediateCentimes),
    indemniteImmediateReglee: fiche.indemniteImmediateReglee,
    indemniteDifferee: centimesVersSaisieEuros(fiche.indemniteDiffereeCentimes),
    indemniteDiffereeReglee: fiche.indemniteDiffereeReglee,
    parties: fiche.parties,
    carnetEntretien: fiche.carnetEntretien,
    dateDeclaration: texte(fiche.dateDeclaration),
    dateExpertise: texte(fiche.dateExpertise),
    heureExpertise: texte(fiche.heureExpertise),
    dateReglement: texte(fiche.dateReglement),
    dateForclusion: texte(fiche.dateForclusion),
    dateRapport: texte(fiche.dateRapport),
    dateCloture: texte(fiche.dateCloture),
    notes: fiche.notes,
    responsable: choixOuVide(fiche.responsable),
    assistant: choixOuVide(fiche.assistant),
    publieExtranet: fiche.publieExtranet,
  }
}

/** Contrat d'assurance de la liste « Contrat » : ce qui se recopie à son choix. */
export interface ContratRepris {
  id: string
  compagnie: string | null
  compagnieId: string | null
  numeroPolice: string | null
}

/**
 * Valeurs sans ce qui avait été repris du contrat `contrat` : la compagnie et le n° de police encore égaux à ceux du
 * contrat sont vidés ; une valeur modifiée à la main (différente) est conservée.
 */
function sansReprisesDuContrat(valeurs: ValeursFicheSinistre, contrat: ContratRepris | null): ValeursFicheSinistre {
  if (!contrat) return valeurs
  const compagnieReprise =
    !!contrat.compagnie && valeurs.compagnie.nom === contrat.compagnie && valeurs.compagnie.id === contrat.compagnieId
  const policeReprise = !!contrat.numeroPolice && valeurs.contrat === contrat.numeroPolice
  return {
    ...valeurs,
    compagnie: compagnieReprise ? CHOIX_VIDE : valeurs.compagnie,
    contrat: policeReprise ? '' : valeurs.contrat,
  }
}

/**
 * Valeurs après le choix d'une autre copropriété : mandat (son seul mandat, sinon aucun) et contrat remis à zéro, avec
 * la compagnie et le n° de police qui en avaient été repris (`contratPrecedent`) ; numéro reproposé s'il était encore la
 * proposition faite pour l'ancienne copropriété (une saisie est conservée).
 */
export function valeursAvecCopro(
  precedentes: ValeursFicheSinistre,
  coproprieteId: string,
  {
    mandatId,
    numeroPropose,
    contratPrecedent = null,
  }: {
    mandatId: string
    numeroPropose: (coproprieteId: string) => string | null
    contratPrecedent?: ContratRepris | null
  },
): ValeursFicheSinistre {
  const garderNumero = precedentes.numero !== texte(numeroPropose(precedentes.coproprieteId))
  return {
    ...sansReprisesDuContrat(precedentes, contratPrecedent),
    coproprieteId,
    mandatId,
    contratId: '',
    numero: garderNumero ? precedentes.numero : texte(numeroPropose(coproprieteId)),
  }
}

/**
 * Valeurs après le choix d'un contrat d'assurance (null : « — Aucun — »). Ce qui avait été repris du contrat précédent
 * (`contratPrecedent`) est retiré, puis la compagnie et le n° de police du contrat choisi sont repris dans les champs
 * vides (Gestéam : le n° du contrat choisi « se recopie à côté », tranche 42). Une saisie à la main est conservée ;
 * l'écart avec le contrat est signalé par controlerFicheSinistre (contratChoisi).
 */
export function valeursAvecContrat(
  precedentes: ValeursFicheSinistre,
  contrat: ContratRepris | null,
  contratPrecedent: ContratRepris | null = null,
): ValeursFicheSinistre {
  const base = { ...sansReprisesDuContrat(precedentes, contratPrecedent), contratId: contrat?.id ?? '' }
  if (!contrat) return base
  const reprendreCompagnie = !!contrat.compagnie && !base.compagnie.nom.trim()
  const reprendrePolice = !!contrat.numeroPolice && !base.contrat.trim()
  return {
    ...base,
    compagnie: reprendreCompagnie ? { id: contrat.compagnieId, nom: texte(contrat.compagnie) } : base.compagnie,
    contrat: reprendrePolice ? texte(contrat.numeroPolice) : base.contrat,
  }
}

/** Champ vide → null. */
const ouNull = (valeur: string): string | null => valeur.trim() || null

const intervenantOuNull = (choix: ChoixIntervenant): IntervenantSinistre | null =>
  choix.nom.trim() ? { id: choix.id, nom: choix.nom } : null

/** Erreur rattachée à un champ : clé du formulaire (ou d'un champ de la fiche du domaine) et message. */
interface ErreurChamp {
  champ: string
  message: string
}

/** Erreurs propres au formulaire (avant le domaine) : type et survenance obligatoires, montants lisibles. */
function erreursFormulaire(valeurs: ValeursFicheSinistre): ErreurChamp[] {
  const erreurs: ErreurChamp[] = []
  if (!valeurs.type) erreurs.push({ champ: 'type', message: 'Choisir le type de sinistre.' })
  if (!valeurs.dateSurvenance)
    erreurs.push({ champ: 'dateSurvenance', message: 'Renseigner la date du sinistre (survenance).' })
  if (saisieEurosVersCentimes(valeurs.indemniteImmediate) === null)
    erreurs.push({
      champ: 'indemniteImmediate',
      message: 'Indemnité immédiate illisible : montant en euros positif, deux décimales au plus.',
    })
  if (saisieEurosVersCentimes(valeurs.indemniteDifferee) === null)
    erreurs.push({
      champ: 'indemniteDifferee',
      message: 'Indemnité différée illisible : montant en euros positif, deux décimales au plus.',
    })
  return erreurs
}

/** Saisie du domaine tirée des valeurs (type et montants déjà contrôlés). */
function saisieDepuisValeurs(valeurs: ValeursFicheSinistre, type: TypeSinistre): SaisieSinistre {
  return {
    coproprieteId: valeurs.coproprieteId,
    type,
    phase: valeurs.phase || null,
    dateSurvenance: valeurs.dateSurvenance,
    dateConnaissance: ouNull(valeurs.dateConnaissance),
    dateDeclaration: ouNull(valeurs.dateDeclaration),
    dateExpertise: ouNull(valeurs.dateExpertise),
    dateRapport: ouNull(valeurs.dateRapport),
    dateReglement: ouNull(valeurs.dateReglement),
    dateCloture: ouNull(valeurs.dateCloture),
    partiesCommunesLesees: valeurs.partiesCommunesLesees,
    partiesCommunesResponsables: valeurs.partiesCommunesResponsables,
    origine: valeurs.origine,
    lieu: valeurs.lieu,
    dommages: valeurs.dommages,
    assurance: {
      compagnie: ouNull(valeurs.compagnie.nom),
      compagnieId: valeurs.compagnie.nom.trim() ? valeurs.compagnie.id : null,
      numeroSinistre: ouNull(valeurs.numeroSinistre),
      courtier: ouNull(valeurs.courtier.nom),
      courtierId: valeurs.courtier.nom.trim() ? valeurs.courtier.id : null,
      numeroCourtier: ouNull(valeurs.numeroCourtier),
      contratId: ouNull(valeurs.contratId),
      contrat: ouNull(valeurs.contrat),
    },
    indemniteImmediateCentimes: saisieEurosVersCentimes(valeurs.indemniteImmediate) ?? 0,
    indemniteImmediateReglee: valeurs.indemniteImmediateReglee,
    indemniteDiffereeCentimes: saisieEurosVersCentimes(valeurs.indemniteDifferee) ?? 0,
    indemniteDiffereeReglee: valeurs.indemniteDiffereeReglee,
    causesSupprimees: valeurs.causesSupprimees,
    reparationsFaites: valeurs.reparationsFaites,
    numero: ouNull(valeurs.numero),
    dateOuverture: ouNull(valeurs.dateOuverture),
    mandatId: ouNull(valeurs.mandatId),
    bail: ouNull(valeurs.bail),
    heureExpertise: ouNull(valeurs.heureExpertise),
    dateForclusion: ouNull(valeurs.dateForclusion),
    parties: valeurs.parties,
    carnetEntretien: valeurs.carnetEntretien,
    publieExtranet: valeurs.publieExtranet,
    notes: valeurs.notes,
    responsable: intervenantOuNull(valeurs.responsable),
    assistant: intervenantOuNull(valeurs.assistant),
  }
}

/**
 * Première erreur bloquante de chaque champ, par clé : clé du formulaire (type, dateSurvenance, indemniteImmediate…)
 * ou champ de la fiche visé par le domaine (coproprieteId, numero, dateCloture, statut…), les mêmes noms.
 */
export type ErreursChamps = Readonly<Partial<Record<string, string>>>

export interface EvaluationFicheSinistre {
  /** Saisie prête à enregistrer ; null si une erreur bloque. */
  saisie: SaisieSinistre | null
  bloquants: string[]
  /** Erreurs bloquantes rattachées à leur champ (aria-invalid et message du champ). */
  erreursChamps: ErreursChamps
  alertes: string[]
}

function parChamp(erreurs: readonly ErreurChamp[]): ErreursChamps {
  const resultat: Partial<Record<string, string>> = {}
  for (const { champ, message } of erreurs) resultat[champ] ??= message
  return resultat
}

/** Évaluation refusée : erreurs du formulaire ou de format, sans point d'attention. */
const refusee = (erreurs: readonly ErreurChamp[], bloquants: string[]): EvaluationFicheSinistre => ({
  saisie: null,
  bloquants,
  erreursChamps: parChamp(erreurs),
  alertes: [],
})

/**
 * Évalue le formulaire : erreurs du formulaire, puis de format (domaine), puis anomalies de la fiche entière (statut
 * choisi compris). Seules les anomalies bloquantes empêchent l'enregistrement.
 */
export function evaluerFicheSinistre(
  valeurs: ValeursFicheSinistre,
  contexte: Omit<ContexteControleFiche, 'statutSaisi'>,
): EvaluationFicheSinistre {
  const formulaire = erreursFormulaire(valeurs)
  if (formulaire.length > 0 || !valeurs.type)
    return refusee(
      formulaire,
      formulaire.map((erreur) => erreur.message),
    )
  const saisie = saisieDepuisValeurs(valeurs, valeurs.type)
  // Erreurs de format (dates illisibles…) : sans champ désigné, elles ne figurent que dans le résumé.
  const format = erreursSaisieSinistre(saisie)
  if (format.length > 0) return refusee([], format)
  const anomalies = controlerFicheSinistre(creerSinistre(saisie), { ...contexte, statutSaisi: valeurs.statut })
  const bloquantes = anomalies.filter((anomalie) => anomalie.niveau === 'bloquant')
  return {
    saisie: bloquantes.length > 0 ? null : saisie,
    bloquants: bloquantes.map((anomalie) => anomalie.message),
    erreursChamps: parChamp(bloquantes),
    alertes: anomalies.filter((anomalie) => anomalie.niveau === 'alerte').map((anomalie) => anomalie.message),
  }
}
