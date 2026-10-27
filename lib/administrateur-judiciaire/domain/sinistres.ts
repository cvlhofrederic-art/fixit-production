import { ajouterJours, ajouterMois, estDateIsoValide, estJourOuvrable } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  PHASE_SINISTRE,
  TYPE_SINISTRE,
  type PhaseSinistre,
  type StatutSinistre,
  type TypeSinistre,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Sinistres d'une copropriété (cartographie Gestéam, tranches 20 et 28). Fonctions pures, dates ISO (AAAA-MM-JJ),
 * montants en CENTIMES ENTIERS, sans écran.
 *
 * Gestéam — fiche : dossier, survenance, phase ; immeuble, mandat, bail ; compagnie, courtier, contrat (+ n°) ; type,
 * parties communes lésées / responsables, origine, lieu, dommages, causes supprimées, réparations faites ; indemnité
 * immédiate et différée (chacune « réglée ») ; suivi : déclaration, expertise, rapport, règlement, forclusion, clôture.
 * Type, phase et statut : référentiels complets TYPE_SINISTRE, PHASE_SINISTRE et STATUT_SINISTRE (tranche 20). La phase
 * Gestéam est SAISIE (où en est le traitement) ; l'étape de suivi, elle, se déduit des dates : deux axes, à ne pas
 * fusionner.
 *
 * Repères de délais (C. assur.) : INDICATIFS. La déclaration se fait dans le délai du contrat, qui ne peut être
 * inférieur à 5 jours ouvrés (2 pour le vol) depuis la connaissance du sinistre (art. L. 113-2) ; l'action se prescrit
 * par deux ans depuis l'événement (art. L. 114-1), délai interrompu ou reporté selon l'art. L. 114-2. Le contrat et
 * les faits du dossier priment : ces dates ne sont jamais présentées comme des échéances certaines.
 * 🔴 À confirmer sur Légifrance avant d'en faire des échéances au calendrier réglementaire.
 */

export interface AssuranceSinistre {
  compagnie: string | null
  courtier: string | null
  contrat: string | null
  numeroSinistre: string | null
}

export interface SaisieSinistre {
  coproprieteId: string
  type: TypeSinistre
  /** Phase de traitement Gestéam, saisie ; null si non précisée. */
  phase: PhaseSinistre | null
  dateSurvenance: string
  /** Connaissance du sinistre par l'assuré, si postérieure à la survenance ; null = survenance. */
  dateConnaissance: string | null
  dateDeclaration: string | null
  dateExpertise: string | null
  dateRapport: string | null
  dateReglement: string | null
  dateCloture: string | null
  partiesCommunesLesees: boolean
  partiesCommunesResponsables: boolean
  origine: string
  lieu: string
  dommages: string
  assurance: AssuranceSinistre
  indemniteImmediateCentimes: number
  indemniteImmediateReglee: boolean
  indemniteDiffereeCentimes: number
  indemniteDiffereeReglee: boolean
  causesSupprimees: boolean
  reparationsFaites: boolean
}

export interface FicheSinistre extends SaisieSinistre {
  dateConnaissance: string
}

const DATES_SUIVI = ['dateDeclaration', 'dateExpertise', 'dateRapport', 'dateReglement', 'dateCloture'] as const

const verifierDate = (champ: string, valeur: string | null): void => {
  if (valeur !== null && !estDateIsoValide(valeur)) throw new Error(`Date invalide pour ${champ} (${valeur}) : AAAA-MM-JJ attendu.`)
}

const verifierCentimes = (champ: string, montant: number): void => {
  if (!Number.isInteger(montant) || montant < 0) throw new Error(`Montant invalide pour ${champ} (${montant}) : centimes entiers positifs attendus.`)
}

const nettoyer = (texte: string): string => texte.replace(/\s+/g, ' ').trim()

export function creerSinistre(saisie: SaisieSinistre): FicheSinistre {
  if (!(TYPE_SINISTRE as readonly string[]).includes(saisie.type)) throw new Error(`Type de sinistre inconnu : « ${saisie.type} ».`)
  if (saisie.phase !== null && !(PHASE_SINISTRE as readonly string[]).includes(saisie.phase))
    throw new Error(`Phase de sinistre inconnue : « ${saisie.phase} ».`)
  if (!estDateIsoValide(saisie.dateSurvenance))
    throw new Error(`Date de survenance invalide (${saisie.dateSurvenance}) : AAAA-MM-JJ attendu.`)
  verifierDate('dateConnaissance', saisie.dateConnaissance)
  for (const champ of DATES_SUIVI) verifierDate(champ, saisie[champ])
  verifierCentimes('indemniteImmediateCentimes', saisie.indemniteImmediateCentimes)
  verifierCentimes('indemniteDiffereeCentimes', saisie.indemniteDiffereeCentimes)
  return {
    ...saisie,
    dateConnaissance: saisie.dateConnaissance ?? saisie.dateSurvenance,
    origine: nettoyer(saisie.origine),
    lieu: nettoyer(saisie.lieu),
    dommages: nettoyer(saisie.dommages),
  }
}

export type EtapeSuiviSinistre = 'a_declarer' | 'declare' | 'expertise' | 'rapport' | 'regle' | 'clos'

/** Étape de suivi lue sur la date la plus avancée renseignée (distincte de la phase Gestéam saisie). */
export function etapeSuiviSinistre(sinistre: FicheSinistre): EtapeSuiviSinistre {
  if (sinistre.dateCloture) return 'clos'
  if (sinistre.dateReglement) return 'regle'
  if (sinistre.dateRapport) return 'rapport'
  if (sinistre.dateExpertise) return 'expertise'
  if (sinistre.dateDeclaration) return 'declare'
  return 'a_declarer'
}

/** Statut Gestéam (STATUT_SINISTRE) : « Terminé » dès que la clôture est datée. */
export const statutSinistre = (sinistre: FicheSinistre): StatutSinistre => (sinistre.dateCloture ? 'Terminé' : 'En cours')

export interface AnomalieChronologie {
  champ: (typeof DATES_SUIVI)[number]
  message: string
}

const LIBELLES_DATES: Record<(typeof DATES_SUIVI)[number], string> = {
  dateDeclaration: 'Déclaration',
  dateExpertise: 'Expertise',
  dateRapport: 'Rapport',
  dateReglement: 'Règlement',
  dateCloture: 'Clôture',
}

/** Chaque date de suivi doit suivre la survenance et les étapes qui la précèdent. */
export function controlerChronologieSinistre(sinistre: FicheSinistre): AnomalieChronologie[] {
  const precedents: Record<(typeof DATES_SUIVI)[number], (string | null)[]> = {
    dateDeclaration: [sinistre.dateSurvenance],
    dateExpertise: [sinistre.dateSurvenance, sinistre.dateDeclaration],
    dateRapport: [sinistre.dateSurvenance, sinistre.dateExpertise],
    dateReglement: [sinistre.dateSurvenance, sinistre.dateDeclaration],
    dateCloture: [sinistre.dateSurvenance, sinistre.dateDeclaration, sinistre.dateExpertise, sinistre.dateRapport, sinistre.dateReglement],
  }
  const anomalies: AnomalieChronologie[] = []
  for (const champ of DATES_SUIVI) {
    const date = sinistre[champ]
    if (date && precedents[champ].some((avant) => avant !== null && date < avant))
      anomalies.push({ champ, message: `${LIBELLES_DATES[champ]} datée avant une étape qui doit la précéder.` })
  }
  return anomalies
}

export interface IndemnitesSinistre {
  totalCentimes: number
  regleCentimes: number
  resteCentimes: number
}

export function indemnitesSinistre(sinistre: FicheSinistre): IndemnitesSinistre {
  const totalCentimes = sinistre.indemniteImmediateCentimes + sinistre.indemniteDiffereeCentimes
  const regleCentimes =
    (sinistre.indemniteImmediateReglee ? sinistre.indemniteImmediateCentimes : 0) +
    (sinistre.indemniteDiffereeReglee ? sinistre.indemniteDiffereeCentimes : 0)
  return { totalCentimes, regleCentimes, resteCentimes: totalCentimes - regleCentimes }
}

/** Ajoute des jours ouvrés (ni samedi, ni dimanche, ni jour férié). */
const ajouterJoursOuvres = (dateIso: string, jours: number): string => {
  let date = dateIso
  for (let compte = 0; compte < jours; ) {
    date = ajouterJours(date, 1)
    if (estJourOuvrable(date)) compte++
  }
  return date
}

export interface ReperesDelaisSinistre {
  delaiDeclarationJoursOuvres: number
  declarationAuPlusTard: string
  /** Déclaration faite après le repère ; false si non encore déclarée. */
  declarationTardive: boolean
  prescription: string
  fondements: string[]
  avertissement: string
}

/** Repères indicatifs de déclaration et de prescription (voir l'en-tête du module). */
export function reperesDelaisSinistre(
  sinistre: FicheSinistre,
  { delaiContratJoursOuvres }: { delaiContratJoursOuvres?: number } = {},
): ReperesDelaisSinistre {
  const minimumLegal = sinistre.type === 'Vol' ? 2 : 5
  const delaiDeclarationJoursOuvres = Math.max(minimumLegal, delaiContratJoursOuvres ?? 0)
  const declarationAuPlusTard = ajouterJoursOuvres(sinistre.dateConnaissance, delaiDeclarationJoursOuvres)
  return {
    delaiDeclarationJoursOuvres,
    declarationAuPlusTard,
    declarationTardive: sinistre.dateDeclaration !== null && sinistre.dateDeclaration > declarationAuPlusTard,
    prescription: ajouterMois(sinistre.dateSurvenance, 24),
    fondements: ['C. assur. art. L. 113-2', 'C. assur. art. L. 114-1'],
    avertissement:
      "Repère indicatif : le contrat fixe le délai de déclaration et la prescription peut être interrompue (C. assur. art. L. 114-2). Vérifier le contrat et le dossier.",
  }
}
