import { DEMO_TACHES, type TacheDemo } from '@/components/administrateur-judiciaire/data/taches'
import type {
  CoproprietaireEnregistre,
  CoproprieteVue,
  LotEnregistre,
} from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { dateFrVersIso, dateVersIso, ecartJours } from '@/lib/administrateur-judiciaire/domain/dates'
import { calculerEtatEcheance } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import {
  calculerEcheancesCopropriete,
  type CoproprieteMoteur,
  type ResultatEcheancesMandat,
} from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import { formatTantiemes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  PARCOURS_RECOUVREMENT_DEBITEUR,
  type EtapeParcoursRecouvrement,
} from '@/lib/administrateur-judiciaire/domain/recouvrement'
import { normaliserNomPersonne } from '@/lib/administrateur-judiciaire/domain/texte'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Fiches 360 (copropriété et personne) assemblées à partir des données de la base locale.
 * Les fonctions sont génériques : les entités passées sont restituées avec leur type complet.
 */

/**
 * Obligations suivies de démonstration remplacées par le moteur de délais (convocation de l'AG élective,
 * notification de l'ordonnance, compte bancaire séparé).
 */
export const ECHEANCES_SUIVI_DOUBLONS_MOTEUR: readonly string[] = ['O1', 'O2', 'O7']

export type SituationChronologie = 'passee' | 'aujourdhui' | 'a_venir'

/** Situation d'une date par rapport à la référence (attention : date d'abord, référence ensuite). */
export const situerDateChronologie = (dateIso: string, referenceIso: string): SituationChronologie => {
  const jours = ecartJours(referenceIso, dateIso)
  return jours < 0 ? 'passee' : jours === 0 ? 'aujourdhui' : 'a_venir'
}

/** Copropriétaire complété du numéro de son lot, de ses tantièmes formatés et de sa quote-part. */
export type PersonneCopropriete<P extends CoproprietaireEnregistre = CoproprietaireEnregistre> = P & {
  lot: string
  tantiemes: string
  quotePart: number | null
}

/** Copropriétaires d'une copropriété (via leurs lots), triés par nom (ordre français). */
export function listerCoproprietairesCopropriete<P extends CoproprietaireEnregistre>(
  copro: { id: string },
  lots: LotEnregistre[],
  coproprietaires: P[],
): PersonneCopropriete<P>[] {
  const lotsCopro = lots.filter((lot) => lot.coproprieteId === copro.id),
    lotsParId = new Map(lotsCopro.map((lot) => [lot.id, lot]))
  return coproprietaires
    .filter((personne) => lotsParId.has(personne.lotId))
    .map((personne) => {
      // Présent : filtré juste au-dessus.
      const lot = lotsParId.get(personne.lotId) as LotEnregistre
      return {
        ...personne,
        lot: lot.numero,
        tantiemes: formatTantiemes(lot.tantiemes),
        quotePart: lot.tantiemes?.denominateur ? lot.tantiemes.numerateur / lot.tantiemes.denominateur : null,
      }
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

/** Obligation suivie par le cabinet (table des échéances de la base locale). */
export interface EcheanceSuiviEnregistree {
  id: string
  coproprieteId: string | null
  objet: string
  base: string
  date: Date | null
  statut: string
}

export interface ContratEnregistre {
  coproprieteId: string
  prestataireId: string
}

export interface SinistreEnregistre {
  coproprieteId: string
}

export interface PrestataireEnregistre {
  id: string
}

export interface DonneesFiche360Copropriete<
  L extends LotEnregistre = LotEnregistre,
  P extends CoproprietaireEnregistre = CoproprietaireEnregistre,
  E extends EcheanceSuiviEnregistree = EcheanceSuiviEnregistree,
  C extends ContratEnregistre = ContratEnregistre,
  S extends SinistreEnregistre = SinistreEnregistre,
  R extends PrestataireEnregistre = PrestataireEnregistre,
> {
  lots: L[]
  coproprietaires: P[]
  echeances: E[]
  contrats: C[]
  sinistres: S[]
  prestataires: R[]
}

/** Copropriété attendue par la fiche 360 (vue copropriété). */
export type CoproprieteFiche360 = CoproprieteMoteur &
  Pick<CoproprieteVue, 'id' | 'code' | 'lots' | 'budget' | 'impayes' | 'tribunal' | 'rg'>

export type TacheFiche360 = Pick<TacheDemo, 'id' | 'title' | 'basis' | 'due' | 'role'>

export type SourceChronologie = 'mandat' | 'moteur' | 'suivi' | 'tache'

export interface EvenementChronologie {
  date: string
  libelle: string
  source: SourceChronologie
  situation: SituationChronologie
  detail?: string
}

export interface Fiche360Copropriete<
  V extends CoproprieteFiche360 = CoproprieteVue,
  L extends LotEnregistre = LotEnregistre,
  P extends CoproprietaireEnregistre = CoproprietaireEnregistre,
  E extends EcheanceSuiviEnregistree = EcheanceSuiviEnregistree,
  C extends ContratEnregistre = ContratEnregistre,
  S extends SinistreEnregistre = SinistreEnregistre,
  R extends PrestataireEnregistre = PrestataireEnregistre,
> {
  vue: V
  lots: L[]
  personnes: PersonneCopropriete<P>[]
  /** Soldes négatifs, du plus débiteur au moins débiteur. */
  debiteurs: PersonneCopropriete<P>[]
  /** Somme des soldes débiteurs (négative). */
  totalDebiteur: number
  /** Impayés / budget, null si budget nul. */
  tauxImpayes: number | null
  /** Seuil de désignation d'un mandataire ad hoc : 15 % au-delà de 200 lots, 25 % sinon. */
  seuilAdHoc: number
  obligationsSuivi: E[]
  taches: TacheFiche360[]
  contrats: C[]
  sinistres: S[]
  prestataires: R[]
  /** Résultat complet du moteur : les échéances sont dans `echeances.echeances`. */
  echeances: ResultatEcheancesMandat<V>
  chronologie: EvenementChronologie[]
}

/**
 * Fiche 360 d'une copropriété. La chronologie réunit l'ordonnance, les échéances du moteur, les obligations suivies
 * (hors doublons du moteur) et les tâches de démonstration du même code, triée par date ISO (tri stable).
 */
export function construireFiche360Copropriete<
  V extends CoproprieteFiche360,
  L extends LotEnregistre,
  P extends CoproprietaireEnregistre,
  E extends EcheanceSuiviEnregistree,
  C extends ContratEnregistre,
  S extends SinistreEnregistre,
  R extends PrestataireEnregistre,
>(
  vue: V,
  donnees: DonneesFiche360Copropriete<L, P, E, C, S, R>,
  referenceIso: string = AUJOURDHUI_ISO,
): Fiche360Copropriete<V, L, P, E, C, S, R> {
  const lots = donnees.lots.filter((lot) => lot.coproprieteId === vue.id),
    personnes = listerCoproprietairesCopropriete(vue, donnees.lots, donnees.coproprietaires),
    debiteurs = personnes.filter((personne) => personne.solde < 0).sort((a, b) => a.solde - b.solde),
    totalDebiteur = debiteurs.reduce((total, personne) => total + personne.solde, 0),
    tauxImpayes = vue.budget > 0 ? vue.impayes / vue.budget : null,
    seuilAdHoc = vue.lots > 200 ? 0.15 : 0.25,
    obligationsSuivi = donnees.echeances.filter(
      (echeance) => echeance.coproprieteId === vue.id && !ECHEANCES_SUIVI_DOUBLONS_MOTEUR.includes(echeance.id),
    ),
    taches: TacheFiche360[] = DEMO_TACHES.filter((tache) => tache.code === vue.code).map((tache) => ({
      id: tache.id,
      title: tache.title,
      basis: tache.basis,
      due: tache.due,
      role: tache.role,
    })),
    contrats = donnees.contrats.filter((contrat) => contrat.coproprieteId === vue.id),
    sinistres = donnees.sinistres.filter((sinistre) => sinistre.coproprieteId === vue.id),
    idsPrestataires = new Set(contrats.map((contrat) => contrat.prestataireId)),
    prestataires = donnees.prestataires.filter((prestataire) => idsPrestataires.has(prestataire.id)),
    echeances = calculerEcheancesCopropriete(vue),
    chronologie: EvenementChronologie[] = [],
    dateOrdonnance = dateVersIso(vue.ordonnance)
  if (dateOrdonnance)
    chronologie.push({
      date: dateOrdonnance,
      libelle: `Ordonnance de désignation (${vue.tribunal || 'tribunal judiciaire'}, RG ${vue.rg || '·'})`,
      source: 'mandat',
      situation: situerDateChronologie(dateOrdonnance, referenceIso),
    })
  for (const echeance of echeances.echeances) {
    if (!echeance.dateRetenue) continue
    const etat = calculerEtatEcheance(echeance, referenceIso)
    chronologie.push({
      date: echeance.dateRetenue,
      libelle: echeance.libelle,
      source: 'moteur',
      situation: situerDateChronologie(echeance.dateRetenue, referenceIso),
      detail: etat === 'accomplie' ? 'accomplie' : echeance.fondements.join(' · '),
    })
  }
  for (const obligation of obligationsSuivi) {
    const date = dateVersIso(obligation.date)
    if (date)
      chronologie.push({
        date,
        libelle: obligation.objet,
        source: 'suivi',
        situation: situerDateChronologie(date, referenceIso),
        detail: `${obligation.base} · ${obligation.statut}`,
      })
  }
  for (const tache of taches) {
    const date = dateFrVersIso(tache.due)
    if (date)
      chronologie.push({
        date,
        libelle: tache.title,
        source: 'tache',
        situation: situerDateChronologie(date, referenceIso),
        detail: `${tache.basis} · ${tache.role}`,
      })
  }
  chronologie.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return {
    vue,
    lots,
    personnes,
    debiteurs,
    totalDebiteur,
    tauxImpayes,
    seuilAdHoc,
    obligationsSuivi,
    taches,
    contrats,
    sinistres,
    prestataires,
    echeances,
    chronologie,
  }
}

export interface HomonymePersonne<P, V> {
  personne: P
  copro: V | null
  /** Numéro du lot, « · » si inconnu. */
  lot: string
}

export interface Fiche360Personne<
  P extends CoproprietaireEnregistre = CoproprietaireEnregistre,
  L extends LotEnregistre = LotEnregistre,
  V extends { id: string } = CoproprieteVue,
> {
  personne: P
  lot: L | null
  copro: V | null
  tantiemes: string
  quotePart: number | null
  debiteur: boolean
  parcours: EtapeParcoursRecouvrement[]
  /** Même nom normalisé, autre fiche, dans tout le portefeuille. */
  homonymes: HomonymePersonne<P, V>[]
  modeNotification: string
  autresLotsMemeCopro: { lot: string; personne: P }[]
}

export interface DonneesFiche360Personne<P, L, V> {
  lots: L[]
  copros: V[]
  coproprietaires: P[]
}

/** Fiche 360 d'un copropriétaire. */
export function construireFiche360Personne<
  P extends CoproprietaireEnregistre,
  L extends LotEnregistre,
  V extends { id: string },
>(personne: P, donnees: DonneesFiche360Personne<P, L, V>): Fiche360Personne<P, L, V> {
  const lot = donnees.lots.find((l) => l.id === personne.lotId) || null,
    copro = (lot && donnees.copros.find((c) => c.id === lot.coproprieteId)) || null,
    debiteur = personne.solde < 0,
    nomNormalise = normaliserNomPersonne(personne.nom),
    homonymes = donnees.coproprietaires
      .filter((autre) => autre.id !== personne.id && normaliserNomPersonne(autre.nom) === nomNormalise)
      .map((autre) => {
        const lotAutre = donnees.lots.find((l) => l.id === autre.lotId) || null
        return {
          personne: autre,
          copro: (lotAutre && donnees.copros.find((c) => c.id === lotAutre.coproprieteId)) || null,
          lot: lotAutre ? lotAutre.numero : '·',
        }
      }),
    autresLotsMemeCopro = copro
      ? donnees.coproprietaires
          .filter((autre) => autre.id !== personne.id)
          .map((autre) => ({
            personne: autre,
            lot: donnees.lots.find((l) => l.id === autre.lotId),
          }))
          .filter((entree): entree is { personne: P; lot: L } => !!entree.lot && entree.lot.coproprieteId === copro.id)
          .map((entree) => ({
            lot: entree.lot.numero,
            personne: entree.personne,
          }))
      : [],
    tantiemesLot = lot?.tantiemes
  return {
    personne,
    lot,
    copro,
    tantiemes: formatTantiemes(lot?.tantiemes),
    quotePart: tantiemesLot?.denominateur ? tantiemesLot.numerateur / tantiemesLot.denominateur : null,
    debiteur,
    parcours: debiteur ? PARCOURS_RECOUVREMENT_DEBITEUR : [],
    homonymes,
    modeNotification: personne.mail
      ? `Voie électronique possible (${personne.mail}), principe depuis le décret n° 2025-1292 ; accord et opposition non enregistrés dans la base`
      : 'Adresse électronique inconnue : lettre recommandée avec avis de réception',
    autresLotsMemeCopro,
  }
}
