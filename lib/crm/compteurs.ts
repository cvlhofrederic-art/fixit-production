// ── CRM du secrétariat : compteurs de l'écran d'accueil ─────────────────────
// Module pur : l'heure courante et le fuseau sont passés en paramètre (tests sans horloge simulée).
//
//   À traiter aujourd'hui : demandes ouvertes (non résolues) sans rappel, ou dont le rappel tombe aujourd'hui ou avant ;
//   En retard            : demandes ouvertes dont le rappel est passé ;
//   Résolues cette semaine : résolues depuis 7 jours (fenêtre glissante).
// « Aujourd'hui » se lit dans le fuseau de l'équipe (Europe/Lisbon par défaut : les clients et le secrétariat sont au
// Portugal), pas dans celui du serveur (UTC sur Cloudflare).

import type { CompteursCrm, StatutCrm } from './types'

export const FUSEAU_CRM = 'Europe/Lisbon'
const SEPT_JOURS_MS = 7 * 24 * 60 * 60 * 1000

interface DemandePourCompteurs {
  statut: StatutCrm
  rappel_le: string | null
  resolue_le: string | null
}

/**
 * Date civile (AAAA-MM-JJ) d'un instant dans un fuseau. Assemblée depuis formatToParts : le format d'une locale
 * (en-CA…) dépend des données ICU de l'environnement, pas les parties numériques.
 */
export function dateCivile(instant: Date, fuseau: string = FUSEAU_CRM): string {
  const parties = new Intl.DateTimeFormat('en-US', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant)
  const partie = (type: Intl.DateTimeFormatPartTypes) => parties.find((p) => p.type === type)?.value ?? ''
  return `${partie('year')}-${partie('month')}-${partie('day')}`
}

export function estOuverte(d: { statut: StatutCrm }): boolean {
  return d.statut !== 'resolue'
}

/** Rappel passé sur une demande ouverte. */
export function estEnRetard(d: DemandePourCompteurs, maintenant: Date): boolean {
  if (!estOuverte(d) || !d.rappel_le) return false
  const rappel = Date.parse(d.rappel_le)
  return Number.isFinite(rappel) && rappel < maintenant.getTime()
}

/** Demande ouverte à traiter aujourd'hui : sans rappel, ou rappel du jour (ou passé). */
export function estATraiterAujourdhui(d: DemandePourCompteurs, maintenant: Date, fuseau: string = FUSEAU_CRM): boolean {
  if (!estOuverte(d)) return false
  if (!d.rappel_le) return true
  const rappel = new Date(d.rappel_le)
  if (!Number.isFinite(rappel.getTime())) return true
  return dateCivile(rappel, fuseau) <= dateCivile(maintenant, fuseau)
}

export function calculerCompteurs(demandes: readonly DemandePourCompteurs[], maintenant: Date, fuseau: string = FUSEAU_CRM): CompteursCrm {
  const depuis = maintenant.getTime() - SEPT_JOURS_MS
  let aTraiterAujourdhui = 0
  let enRetard = 0
  let resoluesSemaine = 0
  for (const d of demandes) {
    if (estATraiterAujourdhui(d, maintenant, fuseau)) aTraiterAujourdhui++
    if (estEnRetard(d, maintenant)) enRetard++
    if (d.statut === 'resolue' && d.resolue_le) {
      const resolue = Date.parse(d.resolue_le)
      if (Number.isFinite(resolue) && resolue >= depuis) resoluesSemaine++
    }
  }
  return { aTraiterAujourdhui, enRetard, resoluesSemaine }
}
