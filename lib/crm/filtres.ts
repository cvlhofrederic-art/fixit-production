// ── CRM du secrétariat : onglets, recherche et ordre de la liste ────────────
// Module pur (écran /admin/crm). La recherche ignore la casse et les accents ; des chiffres cherchent aussi le numéro.

import { STATUTS_CRM, type DemandeCrm, type StatutCrm } from './types'

export type FiltreStatutCrm = StatutCrm | 'toutes'

function sansAccents(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function correspond(demande: DemandeCrm, recherche: string): boolean {
  const q = sansAccents(recherche.trim())
  if (q === '') return true
  const texte = sansAccents([demande.titre, demande.description, demande.contact?.nom ?? '', String(demande.numero)].join(' '))
  if (texte.includes(q)) return true
  const chiffres = q.replace(/\D/g, '')
  return chiffres.length >= 3 && (demande.contact?.telephone ?? '').includes(chiffres)
}

/** Urgentes d'abord, puis les plus récentes. */
function comparer(a: DemandeCrm, b: DemandeCrm): number {
  const urgence = Number(b.priorite === 'urgente') - Number(a.priorite === 'urgente')
  if (urgence !== 0) return urgence
  return b.created_at.localeCompare(a.created_at)
}

export function filtrerDemandes(demandes: readonly DemandeCrm[], filtre: FiltreStatutCrm, recherche: string): DemandeCrm[] {
  return demandes.filter((d) => (filtre === 'toutes' || d.statut === filtre) && correspond(d, recherche)).toSorted(comparer)
}

/** Nombre de demandes par onglet, recherche appliquée. */
export function compterParStatut(demandes: readonly DemandeCrm[], recherche: string): Record<FiltreStatutCrm, number> {
  const nombres = Object.fromEntries([...STATUTS_CRM, 'toutes'].map((s) => [s, 0])) as Record<FiltreStatutCrm, number>
  for (const d of demandes) {
    if (!correspond(d, recherche)) continue
    nombres[d.statut]++
    nombres.toutes++
  }
  return nombres
}
