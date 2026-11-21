import { ajouterMois, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'

/**
 * Délai d'un mois « à compter de la demande » : fiche synthétique (L. 1965 art. 8-2) et pièces demandées par le conseil
 * syndical (art. 21, al. 7). Décision du 17/11/2026 (J67, R24 ; textes lus sur Légifrance le 17/11/2026, version
 * du 01/06/2020) : un mois, compté comme une règle de GESTION depuis la date connue la plus tôt : la date de la demande
 * (date d'envoi, ou date écrite sur la demande) et, seulement à défaut, sa réception ; jamais la date de création d'une
 * étape. Le texte ne dit ni envoi ni réception, et aucun arrêt n'a été lu.
 *
 * Aucune pénalité n'est annoncée : les deux textes imputent les pénalités sur la rémunération forfaitaire annuelle du
 * syndic, que n'a pas l'administrateur provisoire de l'art. 29-1 (rémunération arrêtée par le juge : L. 1965 art. 29-1,
 * II ; D. 1967 art. 61-1-5) ; leur application au syndic de l'art. 46 et à l'administrateur de l'art. 47 n'est pas établie
 * non plus.
 *
 * Fonction pure, dates AAAA-MM-JJ, sans écran ni table. Reste à faire hors de ce module : les deux dates de la demande
 * (« datée du », « reçue le ») sur l'étape née d'une demande (etapes-dossier.ts, question n° 9, après la PR #741) ou
 * sur le courrier entrant ; enregistrement des deux dates : à brancher ; affichage de la base retenue : écran de
 * Frédéric.
 */

/** L. 1965 art. 8-2 et art. 21, al. 7 : « un délai d'un mois à compter de la demande ». */
export const MOIS_A_COMPTER_DE_LA_DEMANDE = 1

/** Ce que la demande vise, et le texte qui fixe le mois. */
const FONDEMENTS_DEMANDE = {
  fiche_synthetique: 'L. 1965 art. 8-2',
  pieces_conseil_syndical: 'L. 1965 art. 21, al. 7',
} as const

export type ObjetDemandeUnMois = keyof typeof FONDEMENTS_DEMANDE

export interface LimiteACompterDeLaDemande {
  limite: string
  /** Date retenue comme départ : celle de la demande, ou sa réception. */
  base: 'datee_du' | 'recue_le'
  depuis: string
  fondement: string
  justification: string
}

function dateFacultative(valeur: string | null, quoi: string): string | null {
  if (valeur === null) return null
  if (!estDateIsoValide(valeur)) throw new Error(`${quoi} invalide (${valeur}) : AAAA-MM-JJ attendu.`)
  return valeur
}

/**
 * Limite d'une réponse due « dans un délai d'un mois à compter de la demande » (J67, R24) : la date connue la plus tôt
 * (datée du, sinon reçue le) plus un mois (dates.ajouterMois, borné en fin de mois). Refus : objet inconnu, date
 * invalide, ou ni date de la demande ni réception.
 */
export function limiteACompterDeLaDemande({
  objet,
  dateeDu,
  recueLe,
}: {
  objet: ObjetDemandeUnMois
  dateeDu: string | null
  recueLe: string | null
}): LimiteACompterDeLaDemande {
  if (!Object.hasOwn(FONDEMENTS_DEMANDE, objet)) throw new Error(`Objet de la demande inconnu : « ${String(objet)} ».`)
  const datee = dateFacultative(dateeDu, 'Date de la demande')
  const recue = dateFacultative(recueLe, 'Date de réception de la demande')
  if (datee === null && recue === null) throw new Error('Délai à compter de la demande : date de la demande ou de sa réception attendue.')
  const base = recue === null || (datee !== null && datee <= recue) ? 'datee_du' : 'recue_le'
  const depuis = (base === 'datee_du' ? datee : recue) as string
  const limite = ajouterMois(depuis, MOIS_A_COMPTER_DE_LA_DEMANDE)
  const fondement = FONDEMENTS_DEMANDE[objet]
  const depart =
    base === 'datee_du'
      ? `depuis la date de la demande, le ${dateIsoVersFr(depuis)}`
      : `depuis sa réception, le ${dateIsoVersFr(depuis)}${datee === null ? ', faute de date de la demande' : ', plus tôt que la date écrite sur la demande'}`
  return {
    limite,
    base,
    depuis,
    fondement,
    justification: `Délai de gestion d’un mois à compter de la demande (${fondement}), compté ${depart} : réponse au plus tard le ${dateIsoVersFr(limite)} (J67, R24).`,
  }
}
