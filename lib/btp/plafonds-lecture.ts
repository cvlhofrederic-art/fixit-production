/**
 * Listes BTP que GET /api/btp renvoie avec un nombre maximal de lignes (constat donnees-btp-10 du 11/11/2026).
 *
 * Au-delà de ce nombre, la route renvoie les mêmes lignes qu'avant (les premières dans son ordre de tri) et le dit
 * dans `plafondsAtteints` (par exemple `{ pointages: 500 }`) ; l'écran prévient alors que la liste et les totaux
 * calculés dessus sont incomplets. Rien n'est supprimé ni masqué de plus : la route signale seulement qu'il existe
 * d'autres lignes. Module sans dépendance, lu par la route (serveur) et par les écrans (navigateur).
 */

export const PLAFONDS_LECTURE_BTP = {
  chantiers: 200,
  membres: 500,
  pointages: 500,
  depenses: 500,
  situations: 200,
  retenues: 200,
  dc4: 200,
  dce_analyses: 100,
  dpgf: 200,
  rapports: 500,
  rentabilite: 100,
} as const

export type ListePlafonnee = keyof typeof PLAFONDS_LECTURE_BTP

/** Ce que contient chaque liste coupée, et si le nom est féminin (accord de « seuls / seules »). */
const CONTENU: Record<Exclude<ListePlafonnee, 'rentabilite'>, { nom: string; feminin: boolean }> = {
  chantiers: { nom: 'chantiers les plus récents', feminin: false },
  membres: { nom: 'premiers membres (ordre alphabétique)', feminin: false },
  pointages: { nom: 'pointages les plus récents', feminin: false },
  depenses: { nom: 'dépenses les plus récentes', feminin: true },
  situations: { nom: 'situations de travaux les plus récentes', feminin: true },
  retenues: { nom: 'retenues de garantie les plus récentes', feminin: true },
  dc4: { nom: 'sous-traitants les plus récents', feminin: false },
  dce_analyses: { nom: 'analyses de DCE les plus récentes', feminin: true },
  dpgf: { nom: 'appels d\'offres les plus récents', feminin: false },
  rapports: { nom: 'rapports les plus récents', feminin: false },
}

/** Message affiché quand une liste est coupée à `plafond` lignes. */
export function messagePlafondAtteint(liste: string, plafond: number): string {
  if (liste === 'rentabilite') {
    return `Rentabilité incomplète : seuls ${plafond} chantiers sont pris en compte. Les autres n'apparaissent ni ici ni dans les totaux.`
  }
  const contenu = CONTENU[liste as keyof typeof CONTENU]
  if (!contenu) {
    return `Liste incomplète : seules les ${plafond} premières lignes sont affichées. Les autres n'apparaissent ni ici ni dans les totaux.`
  }
  const [seuls, affiches, comptes] = contenu.feminin ? ['seules', 'affichées', 'comptées'] : ['seuls', 'affichés', 'comptés']
  return `Liste incomplète : ${seuls} les ${plafond} ${contenu.nom} sont ${affiches}. Les autres n'apparaissent pas ici et ne sont pas ${comptes} dans les totaux.`
}
