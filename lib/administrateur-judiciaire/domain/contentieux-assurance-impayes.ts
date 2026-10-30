import {
  decomposerDateIso,
  estDateIsoValide,
  messagePlausibilite,
  plausibiliteDate,
  verifierAujourdhui,
  type PlausibiliteDate,
} from '@/lib/administrateur-judiciaire/domain/dates'
import { indemnitesSinistre, type FicheSinistre, type IndemnitesSinistre } from '@/lib/administrateur-judiciaire/domain/sinistres'
import type { TypeContentieux, TypeSinistre } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Assurance des impayés d'un contentieux (point 57 du bilan Gestéam). Fonctions pures, dates ISO (AAAA-MM-JJ), montants
 * en CENTIMES ENTIERS, sans écran ni table : le contentieux n'est pas persisté, la table `sinistres` est inchangée.
 *
 * Gestéam — 🟢 lu :
 * - tranche 42, fiche contentieux réelle, onglet Règlements, bloc Assurance : case « Couverture impayés », « Déclaré le »,
 *   « Indemnités totales (€) », boutons « Historique » (⚪ non ouvert) et « Sinistre » (ouvre une fiche sinistre) ;
 * - tranche 28 : la fiche sinistre porte l'indemnité immédiate et la différée, chacune « Réglée » ; tranche 20 : phase
 *   « Indemnités » ; TYPE_SINISTRE contient « Charges Impayées » et « Loyers Impayés » (sinistres.indemnitesSinistre
 *   totalise les indemnités) ;
 * - tranche 43, § 1 : l'arbre des flux d'un contentieux relu ne contient aucun sinistre (🔵 un contentieux n'a donc pas
 *   forcément de sinistre lié : `sinistreId` est facultatif).
 *
 * Le droit — 🟢 lu sur Légifrance le 29/10/2026 :
 * - aucun texte trouvé ne régit une « assurance des impayés de charges » de copropriété (recherches négatives dans les
 *   codes, la loi n° 65-557 et le décret n° 67-223) : couverture, fait générateur du sinistre, délai de déclaration et
 *   plafond relèvent de la police ;
 * - C. assur. art. L. 113-2, 4° (titre Ier du livre Ier) : déclaration dans le délai du contrat, jamais inférieur à cinq
 *   jours ouvrés ; la déchéance pour déclaration tardive n'est opposable que si le contrat la prévoit et si l'assureur
 *   prouve un préjudice. C. assur. art. L. 121-12 (titre II, « Règles relatives aux assurances de dommages », chapitre
 *   « Dispositions générales ») : subrogation légale de l'assureur qui a payé l'indemnité, contre les tiers responsables ;
 * - C. assur. art. L. 111-1 (lu sur Légifrance le 30/10/2026, version en vigueur au 29/10/2026) : les titres Ier, II et
 *   III du livre Ier ne s'appliquent ni aux contrats du titre VII ni aux « opérations d'assurance crédit », hormis les
 *   articles L. 111-6, L. 112-2, L. 112-4, L. 112-7 et L. 113-4-1. L. 113-2 et L. 121-12 n'en font pas partie : leur
 *   application à une garantie des impayés de charges dépend de sa qualification (🔴 1 et 2) ;
 * - C. civ. art. 1346-1 (subrogation conventionnelle), 1346-3 (pas de préjudice au créancier payé en partie, préférence
 *   pour le reste), 1346-4 (transmission de la créance dans la limite du paiement), 1346-5 (opposable au débiteur après
 *   notification ou s'il en a pris acte ; invocable par lui dès qu'il en a connaissance ; opposable aux tiers dès le
 *   paiement).
 *
 * 🔵 Déduit :
 * - la garantie impayés se déclare comme un sinistre « Charges Impayées » ou « Loyers Impayés » : le contentieux porte la
 *   couverture, la date de déclaration et le lien `sinistreId` ; les indemnités se LISENT sur le sinistre
 *   (`vueAssuranceImpayes`) et ne sont stockées nulle part sur le contentieux ;
 * - l'indemnité de l'assureur n'est pas un paiement du copropriétaire (C. civ. art. 1346-3 et 1346-4) : elle s'affiche à
 *   part, n'est ni déduite du solde dû (decompte-contentieux.calculerDecompte) ni imputée comme un règlement ;
 * - la couverture ne vise que le type « Recouvrement de charges/loyer » ; la date « Déclaré le » du contentieux est celle
 *   de la fiche sinistre liée. Les contrôles signalent, ils ne refusent pas.
 *
 * 🔴 Non établi :
 * 1. (Frédéric ou Hugo) La police impayés du cabinet est-elle une opération d'assurance crédit ? Si oui, L. 113-2 (délai
 *    minimal de cinq jours ouvrés, déchéance subordonnée à un préjudice) ne s'applique pas (C. assur. art. L. 111-1) et
 *    seule la police fixe la déclaration. Dans tous les cas, quel est le fait générateur du « sinistre » impayés (première
 *    échéance impayée, mise en demeure restée sans effet, jugement, dette au-delà d'un seuil) et quel délai de déclaration
 *    est prévu ? D'ici là, aucun délai de déclaration n'est calculé (sinistres.reperesDelaisSinistre part de la
 *    connaissance d'un sinistre de dommages).
 * 2. (Frédéric) Après une indemnité, la police prévoit-elle une subrogation de l'assureur (C. civ. art. 1346-1, ou C. assur.
 *    art. L. 121-12, écarté par L. 111-1 si la police est une opération d'assurance crédit, et dont l'application à une
 *    assurance des impayés n'est pas établie) et le syndicat poursuit-il toute la dette pour le compte de l'assureur ? La
 *    réponse dira si l'indemnité vient en déduction du solde dû ou passe en compte d'attente. Une subrogation reste
 *    non opposable au débiteur tant qu'elle n'est ni notifiée ni prise en acte par lui, mais il peut l'invoquer dès qu'il
 *    la connaît (art. 1346-5, al. 1) et elle est opposable aux tiers dès le paiement (al. 2).
 * 3. (Frédéric ou Hugo) La case « Couverture impayés » découle-t-elle d'un contrat d'assurance du mandat (TYPE_CONTRAT
 *    « Assurance loyer impayé », garantie de la multirisque) à relier, ou est-elle saisie librement ? Sous administration
 *    provisoire, la souscription d'une police au nom du syndicat suit-elle la mission de l'ordonnance (loi art. 29-1, I,
 *    al. 2 ; contrat type de syndic, prestation V-16° : vote de l'AG) ?
 * 4. (Hugo) Que trace le bouton « Historique » du bloc Assurance ?
 */

/** Types de sinistre de la garantie impayés (référentiel Gestéam TYPE_SINISTRE). */
export const TYPES_SINISTRE_IMPAYES = ['Charges Impayées', 'Loyers Impayés'] as const satisfies readonly TypeSinistre[]
export type TypeSinistreImpayes = (typeof TYPES_SINISTRE_IMPAYES)[number]

const TYPE_RECOUVREMENT = 'Recouvrement de charges/loyer' satisfies TypeContentieux

export interface AssuranceImpayesContentieux {
  /** Case « Couverture impayés ». */
  couverture: boolean
  /** « Déclaré le » : déclaration de l'impayé à l'assureur ; null si non déclaré. */
  declareLe: string | null
  /** Fiche sinistre liée (bouton « Sinistre »), qui porte les indemnités ; null sans lien. */
  sinistreId: string | null
}

export interface SaisieAssuranceImpayes {
  couverture: boolean
  declareLe?: string | null
  sinistreId?: string | null
}

export const SANS_ASSURANCE_IMPAYES: Readonly<AssuranceImpayesContentieux> = Object.freeze({
  couverture: false,
  declareLe: null,
  sinistreId: null,
})

/** Normalise la saisie : lien rogné (vide → null), date absente → null. Refuse une date non ISO. */
export function creerAssuranceImpayes(saisie: SaisieAssuranceImpayes): AssuranceImpayesContentieux {
  if (typeof saisie.couverture !== 'boolean')
    throw new Error(`Couverture impayés invalide (${String(saisie.couverture)}) : oui ou non attendu.`)
  const declareLe = saisie.declareLe ?? null
  if (declareLe !== null && !estDateIsoValide(declareLe))
    throw new Error(`Date de déclaration à l'assureur invalide (${declareLe}) : AAAA-MM-JJ attendu.`)
  const lien = saisie.sinistreId?.trim() ?? ''
  return { couverture: saisie.couverture, declareLe, sinistreId: lien === '' ? null : lien }
}

/** Fiche sinistre lue avec son identifiant d'enregistrement. */
export interface SinistreLie {
  id: string
  fiche: FicheSinistre
}

export type CodeAnomalieAssuranceImpayes =
  | 'declaration_sans_couverture'
  | 'sinistre_sans_couverture'
  | 'couverture_hors_recouvrement'
  | 'sinistre_introuvable'
  | 'sinistre_hors_impayes'
  | 'sinistre_autre_copropriete'
  | 'declaration_divergente'
  | 'declaration_non_plausible'

export interface AnomalieAssuranceImpayes {
  code: CodeAnomalieAssuranceImpayes
  message: string
  /** Nature de l'anomalie de date (`declaration_non_plausible` seulement). */
  nature?: PlausibiliteDate
}

/** La fiche fournie doit être celle du lien : une autre fiche est une erreur d'appel, pas une anomalie de saisie. */
function verifierFicheDuLien(assurance: AssuranceImpayesContentieux, sinistre: SinistreLie | null): void {
  if (sinistre === null || sinistre.id === assurance.sinistreId) return
  const lien = assurance.sinistreId === null ? 'à aucun sinistre' : `au sinistre « ${assurance.sinistreId} »`
  throw new Error(`Fiche sinistre « ${sinistre.id} » fournie, mais le contentieux est lié ${lien}.`)
}

const estTypeImpayes = (type: TypeSinistre): boolean => (TYPES_SINISTRE_IMPAYES as readonly TypeSinistre[]).includes(type)

/** « JJ/MM/AAAA » avec l'année sur 4 chiffres (« 10/03/0026 »), comme dates.messagePlausibilite : la faute de frappe se voit. */
function dateFrAnneeComplete(dateIso: string): string {
  const { a, m, j } = decomposerDateIso(dateIso)
  return `${String(j).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(a).padStart(4, '0')}`
}

const dateOuAbsence = (date: string | null): string => (date === null ? 'non renseignée' : `le ${dateFrAnneeComplete(date)}`)

function anomaliesCouverture(type: TypeContentieux, assurance: AssuranceImpayesContentieux): AnomalieAssuranceImpayes[] {
  const anomalies: AnomalieAssuranceImpayes[] = []
  if (assurance.couverture) {
    if (type !== TYPE_RECOUVREMENT)
      anomalies.push({
        code: 'couverture_hors_recouvrement',
        message: `Couverture impayés sur un contentieux « ${type} » : elle ne vise que le recouvrement de charges ou de loyers.`,
      })
    return anomalies
  }
  if (assurance.declareLe !== null)
    anomalies.push({ code: 'declaration_sans_couverture', message: "Déclaration à l'assureur datée sans la case « Couverture impayés »." })
  if (assurance.sinistreId !== null)
    anomalies.push({ code: 'sinistre_sans_couverture', message: 'Sinistre lié sans la case « Couverture impayés ».' })
  return anomalies
}

function anomaliesSinistre(
  coproprieteId: string,
  assurance: AssuranceImpayesContentieux,
  sinistre: SinistreLie | null,
): AnomalieAssuranceImpayes[] {
  if (assurance.sinistreId === null) return []
  if (sinistre === null)
    return [{ code: 'sinistre_introuvable', message: `Sinistre lié « ${assurance.sinistreId} » introuvable.` }]
  const { fiche } = sinistre
  const anomalies: AnomalieAssuranceImpayes[] = []
  if (!estTypeImpayes(fiche.type))
    anomalies.push({
      code: 'sinistre_hors_impayes',
      message: `Sinistre lié de type « ${fiche.type} » : « ${TYPES_SINISTRE_IMPAYES.join(' » ou « ')} » attendu.`,
    })
  if (fiche.coproprieteId !== coproprieteId)
    anomalies.push({ code: 'sinistre_autre_copropriete', message: "Sinistre lié d'une autre copropriété que le contentieux." })
  if (fiche.dateDeclaration !== assurance.declareLe)
    anomalies.push({
      code: 'declaration_divergente',
      message: `Déclaration à l'assureur ${dateOuAbsence(assurance.declareLe)} sur le contentieux, ${dateOuAbsence(fiche.dateDeclaration)} sur le sinistre lié.`,
    })
  return anomalies
}

/** Déclaration datée après aujourd'hui ou d'une année improbable (tranche 42 : Gestéam accepte une date en 2525). */
function anomaliesDateDeclaration(declareLe: string | null, aujourdhui: string): AnomalieAssuranceImpayes[] {
  const nature = declareLe === null ? null : plausibiliteDate(declareLe, aujourdhui, { futurAdmis: false })
  if (declareLe === null || nature === null) return []
  return [{ code: 'declaration_non_plausible', nature, message: messagePlausibilite('Déclaration datée', declareLe, nature) }]
}

/**
 * Cohérence de l'assurance impayés d'un dossier : couverture, sinistre lié (type, copropriété, date de déclaration) et
 * plausibilité de la date. Le dossier est typé par sa structure (pas de dépendance à contentieux.ts). Signale, ne refuse
 * pas ; lève une erreur si la fiche fournie n'est pas celle du lien, ou si `aujourdhui` est invalide.
 */
export function controlerAssuranceImpayes(
  dossier: { coproprieteId: string; type: TypeContentieux },
  assurance: AssuranceImpayesContentieux,
  sinistre: SinistreLie | null,
  aujourdhui: string,
): AnomalieAssuranceImpayes[] {
  verifierAujourdhui(aujourdhui)
  verifierFicheDuLien(assurance, sinistre)
  return [
    ...anomaliesCouverture(dossier.type, assurance),
    ...anomaliesSinistre(dossier.coproprieteId, assurance, sinistre),
    ...anomaliesDateDeclaration(assurance.declareLe, aujourdhui),
  ]
}

export interface VueAssuranceImpayes extends AssuranceImpayesContentieux {
  /** Indemnités lues sur le sinistre lié (indemnitesSinistre) ; null sans fiche. Jamais déduites du solde dû (🔴 2). */
  indemnites: IndemnitesSinistre | null
}

/** Bloc Assurance de la fiche : la saisie du contentieux et les « Indemnités totales » lues sur le sinistre lié. */
export function vueAssuranceImpayes(assurance: AssuranceImpayesContentieux, sinistre: SinistreLie | null): VueAssuranceImpayes {
  verifierFicheDuLien(assurance, sinistre)
  return {
    couverture: assurance.couverture,
    declareLe: assurance.declareLe,
    sinistreId: assurance.sinistreId,
    indemnites: sinistre === null ? null : indemnitesSinistre(sinistre.fiche),
  }
}
