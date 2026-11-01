import { ajouterMois, composerDateIso, decomposerDateIso, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { creerTraitement, type FamilleTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { FAMILLE_TRAITEMENT } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Modèles d'écritures (cartographie Gestéam, Réglages > 5 « Modèles d'écritures », tranche 29). Fonctions pures, montants
 * en CENTIMES ENTIERS, sans écran.
 *
 * Gestéam — fiche « Comptabilité scénario types » : Code, Nom, Hors service, Journal, Mode écriture, Périodicité (n +
 * unité) le (jour), Dernier usage, boutons Exécuter / Traitement ; lignes Compte · Libellé · Débit · Crédit, Total, Taux,
 * Ventilation. Aucun modèle au cabinet à la date du relevé : fonction peu prioritaire, modélisée simplement.
 * Deux modes : montants fixes (équilibrés) ou ventilation d'une base en pourcentages (100 % de chaque côté).
 * D1 — les comptes générés portent le segment du syndicat. R6 — le modèle se rejoue par un traitement.
 * 🔵 Périodicité limitée aux mois, jour du mois ≤ 28 (pas d'échéance fantôme en février).
 */

const FAMILLES: ReadonlySet<string> = new Set(Object.values(FAMILLE_TRAITEMENT).flat())

export interface LigneModele {
  /** Code du plan comptable, 5 caractères. */
  compte: string
  /** Segment auxiliaire (5 caractères) ; « 00000 » si absent. */
  auxiliaire?: string
  sens: 'debit' | 'credit'
  montantCentimes: number | null
  tauxPct: number | null
}

export interface SaisieModeleEcriture {
  code: string
  nom: string
  horsService: boolean
  famille: FamilleTraitement
  periodicite: { mois: number; jour: number } | null
  dernierUsage: string | null
  lignes: LigneModele[]
}

export interface ModeleEcriture extends SaisieModeleEcriture {
  mode: 'montants' | 'ventilation'
}

const somme = (lignes: LigneModele[], sens: LigneModele['sens'], champ: 'montantCentimes' | 'tauxPct') =>
  lignes.filter((l) => l.sens === sens).reduce((s, l) => s + (l[champ] ?? 0), 0)

export function creerModeleEcriture(saisie: SaisieModeleEcriture): ModeleEcriture {
  if (!FAMILLES.has(saisie.famille)) throw new Error(`Famille de traitement inconnue : « ${saisie.famille} ».`)
  if (saisie.periodicite) {
    const { mois, jour } = saisie.periodicite
    if (!Number.isInteger(mois) || mois < 1) throw new Error(`Périodicité invalide (${mois} mois).`)
    if (!Number.isInteger(jour) || jour < 1 || jour > 28) throw new Error(`Jour du mois invalide (${jour}) : de 1 à 28.`)
  }
  if (saisie.dernierUsage !== null && !estDateIsoValide(saisie.dernierUsage))
    throw new Error(`Date de dernier usage invalide (${saisie.dernierUsage}) : AAAA-MM-JJ attendu.`)
  if (!saisie.lignes.some((l) => l.sens === 'debit') || !saisie.lignes.some((l) => l.sens === 'credit'))
    throw new Error('Un modèle comporte au moins un débit et un crédit.')
  for (const l of saisie.lignes) {
    if (!/^[0-9A-Z]{5}$/.test(l.compte)) throw new Error(`Compte « ${l.compte} » : code du plan sur 5 caractères attendu.`)
    if (l.auxiliaire !== undefined && !/^[0-9A-Z]{5}$/.test(l.auxiliaire)) throw new Error(`Auxiliaire « ${l.auxiliaire} » : 5 caractères attendus.`)
  }
  const avecMontant = saisie.lignes.filter((l) => l.montantCentimes !== null).length
  const avecTaux = saisie.lignes.filter((l) => l.tauxPct !== null).length
  if (avecMontant && avecTaux) throw new Error('Mélange de montants et de taux : un modèle est à montants fixes ou ventilé.')
  if (avecMontant === saisie.lignes.length) {
    if (saisie.lignes.some((l) => !Number.isInteger(l.montantCentimes) || (l.montantCentimes as number) <= 0))
      throw new Error('Montants invalides : centimes entiers strictement positifs attendus.')
    if (somme(saisie.lignes, 'debit', 'montantCentimes') !== somme(saisie.lignes, 'credit', 'montantCentimes'))
      throw new Error('Modèle non équilibré : débits ≠ crédits.')
    return { ...saisie, mode: 'montants' }
  }
  if (avecTaux !== saisie.lignes.length) throw new Error('Chaque ligne porte soit un montant, soit un taux.')
  for (const sens of ['debit', 'credit'] as const)
    if (Math.abs(somme(saisie.lignes, sens, 'tauxPct') - 100) > 1e-9) throw new Error(`Ventilation : les taux ${sens === 'debit' ? 'débit' : 'crédit'} doivent faire 100 %.`)
  return { ...saisie, mode: 'ventilation' }
}

/** Échéances après le dernier usage (ou dès ce mois-ci s'il n'y en a pas), jusqu'à `jusqua` ; aucune sans périodicité. */
export function echeancesModele(modele: ModeleEcriture, jusqua: string): string[] {
  if (!modele.periodicite || modele.horsService) return []
  const { mois, jour } = modele.periodicite
  const depart = modele.dernierUsage ?? jusqua
  const { a, m } = decomposerDateIso(depart)
  let date = composerDateIso(a, m, jour)
  if (modele.dernierUsage) date = ajouterMois(date, mois)
  const dates: string[] = []
  while (date <= jusqua) {
    dates.push(date)
    date = ajouterMois(date, mois)
  }
  return dates
}

/** Rejoue le modèle : traitement de sa famille, comptes au syndicat, ventilation d'une base au centime près. */
export function genererTraitementModele(
  modele: ModeleEcriture,
  { id, date, segmentSyndicat, baseCentimes }: { id: string; date: string; segmentSyndicat: string; baseCentimes?: number },
): Traitement {
  if (modele.horsService) throw new Error(`Modèle ${modele.code} hors service : il ne se rejoue plus.`)
  let montants: number[]
  if (modele.mode === 'montants') montants = modele.lignes.map((l) => l.montantCentimes as number)
  else {
    if (baseCentimes === undefined || !Number.isInteger(baseCentimes) || baseCentimes <= 0)
      throw new Error('Modèle ventilé : indiquer la base à ventiler (centimes entiers positifs).')
    montants = modele.lignes.map((l) => Math.round((baseCentimes * (l.tauxPct as number)) / 100))
    for (const sens of ['debit', 'credit'] as const) {
      const indices = modele.lignes.flatMap((l, i) => (l.sens === sens ? [i] : []))
      const ecart = baseCentimes - indices.reduce((s, i) => s + montants[i], 0)
      montants[indices[indices.length - 1]] += ecart
    }
  }
  return creerTraitement({
    id,
    famille: modele.famille,
    date,
    mouvements: modele.lignes.map((l, i) => ({
      compte: `${segmentSyndicat}.${l.compte}.${l.auxiliaire ?? '00000'}.0`,
      sens: l.sens,
      montantCentimes: montants[i],
    })),
  })
}
