/**
 * Jours fériés nationaux d'une obra (décision « méthode pro » de Frédéric du 28/11/2026) : un jour férié n'est pas
 * travaillé par l'équipe habituelle ; il reste modifiable jour par jour (« Equipa por dia ») pour une obra qui tourne
 * quand même. Les fériés municipaux (un par concelho au Portugal) ne sont pas connus : ils se retouchent à la main.
 *
 * Portugal — Código do Trabalho, art. 234.º, n.º 1 (fériés obligatoires, rétablis en 2016) : 1 janvier, Vendredi
 * saint, dimanche de Pâques, 25 avril, 1 mai, Corpo de Deus (jeudi, Pâques + 60), 10 juin, 15 août, 5 octobre,
 * 1 novembre, 1 décembre, 8 décembre, 25 décembre. Le Carnaval est facultatif (art. 235.º) : non compté.
 * France — Code du travail, art. L3133-1 : 1 janvier, lundi de Pâques, 1 mai, 8 mai, Ascension (Pâques + 39), lundi de
 * Pentecôte (Pâques + 50), 14 juillet, 15 août, 1 novembre, 11 novembre, 25 décembre. Les fériés propres à
 * l'Alsace-Moselle et aux outre-mer ne sont pas comptés.
 *
 * Module pur ; jours « AAAA-MM-JJ » calculés en UTC, comme lib/btp/equipe-par-jour.ts.
 */

import { estJourOuvre, jourValide } from '@/lib/btp/equipe-par-jour'

export type PaysObra = 'PT' | 'FR'

const versJour = (date: Date) => date.toISOString().slice(0, 10)

/** Dimanche de Pâques (calendrier grégorien, algorithme de Meeus/Jones/Butcher). */
export function paques(annee: number): string {
  const a = annee % 19
  const b = Math.floor(annee / 100)
  const c = annee % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mois = Math.floor((h + l - 7 * m + 114) / 31)
  const jour = ((h + l - 7 * m + 114) % 31) + 1
  return versJour(new Date(Date.UTC(annee, mois - 1, jour)))
}

const decaler = (jour: string, nb: number) => versJour(new Date(Date.parse(`${jour}T00:00:00Z`) + nb * 86_400_000))

const FIXES: Record<PaysObra, Record<string, { pt: string; fr: string }>> = {
  PT: {
    '01-01': { pt: 'Ano Novo', fr: 'Jour de l’an' },
    '04-25': { pt: 'Dia da Liberdade', fr: 'Jour de la Liberté' },
    '05-01': { pt: 'Dia do Trabalhador', fr: 'Fête du travail' },
    '06-10': { pt: 'Dia de Portugal', fr: 'Jour du Portugal' },
    '08-15': { pt: 'Assunção', fr: 'Assomption' },
    '10-05': { pt: 'Implantação da República', fr: 'Proclamation de la République' },
    '11-01': { pt: 'Todos os Santos', fr: 'Toussaint' },
    '12-01': { pt: 'Restauração da Independência', fr: 'Restauration de l’indépendance' },
    '12-08': { pt: 'Imaculada Conceição', fr: 'Immaculée Conception' },
    '12-25': { pt: 'Natal', fr: 'Noël' },
  },
  FR: {
    '01-01': { pt: 'Ano Novo', fr: 'Jour de l’an' },
    '05-01': { pt: 'Dia do Trabalhador', fr: 'Fête du travail' },
    '05-08': { pt: 'Vitória de 1945', fr: 'Victoire 1945' },
    '07-14': { pt: 'Festa Nacional', fr: 'Fête nationale' },
    '08-15': { pt: 'Assunção', fr: 'Assomption' },
    '11-01': { pt: 'Todos os Santos', fr: 'Toussaint' },
    '11-11': { pt: 'Armistício', fr: 'Armistice' },
    '12-25': { pt: 'Natal', fr: 'Noël' },
  },
}

/** Fériés mobiles, en jours après Pâques. */
const MOBILES: Record<PaysObra, Array<{ ecart: number; pt: string; fr: string }>> = {
  PT: [
    { ecart: -2, pt: 'Sexta-feira Santa', fr: 'Vendredi saint' },
    { ecart: 0, pt: 'Páscoa', fr: 'Pâques' },
    { ecart: 60, pt: 'Corpo de Deus', fr: 'Fête-Dieu' },
  ],
  FR: [
    { ecart: 1, pt: 'Segunda-feira de Páscoa', fr: 'Lundi de Pâques' },
    { ecart: 39, pt: 'Ascensão', fr: 'Ascension' },
    { ecart: 50, pt: 'Segunda-feira de Pentecostes', fr: 'Lundi de Pentecôte' },
  ],
}

/**
 * Fériés d'une année pour un pays, calculés une fois : tout l'écran se recalcule à chaque frappe dans la fiche, et
 * chaque jour de chaque obra passe par ici (relecture adverse du 28/11/2026 : 9 µs par appel sans cache).
 */
const cacheAnnees = new Map<string, Map<string, { pt: string; fr: string }>>()
function feriesDeLAnnee(annee: number, pays: PaysObra): Map<string, { pt: string; fr: string }> {
  const cle = `${pays}-${annee}`
  const deja = cacheAnnees.get(cle)
  if (deja) return deja
  const feries = new Map<string, { pt: string; fr: string }>()
  for (const [moisJour, nom] of Object.entries(FIXES[pays])) feries.set(`${annee}-${moisJour}`, nom)
  const pasques = paques(annee)
  for (const m of MOBILES[pays]) feries.set(decaler(pasques, m.ecart), { pt: m.pt, fr: m.fr })
  cacheAnnees.set(cle, feries)
  return feries
}

/** Nom du jour férié national (dans la langue de l'écran), ou null pour un jour ordinaire (ou invalide). */
export function nomFerie(jour: string, pays: PaysObra, isPt: boolean): string | null {
  if (!jourValide(jour)) return null
  const nom = feriesDeLAnnee(Number(jour.slice(0, 4)), pays).get(jour)
  if (!nom) return null
  return isPt ? nom.pt : nom.fr
}

/** Jour férié national de ce pays. */
export function estFerie(jour: string, pays: PaysObra): boolean {
  return nomFerie(jour, pays, false) !== null
}

/**
 * Pays d'une obra d'après son code postal : quatre chiffres (« 4050-262 », « 4050 262 », « 4050262 », « 4050 »,
 * « 4050-262 Porto ») pour le Portugal, cinq (« 13008 », « 13 008 ») pour la France ; null s'il ne le dit pas.
 */
export function paysDuCodePostal(codePostal: unknown): PaysObra | null {
  const brut = typeof codePostal === 'number' ? String(codePostal) : codePostal
  const cp = typeof brut === 'string' ? brut.trim() : ''
  if (/^\d{4}(?:[-\s]?\d{3})?(?!\d)/.test(cp) && !/^\d{2}\s?\d{3}(?!\d)/.test(cp)) return 'PT'
  if (/^\d{2}\s?\d{3}(?!\d)/.test(cp)) return 'FR'
  return null
}

/**
 * Pays de la société quand le code postal de l'obra ne dit rien : celui de la langue de l'écran (cookie « locale »,
 * le même signal que les réglages BTP par défaut, lib/hooks/use-btp-data.ts). L'écran et la route (qui fige le passé
 * pour l'onglet Affectations) appliquent ainsi le même calendrier.
 */
export function paysDeLaLangue(locale: unknown): PaysObra | null {
  if (locale === 'pt') return 'PT'
  if (locale === 'fr') return 'FR'
  return null
}

/**
 * Jours travaillés par l'équipe habituelle : du lundi au vendredi, hors fériés nationaux du pays. Pays inconnu (ni code
 * postal ni langue) : hors fériés des deux pays.
 */
export function jourOuvreDans(pays: PaysObra | null): (jour: string) => boolean {
  if (pays) return jour => estJourOuvre(jour) && !estFerie(jour, pays)
  return jour => estJourOuvre(jour) && !estFerie(jour, 'PT') && !estFerie(jour, 'FR')
}
