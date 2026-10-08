/**
 * Déclaration d'encargos (PT) / état daté (FR) — règles de date, une par pays.
 *
 * Module pur, partagé par la route /api/syndic/decl-encargos (qui fait foi pour la date
 * limite) et par le module ModDeclEncargos (KPI « Fora do prazo » / « Hors délai »).
 *
 * Les dates sont des jours civils « AAAA-MM-JJ » (colonnes DATE de Postgres) : l'arithmétique
 * se fait en UTC sur le jour civil, sans heure ni fuseau, donc sans décalage d'un jour au
 * passage à l'heure d'été. Jour courant et échéance dépassée : source unique, ./i18n/dates.
 */

import { echeanceDepassee } from './i18n/dates'
import { estFeriadoObrigatorio } from './feriados-pt'

/** Pays de la règle : 'pt' pour /pt/syndic/v54 (défaut), 'fr' pour /fr/syndic/v54. */
export type PaysDeclaration = 'pt' | 'fr'

export interface RegleDelaiDeclaration {
  /** Jours comptés à partir du lendemain de la demande : le jour de la demande n'est pas compté. */
  jours: number
  /** 'legal' : délai fixé par la loi ; 'interne' : délai que le cabinet s'impose, sans texte. */
  nature: 'legal' | 'interne'
  /**
   * Terme qui tombe un jour non ouvrable :
   * - 'art279e' (PT) : un dimanche ou un feriado obrigatório reporte le terme au premier jour
   *   qui n'est ni l'un ni l'autre (art. 279.º, e), CC) ;
   * - 'aucun' (FR) : terme maintenu tel quel.
   */
  reportTerme: 'art279e' | 'aucun'
}

export const REGLES_DELAI_DECLARATION: Readonly<Record<PaysDeclaration, RegleDelaiDeclaration>> = {
  /** Art. 1424.º-A, n.º 2, du Code civil portugais : déclaration émise « no prazo máximo de 10 dias
   *  a contar do respetivo requerimento ». Délai légal : l'art. 296.º CC lui rend applicables les
   *  règles de l'art. 279.º. Le jour de la demande n'est pas compté (al. b) ; le terme qui tombe un
   *  dimanche ou un jour férié passe au premier jour ouvrable (al. e). Lecture littérale de l'al. e),
   *  qui ne vise pas le samedi : un terme un samedi reste un samedi, et le report peut s'arrêter sur
   *  un samedi. Une jurisprudence du STA (acórdão du 08-10-2014, proc. 0548/14) étend la règle au
   *  samedi ; la lecture littérale est retenue car elle donne la date la plus prudente pour
   *  l'administrateur (décision à confirmer par Frédéric). */
  pt: { jours: 10, nature: 'legal', reportTerme: 'art279e' },
  /** Aucun texte ne fixe de délai de délivrance de l'état daté (décret n° 67-223 du 17 mars 1967,
   *  art. 5 : contenu seulement) ; délai interne de traitement affiché par le module, sans report. */
  fr: { jours: 10, nature: 'interne', reportTerme: 'aucun' },
}

const ISO_JOUR = /^(\d{4})-(\d{2})-(\d{2})$/

/** Jour civil « AAAA-MM-JJ » décalé de n jours ; null si le jour est absent, mal formé ou impossible. */
export function decalerJourCivil(jour: string | null | undefined, n: number): string | null {
  const m = jour ? ISO_JOUR.exec(jour) : null
  if (!m) return null
  const [annee, mois, j] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const civil = new Date(Date.UTC(annee, mois - 1, j))
  if (civil.getUTCFullYear() !== annee || civil.getUTCMonth() !== mois - 1 || civil.getUTCDate() !== j) return null
  civil.setUTCDate(civil.getUTCDate() + n)
  return civil.toISOString().slice(0, 10)
}

/** Dimanche, pour un jour civil « AAAA-MM-JJ » valide (jour de semaine lu en UTC). */
const estDimanche = (jour: string): boolean => new Date(`${jour}T00:00:00Z`).getUTCDay() === 0

/** Art. 279.º, e), CC : terme reporté tant qu'il tombe un dimanche ou un feriado obrigatório. */
function reporterTermeArt279e(terme: string): string {
  let jour = terme
  while (estDimanche(jour) || estFeriadoObrigatorio(jour)) {
    const lendemain = decalerJourCivil(jour, 1)
    if (!lendemain) return jour
    jour = lendemain
  }
  return jour
}

/** Date limite de la déclaration selon la règle du pays ; null sans date de demande valide. */
export function prazoLimiteDeclaracao(dataPedido: string | null | undefined, pays: PaysDeclaration): string | null {
  const regle = REGLES_DELAI_DECLARATION[pays]
  const terme = decalerJourCivil(dataPedido, regle.jours)
  if (!terme || regle.reportTerme === 'aucun') return terme
  return reporterTermeArt279e(terme)
}

/**
 * Hors délai : déclaration encore « pendente » dont la date limite est dépassée au jour civil
 * local (le jour de l'échéance reste dans le délai). Règle de calendrier commune, ./i18n/dates.
 */
export function estHorsDelai(d: { estado: string; prazoLimite: string }, maintenant: Date = new Date()): boolean {
  return d.estado === 'pendente' && echeanceDepassee(d.prazoLimite, maintenant)
}
