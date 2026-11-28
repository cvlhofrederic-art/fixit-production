import { describe, it, expect } from 'vitest'
import {
  lireRemise,
  montantRemise,
  montantNetLigne,
  repartirAuProrata,
  appliquerRemiseGlobale,
  remiseHTDepuisTTC,
  baisseTTCRemise,
  convertirRemise,
  remiseEnPourcentageExact,
  lignesApresRemiseGlobale,
  lignesALEchelle,
  remiseALEchelle,
  libelleRemiseGlobale,
  texteRemiseLigne,
  aUneRemiseDeLigne,
  formaterPourcentage,
} from '@/lib/remise-commerciale'
import { escompteImprimeAuDepart } from '@/lib/escompte-pdf'
import { mulMoney, round2 } from '@/lib/money'

const somme = (valeurs: number[]) => round2(valeurs.reduce((s, v) => s + v, 0))

describe('lireRemise', () => {
  it('ignore une remise absente, nulle ou de type inconnu', () => {
    expect(lireRemise(undefined)).toBeNull()
    expect(lireRemise(null)).toBeNull()
    expect(lireRemise({})).toBeNull()
    expect(lireRemise({ type: 'pourcentage', valeur: 0 })).toBeNull()
    expect(lireRemise({ type: 'montant', valeur: 0.004 })).toBeNull()
    expect(lireRemise({ type: 'rabais', valeur: 10 })).toBeNull()
    expect(lireRemise({ type: 'montant', valeur: 'abc' })).toBeNull()
  })

  it('normalise la valeur : positive, % plafonné à 100, euros au centime, virgule acceptée', () => {
    expect(lireRemise({ type: 'pourcentage', valeur: 10 })).toEqual({ type: 'pourcentage', valeur: 10 })
    expect(lireRemise({ type: 'pourcentage', valeur: -10 })).toEqual({ type: 'pourcentage', valeur: 10 })
    expect(lireRemise({ type: 'pourcentage', valeur: 150 })).toEqual({ type: 'pourcentage', valeur: 100 })
    expect(lireRemise({ type: 'pourcentage', valeur: '12,5' })).toEqual({ type: 'pourcentage', valeur: 12.5 })
    expect(lireRemise({ type: 'montant', valeur: 150.456 })).toEqual({ type: 'montant', valeur: 150.46 })
    expect(lireRemise({ type: 'montant', valeur: '1 200,50' })).toEqual({ type: 'montant', valeur: 1200.5 })
  })
})

describe('montantRemise', () => {
  it('pourcentage : arrondi au centime, même signe que la base', () => {
    expect(montantRemise(1000, { type: 'pourcentage', valeur: 10 })).toBe(100)
    expect(montantRemise(1234.56, { type: 'pourcentage', valeur: 10 })).toBe(123.46)
    expect(montantRemise(-1000, { type: 'pourcentage', valeur: 10 })).toBe(-100)
    expect(montantRemise(250, { type: 'pourcentage', valeur: 100 })).toBe(250)
  })

  it('montant : jamais au-delà de la base, signe de la base (avoir)', () => {
    expect(montantRemise(1000, { type: 'montant', valeur: 150 })).toBe(150)
    expect(montantRemise(1000, { type: 'montant', valeur: 2000 })).toBe(1000)
    expect(montantRemise(-500, { type: 'montant', valeur: 150 })).toBe(-150)
  })

  it('rend 0 sans remise ou sur une base nulle', () => {
    expect(montantRemise(1000, null)).toBe(0)
    expect(montantRemise(0, { type: 'pourcentage', valeur: 10 })).toBe(0)
    expect(montantRemise(Number.NaN, { type: 'pourcentage', valeur: 10 })).toBe(0)
  })
})

describe('montantNetLigne', () => {
  it('sans remise : exactement quantité × prix arrondi (documents existants inchangés)', () => {
    for (const [qty, prix] of [[3, 99.99], [5, 381.8181818], [0.5, 12.345], [7, 0]] as const) {
      expect(montantNetLigne(qty, prix)).toBe(mulMoney(qty, prix))
      expect(montantNetLigne(qty, prix, undefined)).toBe(mulMoney(qty, prix))
      expect(montantNetLigne(qty, prix, { type: 'pourcentage', valeur: 0 })).toBe(mulMoney(qty, prix))
    }
  })

  it('déduit la remise de la ligne, en % ou en €', () => {
    expect(montantNetLigne(3, 99.99, { type: 'pourcentage', valeur: 10 })).toBe(269.97)
    expect(montantNetLigne(2, 100, { type: 'montant', valeur: 50 })).toBe(150)
    expect(montantNetLigne(1, 100, { type: 'montant', valeur: 150 })).toBe(0)
    expect(montantNetLigne(-2, 100, { type: 'montant', valeur: 50 })).toBe(-150)
  })
})

describe('repartirAuProrata', () => {
  it('répartit au prorata des bases', () => {
    expect(repartirAuProrata([600, 400], 100)).toEqual([60, 40])
    expect(repartirAuProrata([1000, 500, 500], 200)).toEqual([100, 50, 50])
  })

  it('la somme des parts vaut toujours exactement le montant', () => {
    const cas: Array<[number[], number]> = [
      [[333.33, 333.33, 333.34], 100],
      [[0.01, 0.01, 0.01], 0.02],
      [[1234.56, 789.01, 0.07], 99.99],
      [[5_000_000, 3_000_000.01, 1_999_999.99], 1_234_567.89],
      [[100, -30], 7],
    ]
    for (const [bases, montant] of cas) expect(somme(repartirAuProrata(bases, montant))).toBe(montant)
  })

  it('un avoir (tout négatif) se répartit exactement comme l opposé de sa facture', () => {
    const facture = repartirAuProrata([0.01, 0.01, 0.03], 0.03)
    const avoir = repartirAuProrata([-0.01, -0.01, -0.03], -0.03)
    expect(avoir).toEqual(facture.map((p) => (p === 0 ? 0 : -p)))
  })

  it('rend des zéros sans montant ou sans base', () => {
    expect(repartirAuProrata([100, 200], 0)).toEqual([0, 0])
    expect(repartirAuProrata([0, 0], 50)).toEqual([0, 0])
  })
})

describe('appliquerRemiseGlobale', () => {
  const lignes = [
    { totalHT: 1000, tvaRate: 20 },
    { totalHT: 500, tvaRate: 10 },
  ]

  it('sans remise : simples sommes par taux', () => {
    const r = appliquerRemiseGlobale(lignes, null)
    expect(r.remiseHT).toBe(0)
    expect(r.totalBrutHT).toBe(1500)
    expect(r.totalHT).toBe(1500)
    expect(r.bases).toEqual([{ taux: 10, base: 500 }, { taux: 20, base: 1000 }])
  })

  it('en % : chaque taux est remisé du même pourcentage', () => {
    const r = appliquerRemiseGlobale(lignes, { type: 'pourcentage', valeur: 10 })
    expect(r.remiseHT).toBe(150)
    expect(r.totalHT).toBe(1350)
    expect(r.bases).toEqual([{ taux: 10, base: 450 }, { taux: 20, base: 900 }])
  })

  it('en € : la remise se répartit entre les taux au prorata', () => {
    const r = appliquerRemiseGlobale([{ totalHT: 600, tvaRate: 20 }, { totalHT: 400, tvaRate: 10 }], { type: 'montant', valeur: 100 })
    expect(r.bases).toEqual([{ taux: 10, base: 360 }, { taux: 20, base: 540 }])
    expect(somme(r.bases.map((b) => b.base))).toBe(r.totalHT)
  })

  it('les lignes hors remise (acompte déduit) restent hors de la base de la remise', () => {
    const r = appliquerRemiseGlobale(
      [{ totalHT: 1000, tvaRate: 20 }, { totalHT: -300, tvaRate: 20, horsRemise: true }],
      { type: 'pourcentage', valeur: 10 },
    )
    expect(r.baseRemiseHT).toBe(1000)
    expect(r.remiseHT).toBe(100)
    expect(r.totalBrutHT).toBe(700)
    expect(r.totalHT).toBe(600)
    expect(r.bases).toEqual([{ taux: 20, base: 600 }])
  })

  it('un taux à 0 % prend sa part de la remise', () => {
    const r = appliquerRemiseGlobale([{ totalHT: 800, tvaRate: 20 }, { totalHT: 200, tvaRate: 0 }], { type: 'montant', valeur: 100 })
    expect(r.bases).toEqual([{ taux: 0, base: 180 }, { taux: 20, base: 720 }])
  })
})

describe('remiseHTDepuisTTC', () => {
  it('un seul taux : 120 € TTC à 20 % = 100 € HT', () => {
    expect(remiseHTDepuisTTC([{ totalHT: 1000, tvaRate: 20 }], 120, true)).toBe(100)
  })

  it('plusieurs taux : le TTC baisse du montant saisi', () => {
    const lignes = [{ totalHT: 1000, tvaRate: 20 }, { totalHT: 1000, tvaRate: 10 }]
    expect(remiseHTDepuisTTC(lignes, 230, true)).toBe(200)
  })

  it('le TTC obtenu tombe au centime près sur un cas non rond', () => {
    const lignes = [{ totalHT: 1234.57, tvaRate: 20 }, { totalHT: 987.65, tvaRate: 5.5 }, { totalHT: 333.33, tvaRate: 10 }]
    const ttc = (remise: number) => {
      const r = appliquerRemiseGlobale(lignes, remise ? { type: 'montant', valeur: remise } : null)
      return round2(r.bases.reduce((s, b) => s + b.base + mulMoney(b.base, b.taux / 100), 0))
    }
    const remise = remiseHTDepuisTTC(lignes, 200, true)
    expect(Math.abs(round2(ttc(0) - ttc(remise)) - 200)).toBeLessThanOrEqual(0.01)
  })

  it('sans TVA facturée : le montant est déjà du HT, plafonné à la base', () => {
    expect(remiseHTDepuisTTC([{ totalHT: 500, tvaRate: 20 }], 120, false)).toBe(120)
    expect(remiseHTDepuisTTC([{ totalHT: 500, tvaRate: 20 }], 900, false)).toBe(500)
  })

  it('plafonne à la base remisable', () => {
    expect(remiseHTDepuisTTC([{ totalHT: 100, tvaRate: 20 }], 1000, true)).toBe(100)
  })
})

describe('libellés', () => {
  it('formate les pourcentages à la française', () => {
    expect(formaterPourcentage(5)).toBe('5')
    expect(formaterPourcentage(2.5)).toBe('2,5')
    expect(formaterPourcentage(33.3333)).toBe('33,33')
  })

  it('libellé de la remise globale', () => {
    expect(libelleRemiseGlobale({ type: 'pourcentage', valeur: 5 })).toBe('Remise commerciale (5 %)')
    expect(libelleRemiseGlobale({ type: 'pourcentage', valeur: 2.5 })).toBe('Remise commerciale (2,5 %)')
    expect(libelleRemiseGlobale({ type: 'montant', valeur: 300 })).toBe('Remise commerciale')
    expect(libelleRemiseGlobale({ type: 'pourcentage', valeur: 5 }, 'pt')).toBe('Desconto comercial (5 %)')
  })

  it('texte de la colonne Remise d une ligne', () => {
    const euros = (n: number) => `${n.toFixed(2).replace('.', ',')} €`
    // Trait d'union ASCII : Helvetica (PDF) n'a pas le signe moins Unicode.
    expect(texteRemiseLigne({ type: 'pourcentage', valeur: 10 }, euros)).toBe('-10 %')
    expect(texteRemiseLigne({ type: 'montant', valeur: 150 }, euros)).toBe('-150,00 €')
    expect(texteRemiseLigne(undefined, euros)).toBe('')
  })

  it('pourcentage non rond (avoir, conversion) : libellé sans pourcentage, colonne au montant exact', () => {
    const euros = (n: number) => `${n.toFixed(2).replace('.', ',')} €`
    const exact = { type: 'pourcentage', valeur: 100 * 100 / 1500 }
    expect(libelleRemiseGlobale(exact)).toBe('Remise commerciale')
    expect(texteRemiseLigne(exact, euros, 1500)).toBe('-100,00 €')
    expect(texteRemiseLigne({ type: 'pourcentage', valeur: 12.5 }, euros, 1500)).toBe('-12,5 %')
  })

  it('colonne Remise : montant réellement déduit, jamais plus que la ligne', () => {
    const euros = (n: number) => `${n.toFixed(2).replace('.', ',')} €`
    expect(texteRemiseLigne({ type: 'montant', valeur: 150 }, euros, 100)).toBe('-100,00 €')
    expect(texteRemiseLigne({ type: 'montant', valeur: 150 }, euros, 1000)).toBe('-150,00 €')
    expect(texteRemiseLigne({ type: 'montant', valeur: 150 }, euros, 0)).toBe('')
  })

  it('détecte une remise de ligne', () => {
    expect(aUneRemiseDeLigne([{}, { remise: { type: 'pourcentage', valeur: 5 } }])).toBe(true)
    expect(aUneRemiseDeLigne([{ remise: { type: 'pourcentage', valeur: 0 } }, null])).toBe(false)
    expect(aUneRemiseDeLigne([])).toBe(false)
  })
})

describe('conversions', () => {
  it('convertirRemise : même remise dans l autre unité, sur la même base', () => {
    expect(convertirRemise({ type: 'montant', valeur: 150 }, 'pourcentage', 1000)).toEqual({ type: 'pourcentage', valeur: 15 })
    expect(convertirRemise({ type: 'pourcentage', valeur: 15 }, 'montant', 1000)).toEqual({ type: 'montant', valeur: 150 })
    expect(convertirRemise({ type: 'montant', valeur: 150 }, 'pourcentage', -1000)).toEqual({ type: 'pourcentage', valeur: 15 })
    expect(convertirRemise({ type: 'montant', valeur: 2000 }, 'pourcentage', 1000)).toEqual({ type: 'pourcentage', valeur: 100 })
    // Pourcentage exact, non arrondi : le montant déduit reste le même au centime.
    const tiers = convertirRemise({ type: 'montant', valeur: 100 }, 'pourcentage', 300)
    expect(tiers?.type).toBe('pourcentage')
    expect(montantRemise(300, tiers)).toBe(100)
    const grosse = convertirRemise({ type: 'montant', valeur: 1000 }, 'pourcentage', 48000)
    expect(montantRemise(48000, grosse)).toBe(1000)
    expect(montantRemise(14814.72, convertirRemise({ type: 'montant', valeur: 500 }, 'pourcentage', 14814.72))).toBe(500)
    expect(convertirRemise({ type: 'montant', valeur: 150 }, 'montant', 1000)).toEqual({ type: 'montant', valeur: 150 })
    expect(convertirRemise({ type: 'montant', valeur: 150 }, 'pourcentage', 0)).toEqual({ type: 'pourcentage', valeur: 100 })
    expect(convertirRemise(undefined, 'pourcentage', 1000)).toBeNull()
  })

  it('baisseTTCRemise : effet TTC d une remise HT', () => {
    expect(baisseTTCRemise([{ totalHT: 1000, tvaRate: 20 }], { type: 'montant', valeur: 100 }, true)).toBe(120)
    expect(baisseTTCRemise([{ totalHT: 1000, tvaRate: 20 }, { totalHT: 1000, tvaRate: 10 }], { type: 'pourcentage', valeur: 10 }, true)).toBe(230)
    expect(baisseTTCRemise([{ totalHT: 1000, tvaRate: 20 }], { type: 'montant', valeur: 100 }, false)).toBe(100)
    expect(baisseTTCRemise([{ totalHT: 1000, tvaRate: 20 }], null, true)).toBe(0)
  })

  it('remiseEnPourcentageExact : redonne le même montant au centime, même sur un avoir', () => {
    const exacte = remiseEnPourcentageExact({ type: 'montant', valeur: 200 }, 950)
    expect(exacte?.type).toBe('pourcentage')
    expect(montantRemise(950, exacte)).toBe(200)
    expect(montantRemise(-950, exacte)).toBe(-200)
    expect(remiseEnPourcentageExact({ type: 'pourcentage', valeur: 5 }, 950)).toEqual({ type: 'pourcentage', valeur: 5 })
    expect(remiseEnPourcentageExact({ type: 'montant', valeur: 200 }, 0)).toEqual({ type: 'montant', valeur: 200 })
    for (const [montant, base] of [[123.45, 987.65], [0.01, 3], [333.33, 999.99], [1, 7]] as const) {
      expect(montantRemise(base, remiseEnPourcentageExact({ type: 'montant', valeur: montant }, base))).toBe(montant)
    }
  })

  it('lignesApresRemiseGlobale : chaque ligne ramenée au prix facturé', () => {
    const lignes = [{ totalHT: 900, priceHT: 900, description: 'A' }, { totalHT: 500, priceHT: 250, description: 'B' }]
    expect(lignesApresRemiseGlobale(lignes, 140, 1400)).toEqual([
      { totalHT: 810, priceHT: 810, description: 'A' },
      { totalHT: 450, priceHT: 225, description: 'B' },
    ])
    expect(lignesApresRemiseGlobale(lignes, 0, 1400)).toBe(lignes)
  })

  it('lignesApresRemiseGlobale : une ligne remisée prend son prix réellement facturé', () => {
    // 100 m² à 30 € remisés de 40 % : 1 800 €, soit 18 €/m² facturés (le prix saisi reste 30 €).
    const peinture = { qty: 100, priceHT: 30, totalHT: 1800, remise: { type: 'pourcentage' as const, valeur: 40 } }
    const pose = { qty: 2, priceHT: 100, totalHT: 200 }
    expect(lignesApresRemiseGlobale([peinture, pose], 0, 2000)).toEqual([{ ...peinture, priceHT: 18 }, pose])
    // Plus une remise globale de 10 % : 1 620 € soit 16,20 €/m², la ligne sans remise suit la proportion.
    expect(lignesApresRemiseGlobale([peinture, pose], 200, 2000)).toEqual([
      { ...peinture, totalHT: 1620, priceHT: 16.2 },
      { ...pose, totalHT: 180, priceHT: 90 },
    ])
  })
})

describe('escompteImprimeAuDepart (escompte du PDF artisan)', () => {
  it('document nouveau, duplicata ou déjà marqué : escompte imprimé', () => {
    expect(escompteImprimeAuDepart(undefined)).toBe(true)
    expect(escompteImprimeAuDepart({})).toBe(true)
    expect(escompteImprimeAuDepart({ id: undefined, escompteSurPdf: undefined })).toBe(true)
    expect(escompteImprimeAuDepart({ id: '1779539827817', isDuplicate: true })).toBe(true)
    expect(escompteImprimeAuDepart({ id: '6f1c2a34-0000-4000-8000-000000000001', escompteSurPdf: true })).toBe(true)
  })

  it('marque explicite d abord : un avoir ou un acompte reprend celle de son parent', () => {
    expect(escompteImprimeAuDepart({ escompteSurPdf: false })).toBe(false)
    expect(escompteImprimeAuDepart({ id: '6f1c2a34-0000-4000-8000-000000000001', escompteSurPdf: true })).toBe(true)
  })

  it('ancien document sans identifiant (brouillon hérité) : reconnu par son horodatage ou son numéro', () => {
    expect(escompteImprimeAuDepart({ id: '', savedAt: '2026-05-02T10:00:00.000Z' })).toBe(false)
    expect(escompteImprimeAuDepart({ id: null, docNumber: 'FACT-2026-014' })).toBe(false)
    expect(escompteImprimeAuDepart({ id: '', docNumber: 'BR-2026-004' })).toBe(true)
  })

  it('document antérieur rouvert : PDF inchangé (« Aucun escompte accordé »)', () => {
    expect(escompteImprimeAuDepart({ id: '6f1c2a34-0000-4000-8000-000000000001' })).toBe(false)
    expect(escompteImprimeAuDepart({ id: '6f1c2a34-0000-4000-8000-000000000001', isDuplicate: false })).toBe(false)
  })
})

describe('mode « Acompte » du formulaire BTP (mise à l échelle)', () => {
  it('remise en euros à l échelle, remise en % inchangée', () => {
    expect(remiseALEchelle({ type: 'montant', valeur: 100 }, 0.3)).toEqual({ type: 'montant', valeur: 30 })
    expect(remiseALEchelle({ type: 'pourcentage', valeur: 10 }, 0.3)).toEqual({ type: 'pourcentage', valeur: 10 })
    expect(remiseALEchelle(undefined, 0.3)).toBeUndefined()
  })

  it('ligne remisée : total à l échelle égal au total recalculé (affiché)', () => {
    const [l] = lignesALEchelle([{ qty: 2, priceHT: 1000, totalHT: 1900, remise: { type: 'montant', valeur: 100 } }], 0.3)
    expect(l).toEqual({ qty: 2, priceHT: 300, totalHT: 570, remise: { type: 'montant', valeur: 30 } })
    expect(montantNetLigne(l.qty, l.priceHT, l.remise)).toBe(l.totalHT)
  })

  it('ligne sans remise : comportement d origine (prix et total multipliés, arrondis)', () => {
    expect(lignesALEchelle([{ qty: 3, priceHT: 33.335, totalHT: 100.01 }], 0.5)).toEqual([{ qty: 3, priceHT: 16.67, totalHT: 50.01 }])
  })
})
