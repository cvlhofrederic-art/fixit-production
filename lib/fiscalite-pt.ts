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
 *
 * Références de Léa (assistante comptable, app/api/comptable-ai) vérifiées le 17/11/2026 sur les textes officiels
 * (Portal das Finanças, diplômes du Diário da República publiés par l'AT, gov.pt) : IAS, mínimo de existência, barème
 * de l'IRS, retenção na fonte et sa dispense, IRS Jovem, isenção de Segurança Social en cumul avec un emploi salarié.
 * Une valeur qui change chaque année porte son année (ValorAno) : tant que la table de l'année n'est pas complétée,
 * Léa montre la dernière valeur publiée avec son année au lieu de la présenter comme celle de l'année en cours.
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

// ── Références datées de Léa ────────────────────────────────────────────────────────────────────────────────────

/** Valeur d'une table annuelle et l'année dont elle vient (à afficher avec la valeur). */
export interface ValorAno<T> {
  ano: number
  valor: T
}

/**
 * Valeur de l'année demandée ; à défaut celle de la dernière année connue avant elle (une année pas encore renseignée
 * garde la dernière valeur publiée, avec son année) ; avant la première année connue, celle de la première.
 */
function valorDoAno<T>(tabela: Readonly<Record<number, T>>, annee: number): ValorAno<T> {
  const anos = Object.keys(tabela).map(Number).sort((a, b) => a - b)
  const ano = anos.filter(a => a <= annee).pop() ?? anos[0]
  return { ano, valor: tabela[ano] }
}

const centimos = (valor: number) => Math.round(valor * 100) / 100

/**
 * IAS (indexante dos apoios sociais), en euros par mois : 522,50 € en 2025 (Portaria n.º 6-B/2025/1, art. 2.º) et
 * 537,13 € en 2026 (Portaria n.º 480-A/2025/1 du 30/12/2025, art. 2.º, effet au 1er janvier 2026). 509,26 € était la
 * valeur de 2024. Une portaria fixe la valeur chaque fin décembre : ajouter l'année ici.
 */
const IAS_PT: Readonly<Record<number, number>> = { 2025: 522.5, 2026: 537.13 }

export function iasPt(annee: number): ValorAno<number> {
  return valorDoAno(IAS_PT, annee)
}

/**
 * Mínimo de existência (art. 70.º, n.º 1, du CIRS) : valeur de référence = le plus grand de 12 880 € (OE 2026, Lei n.º
 * 73-A/2025 ; 12 180 € en 2025, Lei n.º 45-A/2024) et de 1,5 × 14 × IAS. Ce n'est pas une exonération mais un
 * abatimento (n.º 2), réservé aux revenus surtout salariés, de pensions ou d'activités de la table de l'art. 151.º
 * (sauf le code 15) : les autres revenus de la catégorie B n'y ont pas droit.
 */
const MINIMO_EXISTENCIA_FIXO_PT: Readonly<Record<number, number>> = { 2025: 12_180, 2026: 12_880 }

export function minimoExistenciaPt(annee: number): ValorAno<number> {
  const { ano, valor: fixo } = valorDoAno(MINIMO_EXISTENCIA_FIXO_PT, annee)
  return { ano, valor: Math.max(fixo, centimos(1.5 * 14 * iasPt(ano).valor)) }
}

/** IRS Jovem (art. 12.º-B, n.º 5, du CIRS, rédaction de la Lei n.º 45-A/2024) : exonération plafonnée à 55 × IAS. */
export function limiteIrsJovemPt(annee: number): ValorAno<number> {
  const { ano, valor } = iasPt(annee)
  return { ano, valor: centimos(55 * valor) }
}

/**
 * Segurança Social (gov.pt, « Requerer a isenção do pagamento de contribuições », mis à jour le 19/10/2026) : un
 * indépendant qui cumule avec un emploi salarié est exonéré tant que son rendimento relevante mensuel moyen, calculé
 * par trimestre, reste sous 4 × IAS (l'emploi, chez une autre entité, doit payer au moins 1 IAS). Montant mensuel.
 */
export function limiteIsencaoSsAcumulacaoPt(annee: number): ValorAno<number> {
  const { ano, valor } = iasPt(annee)
  return { ano, valor: centimos(4 * valor) }
}

/** Escalão de l'IRS : limite supérieur du rendimento coletável (null pour le dernier) et taux normal. */
export interface EscalaoIrs {
  ate: number | null
  taxa: number
}

/**
 * Taux généraux de l'IRS (art. 68.º, n.º 1, du CIRS). 2026 : Decreto-Lei n.º 212/2026 du 04/11/2026, appliqué aux
 * revenus de 2026 depuis le 1er janvier ; il remplace le barème de l'OE 2026 (Lei n.º 73-A/2025 : mêmes tranches, taux
 * des six premières plus hauts de 0,3 à 0,5 point).
 */
const ESCALOES_IRS_PT: Readonly<Record<number, ReadonlyArray<EscalaoIrs>>> = {
  2026: [
    { ate: 8_342, taxa: 0.122 },
    { ate: 12_587, taxa: 0.152 },
    { ate: 17_838, taxa: 0.207 },
    { ate: 23_089, taxa: 0.236 },
    { ate: 29_397, taxa: 0.306 },
    { ate: 43_090, taxa: 0.346 },
    { ate: 46_566, taxa: 0.431 },
    { ate: 86_634, taxa: 0.446 },
    { ate: null, taxa: 0.48 },
  ],
}

export function escaloesIrsPt(annee: number): ValorAno<ReadonlyArray<EscalaoIrs>> {
  return valorDoAno(ESCALOES_IRS_PT, annee)
}

/** « 8 342 € » (espace insécable entre les milliers, dès 1 000) ; centimes seulement s'il y en a : « 537,13 € ». */
export function eurPt(valor: number): string {
  const [inteiro, decimais] = valor.toFixed(Number.isInteger(valor) ? 0 : 2).split('.')
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const numero = decimais ? agrupado + ',' + decimais : agrupado
  return `${numero} €`
}

/** « 23% », « 11,5% » : un taux en pourcentage, virgule décimale. */
export function percentPt(taxa: number): string {
  return `${String(centimos(taxa * 100)).replace('.', ',')}%`
}

/** Escalões en portugais, dans l'ordre : « Até 8 342 € », « Mais de 8 342 € até 12 587 € », …, « Mais de 86 634 € ». */
export function faixasIrsPt(annee: number): ValorAno<Array<{ faixa: string; taxa: string }>> {
  const { ano, valor } = escaloesIrsPt(annee)
  const faixas = valor.map((escalao, i) => {
    const de = i > 0 ? valor[i - 1].ate : null
    let faixa = `Até ${eurPt(escalao.ate ?? 0)}`
    if (de !== null) faixa = escalao.ate === null ? `Mais de ${eurPt(de)}` : `Mais de ${eurPt(de)} até ${eurPt(escalao.ate)}`
    return { faixa, taxa: percentPt(escalao.taxa) }
  })
  return { ano, valor: faixas }
}

/**
 * Retenção na fonte de la catégorie B (art. 101.º, n.º 1, du CIRS) : due par le client qui a ou doit avoir une
 * comptabilité organisée ; 23 % pour les activités de la table de l'art. 151.º (alínea b), Lei n.º 45-A/2024 : 25 %
 * jusqu'en 2024), 11,5 % pour les autres prestations de services de la catégorie B (alínea c)).
 */
export const RETENCAO_CAT_B_PT = { tabela151: 0.23, outrosServicos: 0.115 } as const

/**
 * Dispense de retenção (art. 101.º-B, n.º 1, a), du CIRS) : revenu prévu de l'année sous la limite de l'art. 53.º,
 * n.º 1, du CIVA (celle de l'isenção d'IVA, getTvaStatus), sauf si l'année précédente l'a atteinte ; elle cesse le mois
 * suivant le dépassement (n.º 3) ; mention obligatoire sur la fatura-recibo (n.º 2).
 */
export function limiteDispensaRetencaoPt(): number {
  return getTvaStatus(0, 'PT').seuil
}
