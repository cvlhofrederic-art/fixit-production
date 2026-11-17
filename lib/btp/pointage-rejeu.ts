// Pointage BTP « téléphone en poche » : rejeu d'une journée d'envois du téléphone (17/11/2026).
//
// Le module Android livre ses envois dans le désordre (un travail WorkManager indépendant par envoi, regroupés par la
// mise en veille ou le manque de réseau), parfois deux fois (réponse perdue, nouvel essai), et donne la même heure aux
// zones franchies par une même position. Les envois sont donc gardés dans un journal (pointage_evenements_btp : un
// envoi par téléphone, chantier, sens et heure de détection) et chaque réception rejoue la journée entière dans l'ordre
// des heures de détection : le résultat ne dépend ni de l'ordre ni du nombre de réceptions.
//
// Règles du rejeu :
// - le téléphone est « dans » un ensemble de zones ; une seule compte à la fois, celle où il est entré le premier ;
//   quand il en sort, la plus ancienne des zones où il est encore prend le relais, à l'heure de cette sortie (chantiers
//   voisins dont les zones se chevauchent : aucune heure comptée deux fois) ;
// - une arrivée dans une zone où il est déjà (doublon, zone reposée par le système) et une sortie d'une zone où il
//   n'est pas entré ne changent rien ;
// - les pointages qui ne viennent pas du téléphone (à la main, page ouverte, ou modifiés depuis par quelqu'un) priment :
//   sur un autre chantier, leur durée est retirée de la présence ; sur le même chantier, la présence continue du
//   téléphone à partir de leur début ne compte plus, jusqu'à ce qu'il sorte de la zone (fin à la main sur place, puis
//   zones reposées par le système : pas de nouveau pointage) ;
// - une présence close de moins de 3 min (passage, voiture, zones voisines quittées coup sur coup) ne compte pas.
//
// Règles pures (ni réseau ni base) ; la route des événements lit le journal et écrit le résultat.
// Tests : tests/lib/btp-pointage-rejeu.test.ts.

import { PASSAGE_BREF_MS } from '@/lib/btp/pointage-arriere-plan'
import { heureLocale } from '@/lib/btp/pointage-regles'

/** Envoi du téléphone gardé au journal. */
export interface EnvoiJournal {
  chantier: string
  /** Nom du chantier à la réception (il peut changer ou ne plus être affecté ensuite). */
  nom?: string | null
  sens: 'enter' | 'exit'
  /** Heure de détection par le téléphone. */
  detecte: number
  /** Heure de réception par le serveur. */
  recu: number
}

/** Pointage qui ne vient pas du téléphone (à la main, page ouverte) ou modifié depuis par quelqu'un : il prime. */
export interface PlageAutre {
  chantier: string
  debut: number
  /** null : encore ouvert. */
  fin: number | null
}

/** Présence déduite des envois : sur ce chantier de `debut` à `fin` (null : toujours sur place). */
export interface Presence {
  chantier: string
  debut: number
  fin: number | null
  /** Envoi d'arrivée dans cette zone (heure de réception : note d'arrivée reçue tard). */
  arrivee: EnvoiJournal
}

/** Ordre du rejeu : heure de détection, sortie avant arrivée à la même heure, puis chantier (ordre stable). */
export function ordreRejeu(a: EnvoiJournal, b: EnvoiJournal): number {
  if (a.detecte !== b.detecte) return a.detecte - b.detecte
  if (a.sens !== b.sens) return a.sens === 'exit' ? -1 : 1
  return a.chantier.localeCompare(b.chantier)
}

/** Présences brutes, envois rejoués dans l'ordre de détection. */
export function presencesBrutes(envois: readonly EnvoiJournal[]): Presence[] {
  const dedans = new Map<string, EnvoiJournal>()
  let ouverte: Presence | null = null
  const presences: Presence[] = []
  for (const envoi of [...envois].sort(ordreRejeu)) {
    if (envoi.sens === 'enter') {
      if (dedans.has(envoi.chantier)) continue
      dedans.set(envoi.chantier, envoi)
      ouverte ??= { chantier: envoi.chantier, debut: envoi.detecte, fin: null, arrivee: envoi }
      continue
    }
    const quittee = dedans.delete(envoi.chantier)
    // Sortie d'une zone où il n'était pas, ou d'une zone voisine qui ne comptait pas : rien ne change.
    if (!quittee || ouverte === null || ouverte.chantier !== envoi.chantier) continue
    presences.push({ ...ouverte, fin: envoi.detecte })
    const [suivante] = [...dedans.values()].sort(ordreRejeu)
    ouverte = suivante ? { chantier: suivante.chantier, debut: envoi.detecte, fin: null, arrivee: suivante } : null
  }
  if (ouverte) presences.push(ouverte)
  return presences
}

function morceau(presence: Presence, debut: number, fin: number): Presence[] {
  if (fin <= debut) return []
  return [{ ...presence, debut, fin: fin === Number.POSITIVE_INFINITY ? null : fin }]
}

/** Ce qui reste d'une présence une fois retiré ce que couvre un pointage qui ne vient pas du téléphone. */
export function retirerAutre(presence: Presence, autre: PlageAutre): Presence[] {
  const finPresence = presence.fin ?? Number.POSITIVE_INFINITY
  const finAutre = autre.fin ?? Number.POSITIVE_INFINITY
  if (autre.chantier === presence.chantier) {
    // Même chantier : seul ce qui précède le début du pointage de l'employé reste (jusqu'à une nouvelle arrivée).
    const touche = autre.debut < finPresence && finAutre >= presence.debut
    return touche ? morceau(presence, presence.debut, Math.min(finPresence, autre.debut)) : [presence]
  }
  // Autre chantier : sa durée est retirée ; un pointage sans durée (départ oublié refermé sans heures) ne coupe rien.
  if (finAutre <= autre.debut || autre.debut >= finPresence || finAutre <= presence.debut) return [presence]
  return [...morceau(presence, presence.debut, autre.debut), ...morceau(presence, finAutre, finPresence)]
}

/** Présences retenues pour une journée : rejeu, pointages qui ne viennent pas du téléphone retirés, passages écartés. */
export function rejouerJournee(envois: readonly EnvoiJournal[], autres: readonly PlageAutre[]): Presence[] {
  let presences = presencesBrutes(envois)
  for (const autre of autres) presences = presences.flatMap(p => retirerAutre(p, autre))
  return presences
    .filter(p => p.fin === null || p.fin - p.debut >= PASSAGE_BREF_MS)
    .sort((a, b) => a.debut - b.debut)
}

/** Instant d'une date et d'une heure murales (AAAA-MM-JJ, HH:MM[:SS]) dans un fuseau ; NaN si illisibles. */
export function instantMural(date: string, heure: string, fuseau: string): number {
  const secondes = /^\d{2}:\d{2}:\d{2}/.test(heure) ? heure.slice(0, 8) : `${heure.slice(0, 5)}:00`
  const naif = Date.parse(`${date}T${secondes}Z`)
  if (!Number.isFinite(naif)) return Number.NaN
  const decalage = (instant: number) => {
    const local = heureLocale(instant, fuseau)
    return Date.parse(`${local.date}T${local.heure}Z`) - instant
  }
  // Deux passes : le décalage dépend de l'instant (heure d'été).
  return naif - decalage(naif - decalage(naif))
}

/** Champs d'un pointage écrits par le téléphone : comparés pour savoir si quelqu'un l'a modifié depuis. */
export const CHAMPS_ECRITS = ['chantier_id', 'date', 'heure_arrivee', 'heure_depart', 'heures_travaillees', 'notes', 'created_at'] as const

function forme(champ: (typeof CHAMPS_ECRITS)[number], valeur: unknown): string {
  if (valeur === null || valeur === undefined) return ''
  if (champ === 'created_at') return String(Date.parse(String(valeur)))
  if (champ === 'heures_travaillees') return String(Number(valeur))
  if (champ === 'heure_arrivee' || champ === 'heure_depart') return String(valeur).slice(0, 8)
  return String(valeur)
}

/** Le pointage porte-t-il encore ce que le téléphone y a écrit (formats de la base mis de côté) ? */
export function memeContenu(ligne: Record<string, unknown>, ecrit: Record<string, unknown>): boolean {
  return CHAMPS_ECRITS.every(champ => forme(champ, ligne[champ]) === forme(champ, ecrit[champ]))
}

/** Ce que le téléphone écrit (ou trouve) dans un pointage, gardé pour savoir ensuite si quelqu'un l'a modifié. */
export function ecritDe(champs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(CHAMPS_ECRITS.map(champ => [champ, champs[champ] ?? null]))
}
