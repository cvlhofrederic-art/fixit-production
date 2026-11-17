// tests/lib/fiscalite-pt.test.ts
//
// Fiscalité portugaise de la Contabilidade (lib/fiscalite-pt.ts) : l'IRC remplace l'IS français pour les sociétés
// portugaises, et le calendrier fiscal suit les échéances portugaises (rapport i18n PT-PT du 17/11/2026, faits vérifiés
// le même jour : voir l'en-tête du module).

import { describe, expect, it } from 'vitest'
import {
  PLAFOND_TAUX_REDUIT_IRC, RETENCAO_CAT_B_PT, calendrierFiscalPt, escaloesIrsPt, estimerIrc, eurPt, faixasIrsPt, iasPt,
  isencaoIvaPt, libelleTauxIrc, limiteDispensaRetencaoPt, limiteIrsJovemPt, limiteIsencaoSsAcumulacaoPt,
  minimoExistenciaPt, percentPt, prochaineDeclarationIvaPt, tauxIrc,
} from '@/lib/fiscalite-pt'

describe('tauxIrc / estimerIrc', () => {
  it('2026 : 15 % sur les 50 000 premiers euros, 19 % au-delà', () => {
    expect(tauxIrc(2026)).toEqual({ reduit: 0.15, general: 0.19 })
    expect(PLAFOND_TAUX_REDUIT_IRC).toBe(50_000)
    expect(estimerIrc(40_000, 2026)).toBeCloseTo(6_000, 6)
    expect(estimerIrc(80_000, 2026)).toBeCloseTo(50_000 * 0.15 + 30_000 * 0.19, 6)
  })

  it('taux de chaque année (2024 à 2028 et après)', () => {
    expect(tauxIrc(2024)).toEqual({ reduit: 0.17, general: 0.21 })
    expect(tauxIrc(2025)).toEqual({ reduit: 0.16, general: 0.2 })
    expect(tauxIrc(2027)).toEqual({ reduit: 0.15, general: 0.18 })
    expect(tauxIrc(2028)).toEqual({ reduit: 0.15, general: 0.17 })
    expect(tauxIrc(2031)).toEqual({ reduit: 0.15, general: 0.17 })
  })

  it('résultat nul, négatif ou invalide : pas d’impôt', () => {
    expect(estimerIrc(0, 2026)).toBe(0)
    expect(estimerIrc(-5_000, 2026)).toBe(0)
    expect(estimerIrc(Number.NaN, 2026)).toBe(0)
  })

  it('jamais le barème français de l’IS (15 % puis 25 % au-delà de 42 500 €)', () => {
    const isFrancais = 42_500 * 0.15 + (100_000 - 42_500) * 0.25
    expect(estimerIrc(100_000, 2026)).not.toBeCloseTo(isFrancais, 0)
    expect(libelleTauxIrc(2026)).toBe('15% / 19%')
  })
})

describe('calendrierFiscalPt', () => {
  it('société : IVA, Modelo 22 au 31 mai, pagamentos por conta au 31 juillet et au 30 septembre', () => {
    expect(calendrierFiscalPt(true).map(e => [e.titre, e.date])).toEqual([
      ['Declaração periódica de IVA (1.º trimestre)', '20 mai'],
      ['Modelo 22 (IRC)', '31 mai'],
      ['IRC: 1.º pagamento por conta', '31 jul'],
      ['IRC: 2.º pagamento por conta', '30 set'],
    ])
  })

  it('indépendant : Segurança Social trimestrielle, IVA et IRS (Modelo 3) jusqu’au 30 juin', () => {
    expect(calendrierFiscalPt(false).map(e => e.date)).toEqual(['30 abr', '20 mai', '30 jun', '31 jul'])
  })

  it('textes en PT-PT : pas de tiret long ni d’espace avant « : »', () => {
    for (const e of [...calendrierFiscalPt(true), ...calendrierFiscalPt(false)]) {
      expect(`${e.titre} ${e.detail}`).not.toMatch(/[—–]|\s:/)
    }
  })
})

describe('prochaineDeclarationIvaPt', () => {
  it('le 20 du deuxième mois après le trimestre, jour même compris', () => {
    expect(prochaineDeclarationIvaPt(new Date(2026, 0, 10))).toBe('20 fev (IVA T4)')
    expect(prochaineDeclarationIvaPt(new Date(2026, 1, 20))).toBe('20 fev (IVA T4)')
    expect(prochaineDeclarationIvaPt(new Date(2026, 1, 21))).toBe('20 mai (IVA T1)')
    expect(prochaineDeclarationIvaPt(new Date(2026, 6, 1))).toBe('20 ago (IVA T2)')
    expect(prochaineDeclarationIvaPt(new Date(2026, 10, 17))).toBe('20 nov (IVA T3)')
    expect(prochaineDeclarationIvaPt(new Date(2026, 10, 21))).toBe('20 fev (IVA T4)')
    expect(prochaineDeclarationIvaPt(new Date(2026, 11, 31))).toBe('20 fev (IVA T4)')
  })
})

describe('isencaoIvaPt (Léa) : mêmes paliers que la Contabilidade', () => {
  const texto = (ca: number) => isencaoIvaPt(ca).texto.replace(/\s/g, ' ')

  it('jusqu’à 15 000 € : isento, sans déclaration périodique', () => {
    for (const ca of [0, 12_000, 15_000]) {
      expect(texto(ca)).toBe('✅ Abaixo do limite de isenção do art. 53.º do CIVA (15 000 €): isento, se o ano anterior também ficou abaixo deste limite')
      expect(isencaoIvaPt(ca).declararIva).toBe(false)
    }
  })

  it('de 15 000 € à 18 750 € : isenção maintenue jusqu’au 31 décembre (et non « IVA obrigatório »)', () => {
    for (const ca of [15_001, 16_000, 18_750]) {
      expect(texto(ca)).toBe('⚠️ ACIMA de 15 000 €: isenção mantida até 31 de dezembro; regime normal de IVA a partir de 1 de janeiro')
      expect(isencaoIvaPt(ca).declararIva).toBe(false)
    }
  })

  it('au-delà de 18 750 € : cessation immédiate, déclarations dues', () => {
    expect(texto(19_000)).toBe('⚠️ ACIMA de 18 750 €: a isenção do art. 53.º do CIVA cessa de imediato; IVA obrigatório')
    expect(isencaoIvaPt(19_000).declararIva).toBe(true)
  })

  it('textes en PT-PT : pas de tiret long ni d’espace avant « : »', () => {
    for (const ca of [10_000, 16_000, 20_000]) expect(texto(ca)).not.toMatch(/[—–]|\S :/)
  })
})

// Références de Léa vérifiées le 17/11/2026 sur les textes officiels (Portal das Finanças, diplômes publiés par l'AT,
// gov.pt). Valeurs périmées remplacées : IAS de 2024 (509,26 €) donné pour 2025, mínimo de existência de 2024
// (11 480 €), retenção na fonte à 25 % et dispense sous 12 500 €, barème de l'IRS « 2025 » faux.
describe('références datées de Léa', () => {
  it('IAS : 522,50 € en 2025, 537,13 € en 2026 ; une année pas encore renseignée garde la dernière valeur, avec son année', () => {
    expect(iasPt(2025)).toEqual({ ano: 2025, valor: 522.5 })
    expect(iasPt(2026)).toEqual({ ano: 2026, valor: 537.13 })
    expect(iasPt(2027)).toEqual({ ano: 2026, valor: 537.13 })
    expect(iasPt(2020)).toEqual({ ano: 2025, valor: 522.5 })
  })

  it('mínimo de existência : 12 880 € en 2026 (12 180 € en 2025), au moins 1,5 × 14 × IAS', () => {
    expect(minimoExistenciaPt(2026)).toEqual({ ano: 2026, valor: 12_880 })
    expect(minimoExistenciaPt(2025)).toEqual({ ano: 2025, valor: 12_180 })
    expect(minimoExistenciaPt(2028)).toEqual({ ano: 2026, valor: 12_880 })
    for (const ano of [2025, 2026]) expect(minimoExistenciaPt(ano).valor).toBeGreaterThanOrEqual(1.5 * 14 * iasPt(ano).valor)
  })

  it('IRS Jovem (55 × IAS) et isenção de Segurança Social en cumul (4 × IAS par mois) suivent l’IAS de l’année', () => {
    expect(limiteIrsJovemPt(2026)).toEqual({ ano: 2026, valor: 29_542.15 })
    expect(limiteIrsJovemPt(2025)).toEqual({ ano: 2025, valor: 28_737.5 })
    expect(limiteIsencaoSsAcumulacaoPt(2026)).toEqual({ ano: 2026, valor: 2_148.52 })
  })

  it('barème de l’IRS 2026 (Decreto-Lei n.º 212/2026, revenus de 2026) : neuf escalões, de 12,2 % à 48 %', () => {
    const { ano, valor } = escaloesIrsPt(2026)
    expect(ano).toBe(2026)
    expect(valor.map(e => e.ate)).toEqual([8_342, 12_587, 17_838, 23_089, 29_397, 43_090, 46_566, 86_634, null])
    expect(valor.map(e => e.taxa)).toEqual([0.122, 0.152, 0.207, 0.236, 0.306, 0.346, 0.431, 0.446, 0.48])
    expect(escaloesIrsPt(2027).ano).toBe(2026)
  })

  it('escalões en portugais, sans tiret long ni espace avant « : »', () => {
    const linhas = faixasIrsPt(2026).valor.map(f => `${f.faixa}: ${f.taxa}`.replace(/ /g, ' '))
    expect(linhas).toHaveLength(9)
    expect(linhas[0]).toBe('Até 8 342 €: 12,2%')
    expect(linhas[1]).toBe('Mais de 8 342 € até 12 587 €: 15,2%')
    expect(linhas[3]).toBe('Mais de 17 838 € até 23 089 €: 23,6%')
    expect(linhas[8]).toBe('Mais de 86 634 €: 48%')
    for (const linha of linhas) expect(linha).not.toMatch(/[—–]|\S :/)
  })

  it('retenção na fonte : 23 % (table de l’art. 151.º), 11,5 % (autres services) ; dispense sous le seuil de l’art. 53.º du CIVA', () => {
    expect(RETENCAO_CAT_B_PT).toEqual({ tabela151: 0.23, outrosServicos: 0.115 })
    expect(percentPt(RETENCAO_CAT_B_PT.tabela151)).toBe('23%')
    expect(percentPt(RETENCAO_CAT_B_PT.outrosServicos)).toBe('11,5%')
    expect(limiteDispensaRetencaoPt()).toBe(15_000)
  })

  it('eurPt : milliers séparés dès 1 000, centimes seulement s’il y en a', () => {
    const eur = (valor: number) => eurPt(valor).replace(/ /g, ' ')
    expect(eur(950)).toBe('950 €')
    expect(eur(8_342)).toBe('8 342 €')
    expect(eur(15_000)).toBe('15 000 €')
    expect(eur(522.5)).toBe('522,50 €')
    expect(eur(537.13)).toBe('537,13 €')
    expect(eur(29_542.15)).toBe('29 542,15 €')
  })
})
