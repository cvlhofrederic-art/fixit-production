// lib/prix-travaux-2026/aides/index.ts

import type { AidesEligibles } from '../types'
import { detectMprBareme, getMprForfait } from './maprimerenov'
import { computeCee } from './cee'
import { getTvaApplicable, computeTvaEconomie } from './tva'
import { ecoPTZEligible } from './eco-ptz'

export * from './maprimerenov'
export * from './cee'
export * from './tva'
export * from './eco-ptz'

export type AidesContexte = {
  foyerTaille: number
  revenusFiscaux: number
  region: 'idf' | 'province'
  logementAge: number
}

export type AidesResult = {
  maPrimeRenov: number
  cee: number
  tvaEconomie: number
  ecoPTZ: { eligible: boolean; montantMax?: number }
  total: number
  conditions?: string[]
}

export type ComputeAidesArgs = {
  eligibles: AidesEligibles | undefined
  prixHT: number
  contexte: AidesContexte
}

export function computeAides(args: ComputeAidesArgs): AidesResult {
  const { eligibles, prixHT, contexte } = args
  if (!eligibles) {
    return { maPrimeRenov: 0, cee: 0, tvaEconomie: 0, ecoPTZ: { eligible: false }, total: 0 }
  }

  let mpr = 0
  if (eligibles.maPrimeRenov) {
    const bareme = eligibles.maPrimeRenov.bareme
      ?? detectMprBareme({
        foyerTaille: contexte.foyerTaille,
        revenusFiscaux: contexte.revenusFiscaux,
        region: contexte.region,
      })
    mpr = getMprForfait(eligibles.maPrimeRenov.forfaits, bareme)
    if (eligibles.maPrimeRenov.plafondTravaux) {
      mpr = Math.min(mpr, eligibles.maPrimeRenov.plafondTravaux)
    }
  }

  const cee = eligibles.cee ? computeCee(eligibles.cee) : 0

  const tvaEconomie = eligibles.tvaReduite
    ? computeTvaEconomie(prixHT, eligibles.tvaReduite)
    : 0

  const ecoPTZ = ecoPTZEligible(eligibles.ecoPTZ)

  return {
    maPrimeRenov: mpr,
    cee,
    tvaEconomie,
    ecoPTZ,
    total: mpr + cee + tvaEconomie,
  }
}
