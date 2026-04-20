import type { RefTaux, Juridiction, FormeJuridique } from './types'
import { getTaux } from './ref-taux'
import type { TauxApplique } from './types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Input shapes ──

export interface CalcChargesSocialesInput {
  allTaux: RefTaux[]
  juridiction: Juridiction
  formeJuridique: FormeJuridique
  ca: number
  masseSalariale: number
  beneficeBrut: number
  date: Date
}

export interface CalcChargesFiscalesInput {
  allTaux: RefTaux[]
  juridiction: Juridiction
  formeJuridique: FormeJuridique
  beneficeAvantImpot: number
  date: Date
}

export interface ChargesResult {
  montant: number
  taux_appliques: TauxApplique[]
}

// ── Social Charges ──

export function calculeChargesSociales(input: CalcChargesSocialesInput): ChargesResult {
  const { allTaux, juridiction, formeJuridique, ca, masseSalariale, beneficeBrut, date } = input
  const taux_appliques: TauxApplique[] = []

  // FR forms — cotisations on CA
  if (
    formeJuridique === 'auto_entrepreneur' ||
    formeJuridique === 'micro_bic' ||
    formeJuridique === 'micro_bnc'
  ) {
    const entry = getTaux(allTaux, 'FR', 'cotisations_sociales', formeJuridique, date)
    if (!entry) return { montant: 0, taux_appliques }
    taux_appliques.push({ type: 'cotisations_sociales', taux: entry.taux, source: entry.source_reglementaire })
    return { montant: round2((entry.taux / 100) * ca), taux_appliques }
  }

  // EI — SSI on bénéfice brut
  if (formeJuridique === 'ei') {
    const entry = getTaux(allTaux, 'FR', 'cotisations_sociales', 'ei', date)
    if (!entry) return { montant: 0, taux_appliques }
    taux_appliques.push({ type: 'cotisations_sociales', taux: entry.taux, source: entry.source_reglementaire })
    return { montant: round2((entry.taux / 100) * beneficeBrut), taux_appliques }
  }

  // FR corporate forms — charges patronales on masse salariale
  if (
    formeJuridique === 'eurl_is' ||
    formeJuridique === 'eurl_ir' ||
    formeJuridique === 'sarl' ||
    formeJuridique === 'sasu' ||
    formeJuridique === 'sas' ||
    formeJuridique === 'sa_fr'
  ) {
    const entry = getTaux(allTaux, 'FR', 'charges_patronales', formeJuridique, date)
    if (!entry) return { montant: 0, taux_appliques }
    taux_appliques.push({ type: 'charges_patronales', taux: entry.taux, source: entry.source_reglementaire })
    return { montant: round2((entry.taux / 100) * masseSalariale), taux_appliques }
  }

  // PT — trabalhador independente: 21.4% on 70% of CA
  if (formeJuridique === 'trabalhador_independente') {
    const entryTaux = getTaux(allTaux, 'PT', 'cotisations_sociales', 'trabalhador_independente', date)
    const entryBase = getTaux(allTaux, 'PT', 'base_incidence', 'trabalhador_independente', date)
    if (!entryTaux) return { montant: 0, taux_appliques }
    const basePct = entryBase ? entryBase.taux / 100 : 0.7
    const base = ca * basePct
    taux_appliques.push({ type: 'cotisations_sociales', taux: entryTaux.taux, source: entryTaux.source_reglementaire })
    return { montant: round2((entryTaux.taux / 100) * base), taux_appliques }
  }

  // PT — ENI: 21.4% on full CA
  if (formeJuridique === 'eni') {
    const entry = getTaux(allTaux, 'PT', 'cotisations_sociales', 'eni', date)
    if (!entry) return { montant: 0, taux_appliques }
    taux_appliques.push({ type: 'cotisations_sociales', taux: entry.taux, source: entry.source_reglementaire })
    return { montant: round2((entry.taux / 100) * ca), taux_appliques }
  }

  // PT corporate: TSU patronal + FCT on masse salariale
  if (
    formeJuridique === 'unipessoal_lda' ||
    formeJuridique === 'lda' ||
    formeJuridique === 'sa_pt'
  ) {
    const entryTSU = getTaux(allTaux, 'PT', 'tsu_patronal', formeJuridique, date)
    const entryFCT = getTaux(allTaux, 'PT', 'fct', formeJuridique, date)
    let montant = 0
    if (entryTSU) {
      taux_appliques.push({ type: 'tsu_patronal', taux: entryTSU.taux, source: entryTSU.source_reglementaire })
      montant += (entryTSU.taux / 100) * masseSalariale
    }
    if (entryFCT) {
      taux_appliques.push({ type: 'fct', taux: entryFCT.taux, source: entryFCT.source_reglementaire })
      montant += (entryFCT.taux / 100) * masseSalariale
    }
    return { montant: round2(montant), taux_appliques }
  }

  return { montant: 0, taux_appliques }
}

// ── Fiscal Charges ──

// Forms not subject to corporate tax (IS/IRC)
const FORMES_SANS_IS = new Set<FormeJuridique>([
  'auto_entrepreneur', 'micro_bic', 'micro_bnc', 'ei', 'eurl_ir',
  'eni', 'trabalhador_independente',
])

function calculeISFR(allTaux: RefTaux[], benefice: number, date: Date): ChargesResult {
  const taux_appliques: TauxApplique[] = []
  if (benefice <= 0) return { montant: 0, taux_appliques }

  const tranches = allTaux.filter(
    (t) => t.juridiction === 'FR' && t.type_charge === 'is_seuil_pme' && t.regime === 'all',
  )
  let is = 0
  for (const tranche of tranches) {
    const min = tranche.seuil_min ?? 0
    const max = tranche.seuil_max ?? Infinity
    if (benefice <= min) continue
    const base = Math.min(benefice, max) - min
    if (base <= 0) continue
    const contribution = (tranche.taux / 100) * base
    is += contribution
    taux_appliques.push({ type: `is_${tranche.taux}pct`, taux: tranche.taux, source: tranche.source_reglementaire })
  }
  return { montant: round2(is), taux_appliques }
}

function calculeIRCPT(allTaux: RefTaux[], benefice: number, date: Date): ChargesResult {
  const taux_appliques: TauxApplique[] = []
  if (benefice <= 0) return { montant: 0, taux_appliques }

  const tranches = allTaux.filter(
    (t) => t.juridiction === 'PT' && t.type_charge === 'irc_seuil_pme' && t.regime === 'all',
  )
  let irc = 0
  for (const tranche of tranches) {
    const min = tranche.seuil_min ?? 0
    const max = tranche.seuil_max ?? Infinity
    if (benefice <= min) continue
    const base = Math.min(benefice, max) - min
    if (base <= 0) continue
    const contribution = (tranche.taux / 100) * base
    irc += contribution
    taux_appliques.push({ type: `irc_${tranche.taux}pct`, taux: tranche.taux, source: tranche.source_reglementaire })
  }

  const derrama = getTaux(allTaux, 'PT', 'derrama_municipal', 'all', date)
  let derramaMontant = 0
  if (derrama) {
    derramaMontant = (derrama.taux / 100) * irc
    taux_appliques.push({ type: 'derrama_municipal', taux: derrama.taux, source: derrama.source_reglementaire })
  }

  return { montant: round2(irc + derramaMontant), taux_appliques }
}

export function calculeChargesFiscales(input: CalcChargesFiscalesInput): ChargesResult {
  const { allTaux, juridiction, formeJuridique, beneficeAvantImpot, date } = input

  if (FORMES_SANS_IS.has(formeJuridique)) {
    return { montant: 0, taux_appliques: [] }
  }

  if (juridiction === 'FR') {
    return calculeISFR(allTaux, beneficeAvantImpot, date)
  }

  if (juridiction === 'PT') {
    return calculeIRCPT(allTaux, beneficeAvantImpot, date)
  }

  return { montant: 0, taux_appliques: [] }
}
