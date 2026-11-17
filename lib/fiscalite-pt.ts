/**
 * Fiscalité portugaise des sociétés (continent) : estimation de l'IRC et calendrier des échéances affichés dans la
 * Contabilidade du tableau de bord pro. Jamais de règle française appliquée au Portugal.
 *
 * Faits vérifiés le 17/11/2026 (Portal das Finanças, OE 2026 et loi de baisse de l'IRC) :
 * - art. 87.º du CIRC : taux réduit des PME (et Small Mid Caps) sur les 50 000 premiers euros de matière imposable,
 *   17 % jusqu'en 2024, 16 % en 2025, 15 % à partir de 2026 ; taux général 21 % jusqu'en 2024, 20 % en 2025, 19 % en
 *   2026, 18 % en 2027 et 17 % à partir de 2028 (baisse votée) ;
 * - pagamentos por conta de l'IRC : 31 juillet, 30 septembre, 15 décembre ; déclaration Modelo 22 : 31 mai ;
 * - déclaration périodique d'IVA trimestrielle : jusqu'au 20 du deuxième mois après le trimestre, paiement jusqu'au 25 ;
 * - IRS (Modelo 3) : du 1er avril au 30 juin ; déclaration trimestrielle des indépendants à la Segurança Social :
 *   dernier jour de janvier, avril, juillet et octobre.
 * L'estimation ne compte ni la derrama (municipale, estadual) ni la tributação autónoma ; le taux réduit suppose une PME.
 */

import { getTvaStatus } from './tva-thresholds'

export const PLAFOND_TAUX_REDUIT_IRC = 50_000

export interface TauxIrc {
  /** Taux réduit des PME sur les 50 000 premiers euros. */
  reduit: number
  /** Taux général, au-delà. */
  general: number
}

/** Taux d'IRC d'une année (continent). Avant 2024 : taux de 2024. */
export function tauxIrc(annee: number): TauxIrc {
  if (annee <= 2024) return { reduit: 0.17, general: 0.21 }
  if (annee === 2025) return { reduit: 0.16, general: 0.2 }
  if (annee === 2026) return { reduit: 0.15, general: 0.19 }
  if (annee === 2027) return { reduit: 0.15, general: 0.18 }
  return { reduit: 0.15, general: 0.17 }
}

/** IRC estimé sur un résultat imposable (0 si le résultat n'est pas positif). */
export function estimerIrc(resultat: number, annee: number): number {
  if (!(resultat > 0)) return 0
  const { reduit, general } = tauxIrc(annee)
  const tranche = Math.min(resultat, PLAFOND_TAUX_REDUIT_IRC)
  return tranche * reduit + (resultat - tranche) * general
}

/** « 15% / 19% » : les deux taux d'une année, pour l'affichage. */
export function libelleTauxIrc(annee: number): string {
  const { reduit, general } = tauxIrc(annee)
  return `${Math.round(reduit * 100)}% / ${Math.round(general * 100)}%`
}

export interface EcheanceFiscale {
  titre: string
  detail: string
  date: string
}

/**
 * Quatre prochaines échéances à montrer dans le « Calendário fiscal » (ordre de l'année), selon que le professionnel est
 * une société (IRC) ou un indépendant (IRS, Segurança Social).
 */
export function calendrierFiscalPt(societe: boolean): EcheanceFiscale[] {
  const iva: EcheanceFiscale = {
    titre: 'Declaração periódica de IVA (1.º trimestre)',
    detail: societe ? 'Entrega até dia 20, pagamento até dia 25' : 'Se estiver no regime normal de IVA',
    date: '20 mai',
  }
  if (societe) {
    return [
      iva,
      { titre: 'Modelo 22 (IRC)', detail: 'Declaração anual de rendimentos', date: '31 mai' },
      { titre: 'IRC: 1.º pagamento por conta', detail: 'Com base no IRC do ano anterior', date: '31 jul' },
      { titre: 'IRC: 2.º pagamento por conta', detail: '3.º pagamento até 15 de dezembro', date: '30 set' },
    ]
  }
  return [
    { titre: 'Segurança Social: declaração trimestral', detail: 'Rendimentos de janeiro a março', date: '30 abr' },
    iva,
    { titre: 'Modelo 3 (IRS)', detail: 'Entrega de 1 de abril a 30 de junho', date: '30 jun' },
    { titre: 'Segurança Social: declaração trimestral', detail: 'Rendimentos de abril a junho', date: '31 jul' },
  ]
}

/**
 * Prochaine déclaration périodique d'IVA trimestrielle à partir d'une date : le 20 février (4e trimestre de l'année
 * précédente), le 20 mai, le 20 août ou le 20 novembre, le jour même compris.
 */
export function prochaineDeclarationIvaPt(aujourdhui: Date): string {
  const echeances: Array<{ mois: number; libelle: string }> = [
    { mois: 1, libelle: '20 fev (IVA T4)' },
    { mois: 4, libelle: '20 mai (IVA T1)' },
    { mois: 7, libelle: '20 ago (IVA T2)' },
    { mois: 10, libelle: '20 nov (IVA T3)' },
  ]
  const mois = aujourdhui.getMonth()
  const jour = aujourdhui.getDate()
  const suivante = echeances.find(e => mois < e.mois || (mois === e.mois && jour <= 20))
  return (suivante ?? echeances[0]).libelle
}

/**
 * Isenção de IVA de l'art. 53.º du CIVA d'un indépendant, selon le chiffre d'affaires de l'année, avec les paliers de
 * getTvaStatus(…, 'PT') (lib/tva-thresholds.ts) : jusqu'à 15 000 €, isento (si l'année précédente l'était aussi) ;
 * au-delà, isenção maintenue jusqu'au 31 décembre et regime normal au 1er janvier ; au-delà de 18 750 €, cessation
 * immédiate. Texte portugais (Léa) ; declararIva : déclarations périodiques d'IVA dues dès cette année.
 */
export function isencaoIvaPt(caHT: number): { texto: string; declararIva: boolean } {
  const { status, seuil, seuilMajore } = getTvaStatus(caHT, 'PT')
  const eur = (valor: number) => `${valor.toLocaleString('pt-PT')} €`
  if (status === 'exceeded_majore') {
    return { texto: `⚠️ ACIMA de ${eur(seuilMajore ?? 18_750)}: a isenção do art. 53.º do CIVA cessa de imediato; IVA obrigatório`, declararIva: true }
  }
  if (status === 'exceeded') {
    return { texto: `⚠️ ACIMA de ${eur(seuil)}: isenção mantida até 31 de dezembro; regime normal de IVA a partir de 1 de janeiro`, declararIva: false }
  }
  return { texto: `✅ Abaixo do limite de isenção do art. 53.º do CIVA (${eur(seuil)}): isento, se o ano anterior também ficou abaixo deste limite`, declararIva: false }
}
