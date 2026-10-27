import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { EtapeRecouvrement } from '@/lib/administrateur-judiciaire/domain/recouvrement'
import {
  PARTICULARITE_CONTENTIEUX,
  PHASE_CONTENTIEUX,
  TYPE_CONTENTIEUX,
  type ParticulariteContentieux,
  type PhaseContentieux,
  type TypeContentieux,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Contentieux d'une copropriété (cartographie Gestéam, tranches 20, 27 et 28). Fonctions pures, dates ISO
 * (AAAA-MM-JJ), montants en CENTIMES ENTIERS, sans écran.
 *
 * Gestéam — fiche : date, n°, type, objet, phase, clos le ; immeuble, mandat, débiteur, montant demandé ; huissier,
 * avocat, expert (chacun : référence, transmis le) ; dates de procédure : mise en demeure, commandement, référé,
 * assignation, audience, ordonnance, jugement, signification. Type, phase, particularité : référentiels complets.
 *
 * La PHASE est saisie par le gestionnaire. VitFix en suggère une d'après les faits datés et signale l'écart : il ne la
 * remplace jamais. « Règlement amiable » et « Déclaration Assurance » ne se déduisent d'aucune date.
 * Stades et groupes de relance : listes du paramétrage cabinet (tranche 27) ; leur correspondance avec les étapes de
 * recouvrement est 🔵 DÉDUITE, à valider avec le cabinet.
 */

export const JALONS_PROCEDURE = [
  { cle: 'miseEnDemeure', libelle: 'Mise en demeure' },
  { cle: 'commandement', libelle: 'Commandement' },
  { cle: 'refere', libelle: 'Référé' },
  { cle: 'assignation', libelle: 'Assignation' },
  { cle: 'audience', libelle: 'Audience' },
  { cle: 'ordonnance', libelle: 'Ordonnance' },
  { cle: 'jugement', libelle: 'Jugement' },
  { cle: 'signification', libelle: 'Signification' },
] as const
export type JalonProcedure = (typeof JALONS_PROCEDURE)[number]['cle']

/** Stades de relance du compte copropriétaire (Gestéam, paramétrage cabinet). */
export const STADES_RELANCE = [
  { code: '0', libelle: 'Compte à jour' },
  { code: '1', libelle: '1re relance' },
  { code: '2', libelle: 'Mise en demeure' },
  { code: '3', libelle: 'Relance après mise en demeure' },
  { code: '9', libelle: 'Dossier contentieux' },
] as const
export type CodeStadeRelance = (typeof STADES_RELANCE)[number]['code']

/** Groupes de relance (Gestéam, paramétrage cabinet). */
export const GROUPES_RELANCE = [
  { code: '0', libelle: 'Relance' },
  { code: '1', libelle: 'Prélèvement' },
  { code: '6', libelle: 'Protocole d’accord' },
  { code: '9', libelle: 'Contentieux' },
] as const
export type CodeGroupeRelance = (typeof GROUPES_RELANCE)[number]['code']

export interface IntervenantContentieux {
  nom: string | null
  reference: string | null
  transmisLe: string | null
}

export type RoleIntervenant = 'huissier' | 'avocat' | 'expert'

export interface SaisieContentieux {
  coproprieteId: string
  type: TypeContentieux
  phase: PhaseContentieux
  particularite: ParticulariteContentieux
  dateOuverture: string
  dateCloture: string | null
  objet: string
  montantDemandeCentimes: number
  intervenants: Record<RoleIntervenant, IntervenantContentieux>
  jalons: Partial<Record<JalonProcedure, string>>
}

export type DossierContentieux = SaisieContentieux

const contient = (liste: readonly string[], valeur: string) => liste.includes(valeur)
const CLES_JALONS = JALONS_PROCEDURE.map((j) => j.cle) as readonly string[]

const verifierDate = (champ: string, valeur: string | null | undefined): void => {
  if (valeur != null && !estDateIsoValide(valeur)) throw new Error(`Date invalide pour ${champ} (${valeur}) : AAAA-MM-JJ attendu.`)
}

export function creerDossierContentieux(saisie: SaisieContentieux): DossierContentieux {
  if (!contient(TYPE_CONTENTIEUX, saisie.type)) throw new Error(`Type de contentieux inconnu : « ${saisie.type} ».`)
  if (!contient(PHASE_CONTENTIEUX, saisie.phase)) throw new Error(`Phase de contentieux inconnue : « ${saisie.phase} ».`)
  if (!contient(PARTICULARITE_CONTENTIEUX, saisie.particularite))
    throw new Error(`Particularité de contentieux inconnue : « ${saisie.particularite} ».`)
  if (!estDateIsoValide(saisie.dateOuverture)) throw new Error(`Date d'ouverture invalide (${saisie.dateOuverture}) : AAAA-MM-JJ attendu.`)
  verifierDate('dateCloture', saisie.dateCloture)
  if (!Number.isInteger(saisie.montantDemandeCentimes) || saisie.montantDemandeCentimes < 0)
    throw new Error(`Montant demandé invalide (${saisie.montantDemandeCentimes}) : centimes entiers positifs attendus.`)
  for (const [cle, date] of Object.entries(saisie.jalons)) {
    if (!CLES_JALONS.includes(cle)) throw new Error(`Jalon de procédure inconnu : « ${cle} ».`)
    verifierDate(cle, date)
  }
  for (const [role, intervenant] of Object.entries(saisie.intervenants)) verifierDate(`${role}.transmisLe`, intervenant.transmisLe)
  return { ...saisie, objet: saisie.objet.replace(/\s+/g, ' ').trim() }
}

export interface AnomalieContentieux {
  jalon: JalonProcedure | RoleIntervenant
  message: string
}

/** Paires (avant, après) dont l'ordre s'impose quand les deux dates existent. */
const ORDRE_JALONS: [JalonProcedure, JalonProcedure][] = [
  ['miseEnDemeure', 'assignation'],
  ['refere', 'ordonnance'],
  ['assignation', 'audience'],
  ['audience', 'jugement'],
  ['jugement', 'signification'],
  ['signification', 'commandement'],
]

const libelleJalon = (cle: JalonProcedure) => JALONS_PROCEDURE.find((j) => j.cle === cle)?.libelle ?? cle

/** Ordre de la procédure et transmissions postérieures à l'ouverture ; une anomalie par date en cause. */
export function controlerChronologieContentieux(dossier: DossierContentieux): AnomalieContentieux[] {
  const anomalies: AnomalieContentieux[] = []
  for (const [avant, apres] of ORDRE_JALONS) {
    const dAvant = dossier.jalons[avant]
    const dApres = dossier.jalons[apres]
    if (dAvant && dApres && dApres < dAvant && !anomalies.some((a) => a.jalon === apres))
      anomalies.push({ jalon: apres, message: `${libelleJalon(apres)} datée avant : ${libelleJalon(avant).toLowerCase()}.` })
  }
  for (const role of ['huissier', 'avocat', 'expert'] as const) {
    const transmis = dossier.intervenants[role].transmisLe
    if (transmis && transmis < dossier.dateOuverture)
      anomalies.push({ jalon: role, message: `Transmission (${role}) datée avant l'ouverture du dossier.` })
  }
  return anomalies
}

const RANG_PHASE = (phase: PhaseContentieux) => PHASE_CONTENTIEUX.indexOf(phase)
const PHASES_NON_DEDUCTIBLES: PhaseContentieux[] = ['Règlement amiable', 'Déclaration Assurance']
const JALONS_JUDICIAIRES: JalonProcedure[] = ['refere', 'assignation', 'audience', 'ordonnance', 'jugement', 'signification']

function phaseDesFaits(dossier: DossierContentieux): PhaseContentieux {
  if (dossier.dateCloture) return 'Clos'
  if (dossier.jalons.commandement) return 'Exécution en cours'
  if (JALONS_JUDICIAIRES.some((j) => dossier.jalons[j])) return 'Procédure Judiciaire'
  if (dossier.intervenants.avocat.transmisLe) return "Transmis à l'avocat"
  if (dossier.intervenants.huissier.transmisLe) return "Transmis à l'huissier"
  if (dossier.jalons.miseEnDemeure) return 'Mise en demeure'
  return 'Ouverture'
}

/** Phase cohérente avec les faits datés ; `ecart` si elle diffère de la phase saisie. */
export function phaseSuggeree(dossier: DossierContentieux): { phase: PhaseContentieux; ecart: boolean } {
  const deduite = phaseDesFaits(dossier)
  const phase =
    PHASES_NON_DEDUCTIBLES.includes(dossier.phase) && RANG_PHASE(deduite) < RANG_PHASE(dossier.phase) ? dossier.phase : deduite
  return { phase, ecart: phase !== dossier.phase }
}

/** Étape de recouvrement (domain/recouvrement) d'un dossier de charges ; null pour les autres types. */
export function etapeRecouvrementContentieux(dossier: DossierContentieux): EtapeRecouvrement | null {
  if (dossier.type !== 'Recouvrement de charges/loyer') return null
  const phase = phaseDesFaits(dossier)
  if (phase === 'Clos') return 'solde'
  if (phase === 'Mise en demeure') return 'mise_en_demeure'
  if (phase === 'Ouverture') return 'amiable'
  return 'procedure'
}

const STADE_PAR_ETAPE: Record<EtapeRecouvrement, CodeStadeRelance> = {
  amiable: '1',
  mise_en_demeure: '2',
  exigibilite: '3',
  procedure: '9',
  solde: '0',
}

/** Stade et groupe de relance du compte (🔵 correspondance déduite) ; protocole d'accord si échéancier signé. */
export function relanceDepuisEtape(
  etape: EtapeRecouvrement,
  avecEcheancier: boolean,
): { stade: CodeStadeRelance; groupe: CodeGroupeRelance } {
  const stade = STADE_PAR_ETAPE[etape]
  if (etape === 'solde') return { stade, groupe: '0' }
  if (avecEcheancier) return { stade, groupe: '6' }
  return { stade, groupe: etape === 'procedure' ? '9' : '0' }
}
