import { repartirAuxPlusFortsRestes } from '@/lib/administrateur-judiciaire/domain/arrondis'
import { ajouterJours, ajouterMois, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Budget, Exercice, StatutExercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import type { CleRepartition, EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'

/**
 * Échéancier des appels du budget d'un exercice (point 18 du bilan 2). Fonctions pures, montants en CENTIMES ENTIERS,
 * dates ISO, sans écran : produit les EcheanceAppel « budget » que repartition-appels.avisDAppel répartit au tantième.
 *
 * Le droit — 🟢 L. 1965 art. 14-1, I, relu sur Légifrance le 29/10/2026 : « Les copropriétaires versent au syndicat des
 * provisions égales au quart du budget voté. Toutefois, l'assemblée générale peut fixer des modalités différentes. La
 * provision est exigible le premier jour de chaque trimestre ou le premier jour de la période fixée par l'assemblée
 * générale. » D'où : pas de provisions sans budget VOTÉ ; des modalités différentes exigent la décision qui les fixe.
 *
 * Gestéam — fiche exercice, onglet Dépenses, « Échéancier des appels » : quatre appels trimestriels égaux au quart du
 * budget, sur la clé de chaque ligne (tranche 43 § 9). VitFix répartit le budget de chaque clé sans centime perdu ni créé
 * (plus forts restes : les premières provisions portent le centime en plus).
 *
 * Convention : LigneBudget.cle porte le CODE de la clé de répartition (« 001 ») ; l'échéance reçoit l'identifiant de la
 * clé du syndicat (CleRepartition.id), que lit avisDAppel.
 * 🔵 Déduit : « chaque trimestre » s'entend des trimestres de l'exercice (un exercice ouvert le 1er mai appelle au
 * 1er mai, 1er août, 1er novembre, 1er février) ; le défaut de l'art. 14-1 ne vaut que pour un exercice de douze mois —
 * pour un exercice plus court ou plus long, les modalités votées sont exigées ; une provision exigible hors de l'exercice
 * est une erreur de saisie ; pour un administrateur provisoire qui a les pouvoirs de l'assemblée, sa décision tient lieu
 * de vote.
 * Hors périmètre : l'appel de régularisation après la répartition des charges (point 25), la cotisation au fonds de
 * travaux (fonds-travaux.ts, aux mêmes dates que ces provisions).
 */

export interface ModalitesProvisions {
  /** Nombre de provisions. */
  nombre: number
  /** Exigibilité de la première provision. */
  premiereLe: string
  /** Écart entre deux provisions, en mois. */
  tousLesMois: number
  /** Référence de la décision qui fixe ces modalités (AG, ou administrateur provisoire) ; absente pour le défaut légal. */
  decision?: string | null
}

/** Statuts d'un exercice dont le budget est voté (exercices-budgets.ts). */
const STATUTS_BUDGET_VOTE: readonly StatutExercice[] = ['Voté', 'Répart. en cours', 'Réparti']

const estExerciceDeDouzeMois = (exercice: Exercice) => ajouterMois(exercice.ouverture, 12) === ajouterJours(exercice.cloture, 1)

/** Art. 14-1 : quatre provisions, le premier jour de chaque trimestre d'un exercice de douze mois. */
export function modalitesParDefaut(exercice: Exercice): ModalitesProvisions {
  if (!estExerciceDeDouzeMois(exercice))
    throw new Error(
      `Exercice ${exercice.nom} (${exercice.ouverture} – ${exercice.cloture}) d'une durée autre que douze mois : le quart du budget par trimestre (art. 14-1) ne s'applique pas, saisir les modalités votées.`,
    )
  return { nombre: 4, premiereLe: exercice.ouverture, tousLesMois: 3, decision: null }
}

/**
 * Échéances « budget » de l'exercice : pour chaque clé du budget, ses provisions aux dates des modalités (par défaut,
 * celles de l'art. 14-1), au compte 70100. Triées par date puis par code de clé ; une clé sans montant ne donne rien.
 * Exige un budget voté, la clé du syndicat de chaque ligne, et la décision qui fixe des modalités différentes.
 */
export function echeancesBudget({
  exercice,
  budget,
  cles,
  modalites,
}: {
  exercice: Exercice
  budget: Budget
  /** Clés de répartition du syndicat ; chaque ligne du budget s'y rattache par le code. */
  cles: CleRepartition[]
  modalites?: ModalitesProvisions
}): EcheanceAppel[] {
  if (!STATUTS_BUDGET_VOTE.includes(exercice.statut) || !exercice.resolutions.budget?.trim())
    throw new Error(
      `Budget de l'exercice ${exercice.nom} non voté (statut « ${exercice.statut} ») : pas de provisions de l'art. 14-1 sans vote du budget.`,
    )
  if (modalites && !modalites.decision?.trim())
    throw new Error("Modalités de provisions différentes de l'art. 14-1 : référence de la décision qui les fixe attendue.")
  const { nombre, premiereLe, tousLesMois } = modalites ?? modalitesParDefaut(exercice)
  if (!Number.isInteger(nombre) || nombre < 1) throw new Error(`Nombre de provisions invalide (${nombre}) : entier ≥ 1 attendu.`)
  if (!Number.isInteger(tousLesMois) || tousLesMois < 1)
    throw new Error(`Écart entre provisions invalide (${tousLesMois} mois) : entier ≥ 1 attendu.`)
  if (!estDateIsoValide(premiereLe)) throw new Error(`Date de la première provision invalide (${premiereLe}) : AAAA-MM-JJ attendu.`)
  const dates = Array.from({ length: nombre }, (_, i) => ajouterMois(premiereLe, i * tousLesMois))
  const horsExercice = dates.find((d) => d < exercice.ouverture || d > exercice.cloture)
  if (horsExercice)
    throw new Error(`Provision exigible le ${horsExercice}, hors de l'exercice ${exercice.nom} (${exercice.ouverture} – ${exercice.cloture}).`)

  const parCode = new Map<string, number>()
  for (const ligne of budget.lignes) parCode.set(ligne.cle, (parCode.get(ligne.cle) ?? 0) + ligne.prevuCentimes)
  const echeances: EcheanceAppel[] = []
  for (const [code, total] of [...parCode.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (total === 0) continue
    const cle = cles.find((c) => c.code === code && c.coproprieteId === exercice.coproprieteId)
    if (!cle) throw new Error(`Clé « ${code} » du budget absente des clés de répartition du syndicat.`)
    const parts = repartirAuxPlusFortsRestes(total, dates.map(() => 1))
    dates.forEach((exigibilite, i) =>
      echeances.push({
        id: `B-${exercice.nom}-${code}-${i + 1}`,
        coproprieteId: exercice.coproprieteId,
        cleId: cle.id,
        exigibilite,
        libelle: `Budget ${exercice.nom} — provision ${i + 1}/${nombre} (clé ${code})`,
        montantCentimes: parts[i],
        nature: 'budget',
        compteContrepartie: '70100',
      }),
    )
  }
  return echeances.sort((a, b) => a.exigibilite.localeCompare(b.exigibilite) || a.id.localeCompare(b.id))
}
