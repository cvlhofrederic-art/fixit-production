import type { ReferenceJurisprudence } from '@/lib/administrateur-judiciaire/domain/fondements'

/**
 * Postes de créance d'un dossier de recouvrement (décision J3 du 08/10/2026). Fonctions pures, sans écran.
 *
 * Les deux voies coexistent : procédure accélérée au fond de l'art. 19-2 (provisions exigibles après mise en demeure
 * restée infructueuse) et action de droit commun. Le fondement n'est donc pas porté par le dossier mais par CHAQUE
 * poste de créance, pour un exercice donné. Le registre recouvrement.ts (figé par les tests oracle) n'est pas touché.
 */

export const FONDEMENTS_RECOUVREMENT = ['art_19_2', 'droit_commun'] as const
export type FondementRecouvrement = (typeof FONDEMENTS_RECOUVREMENT)[number]

export const LIBELLES_FONDEMENT_RECOUVREMENT: Record<FondementRecouvrement, string> = {
  art_19_2: 'Procédure accélérée au fond (L. 1965 art. 19-2)',
  droit_commun: 'Action de droit commun',
}

export interface PosteCreance {
  id: string
  /** Exercice comptable auquel la somme se rattache (libellé de l'exercice, ex. « 2025 »). */
  exercice: string
  /** Nature de la somme (ex. provision du budget prévisionnel, provision travaux, charges). */
  nature: string
  montantCentimes: number
  fondement: FondementRecouvrement
}

/** Vérifie un poste de créance : exercice et nature renseignés, montant en centimes entiers > 0, fondement connu. */
export function creerPosteCreance(poste: PosteCreance): PosteCreance {
  if (!(FONDEMENTS_RECOUVREMENT as readonly string[]).includes(poste.fondement))
    throw new Error(`Fondement de recouvrement inconnu : « ${poste.fondement} ».`)
  if (!poste.exercice.trim()) throw new Error("Poste de créance sans exercice : l'exercice est obligatoire.")
  if (!poste.nature.trim()) throw new Error('Poste de créance sans nature : la nature est obligatoire.')
  if (!Number.isInteger(poste.montantCentimes) || poste.montantCentimes <= 0)
    throw new Error(`Montant invalide (${poste.montantCentimes}) : centimes entiers strictement positifs attendus.`)
  return { ...poste }
}

/** Jurisprudence appliquée au contrôle de la mise en demeure de l'art. 19-2. */
export const JURISPRUDENCE_MISE_EN_DEMEURE_19_2 = {
  unExerciceParMiseEnDemeure: {
    citation: 'Cass. 3e civ., 15 janv. 2026, n° 23-23.534, FS-B',
    portee: "Une mise en demeure par exercice pour agir selon l'art. 19-2.",
    verification: 'SOURCE_SECONDAIRE',
  },
  natureEtMontantParProvision: {
    citation: 'Cass. avis, 12 déc. 2024, n° 24-70.007 ; appliqué par Cass. 3e civ., 18 juin 2026, n° 24-19.950',
    portee:
      "La mise en demeure précise la nature et le montant de chaque provision réclamée, à peine d'irrecevabilité de la demande.",
    verification: 'SOURCE_SECONDAIRE',
  },
} as const satisfies Record<string, ReferenceJurisprudence>

/** Poste visé par une mise en demeure, avec ce que le courrier MENTIONNE effectivement (null = non mentionné). */
export interface PosteVise {
  posteId: string
  natureMentionnee: string | null
  montantMentionneCentimes: number | null
}

export interface AlerteMiseEnDemeure {
  code: 'plusieurs_exercices' | 'nature_ou_montant_manquant'
  /** Poste concerné ; absent pour une alerte qui porte sur la mise en demeure entière. */
  posteId?: string
  motif: string
  source: string
}

/**
 * Contrôle une mise en demeure au regard de l'art. 19-2 (J3). Seuls les postes de fondement 19-2 sont contrôlés :
 * - plusieurs exercices visés par une seule mise en demeure → alerte ;
 * - nature ou montant d'une provision non mentionné → alerte (à peine d'irrecevabilité).
 * Lève une erreur si un poste visé est introuvable. Renvoie [] si la mise en demeure est conforme.
 */
export function controlerMiseEnDemeure19_2(
  miseEnDemeure: { postesVises: PosteVise[] },
  postes: PosteCreance[],
): AlerteMiseEnDemeure[] {
  const vises = miseEnDemeure.postesVises.map((vise) => {
    const poste = postes.find((candidat) => candidat.id === vise.posteId)
    if (!poste) throw new Error(`Poste de créance introuvable (id=${vise.posteId}).`)
    return { vise, poste }
  })
  const en19_2 = vises.filter(({ poste }) => poste.fondement === 'art_19_2')
  const alertes: AlerteMiseEnDemeure[] = []
  const exercices = [...new Set(en19_2.map(({ poste }) => poste.exercice))].sort((a, b) => a.localeCompare(b))
  if (exercices.length > 1)
    alertes.push({
      code: 'plusieurs_exercices',
      motif: `Une même mise en demeure vise plusieurs exercices (${exercices.join(', ')}) : une mise en demeure par exercice est requise pour l'art. 19-2.`,
      source: JURISPRUDENCE_MISE_EN_DEMEURE_19_2.unExerciceParMiseEnDemeure.citation,
    })
  for (const { vise, poste } of en19_2)
    if (!vise.natureMentionnee?.trim() || vise.montantMentionneCentimes === null)
      alertes.push({
        code: 'nature_ou_montant_manquant',
        posteId: poste.id,
        motif: `La mise en demeure ne mentionne pas ${vise.natureMentionnee?.trim() ? 'le montant' : 'la nature'} de la provision « ${poste.nature} » (exercice ${poste.exercice}) : demande irrecevable en l'état.`,
        source: JURISPRUDENCE_MISE_EN_DEMEURE_19_2.natureEtMontantParProvision.citation,
      })
  return alertes
}

export interface AvertissementProcedure {
  code: 'autorite_chose_jugee' | 'pas_de_demande_reconventionnelle'
  texte: string
}

/** Avertissements à afficher dès qu'un poste relève de l'art. 19-2 (décision J3 ; certitude : à confirmer). */
export const AVERTISSEMENTS_PROCEDURE_19_2: AvertissementProcedure[] = [
  {
    code: 'autorite_chose_jugee',
    texte:
      "Le rejet de la demande en procédure accélérée au fond a l'autorité de la chose jugée : la même créance ne pourra pas être présentée à nouveau.",
  },
  {
    code: 'pas_de_demande_reconventionnelle',
    texte: "Le juge de l'art. 19-2 ne connaît pas des demandes reconventionnelles.",
  },
]

/** Avertissements de procédure applicables à un ensemble de postes. */
export function avertissementsProcedure(postes: PosteCreance[]): AvertissementProcedure[] {
  return postes.some((poste) => poste.fondement === 'art_19_2') ? AVERTISSEMENTS_PROCEDURE_19_2 : []
}
