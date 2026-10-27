import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Tantiemes } from '@/lib/administrateur-judiciaire/domain/format'
import { formaterNumeroCompte } from '@/lib/administrateur-judiciaire/domain/plan-comptable'
import { QUALITE_IDENTITE } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Décision D2 (Hugo Carvalho, 27/10/2026) — Identité / Position / Compte copropriétaire. Fonctions pures, dates ISO
 * (AAAA-MM-JJ), sans écran ni table (les tables viendront avec l'écran et la migration des données).
 *
 * Gestéam — fiche client (tranche 30) : la position (« client » : compte, statut En place / Futur…) porte une grille
 * Identité · Relation · Part ; les relations sont les qualités de QUALITE_IDENTITE (tranche 20). Le compte 450 porte un
 * numéro de SÉRIE, pas l'identité (tranche 24) ; son premier segment est celui du syndicat (D1).
 *
 * Périmètre VitFix : blocs copropriete, location, personnel (et autre) de QUALITE_IDENTITE ; la gérance est hors champ.
 * Règles de contrôle d'un lot : un propriétaire au moins ; pleine propriété OU démembrement (nue-propriété + usufruit),
 * jamais les deux ; parts de chaque droit = 1 ; un seul compte pour les droits de propriété du lot (une dette = un compte).
 */

const QUALITES_COPROPRIETE = QUALITE_IDENTITE.copropriete
export const QUALITES_POSITION = [
  ...QUALITE_IDENTITE.copropriete,
  ...QUALITE_IDENTITE.location,
  ...QUALITE_IDENTITE.personnel,
  ...QUALITE_IDENTITE.autre,
] as const
export type QualitePosition = (typeof QUALITES_POSITION)[number]

const PLEINE_PROPRIETE: readonly string[] = ['Copropriétaire', 'Indivisaire', 'Associé(e)']

export const estQualiteCopropriete = (qualite: QualitePosition): boolean => (QUALITES_COPROPRIETE as readonly string[]).includes(qualite)

export interface Telecom {
  nature: string
  valeur: string
}

export interface Identite {
  id: string
  nature: 'physique' | 'morale'
  /** Civilité Gestéam (Monsieur, Madame, Indivision, SDC, S.C.I., Société…). */
  civilite: string
  nom: string
  prenom: string | null
  telecoms: Telecom[]
}

export function creerIdentite(saisie: Identite): Identite {
  const nom = saisie.nom.replace(/\s+/g, ' ').trim()
  if (!nom) throw new Error("Nom de l'identité manquant.")
  return { ...saisie, nom, prenom: saisie.prenom?.trim() || null }
}

export interface CompteCoproprietaire {
  id: string
  /** D1 : le syndicat. */
  coproprieteId: string
  /** Numéro de série du compte (segment auxiliaire, 5 caractères). */
  serie: string
  libelle: string
}

export function creerCompteCoproprietaire(saisie: CompteCoproprietaire): CompteCoproprietaire {
  const brut = saisie.serie.trim().toUpperCase()
  if (!/^[0-9A-Z]{1,5}$/.test(brut)) throw new Error(`Série « ${saisie.serie} » : 1 à 5 caractères alphanumériques attendus.`)
  return { ...saisie, serie: brut.padStart(5, '0'), libelle: saisie.libelle.trim() }
}

/** Numéro du compte copropriétaire : <syndicat>.45000.<série>.0. */
export const numeroCompteCoproprietaire = (compte: CompteCoproprietaire, segmentSyndicat: string): string =>
  formaterNumeroCompte({ mandat: segmentSyndicat, planCode: '45000', auxiliaire: compte.serie })

export type StatutPosition = 'En place' | 'Futur' | 'Sorti'

export interface Position {
  id: string
  identiteId: string
  lotId: string
  /** Compte du débiteur ; obligatoire pour une qualité de copropriété, null sinon. */
  compteId: string | null
  qualite: QualitePosition
  /** Part du droit ; obligatoire pour une qualité de copropriété. */
  part: Tantiemes | null
  statut: StatutPosition
  dateEntree: string
  dateSortie: string | null
}

export type SaisiePosition = Position

export function creerPosition(saisie: SaisiePosition): Position {
  if (!(QUALITES_POSITION as readonly string[]).includes(saisie.qualite))
    throw new Error(`Qualité « ${saisie.qualite} » hors du périmètre VitFix (copropriété, location, personnel).`)
  if (!estDateIsoValide(saisie.dateEntree)) throw new Error(`Date d'entrée invalide (${saisie.dateEntree}) : AAAA-MM-JJ attendu.`)
  if (saisie.dateSortie !== null) {
    if (!estDateIsoValide(saisie.dateSortie)) throw new Error(`Date de sortie invalide (${saisie.dateSortie}) : AAAA-MM-JJ attendu.`)
    if (saisie.dateSortie < saisie.dateEntree) throw new Error('Date de sortie antérieure à la date d’entrée.')
  }
  if (estQualiteCopropriete(saisie.qualite)) {
    if (!saisie.compteId?.trim()) throw new Error(`${saisie.qualite} : rattacher la position à un compte copropriétaire.`)
    if (!saisie.part) throw new Error(`${saisie.qualite} : indiquer la part du droit.`)
  }
  if (saisie.part) {
    const { numerateur, denominateur } = saisie.part
    if (!Number.isInteger(numerateur) || !Number.isInteger(denominateur) || numerateur <= 0 || denominateur <= 0 || numerateur > denominateur)
      throw new Error(`Part invalide (${numerateur}/${denominateur}) : fraction entre 0 et 1 attendue.`)
  }
  return saisie
}

/** Positions en place sur un lot à une date : entrées, pas encore sorties, hors statut « Futur ». */
export const positionsEnPlace = (positions: Position[], lotId: string, date: string): Position[] =>
  positions.filter(
    (p) => p.lotId === lotId && p.statut !== 'Futur' && p.dateEntree <= date && (p.dateSortie === null || date < p.dateSortie),
  )

const pgcd = (a: number, b: number): number => (b === 0 ? a : pgcd(b, a % b))
const sommeParts = (parts: Tantiemes[]): Tantiemes =>
  parts.reduce(
    (s, p) => {
      const numerateur = s.numerateur * p.denominateur + p.numerateur * s.denominateur
      const denominateur = s.denominateur * p.denominateur
      const d = pgcd(numerateur, denominateur)
      return { numerateur: numerateur / d, denominateur: denominateur / d }
    },
    { numerateur: 0, denominateur: 1 },
  )

export type CodeAnomalieDroits = 'sans_proprietaire' | 'droits_incompatibles' | 'demembrement_incomplet' | 'parts_incompletes' | 'comptes_multiples'

export interface AnomalieDroits {
  code: CodeAnomalieDroits
  message: string
}

/** Contrôle des positions EN PLACE d'un lot (voir l'en-tête du module). */
export function controlerDroitsLot(positions: Position[]): AnomalieDroits[] {
  const proprietaires = positions.filter((p) => estQualiteCopropriete(p.qualite))
  if (proprietaires.length === 0) return [{ code: 'sans_proprietaire', message: 'Lot sans propriétaire en place.' }]
  const anomalies: AnomalieDroits[] = []
  const groupes = {
    'pleine propriété': proprietaires.filter((p) => PLEINE_PROPRIETE.includes(p.qualite)),
    'nue-propriété': proprietaires.filter((p) => p.qualite === 'Nu propriétaire'),
    usufruit: proprietaires.filter((p) => p.qualite === 'Usufruitier'),
  }
  const demembre = groupes['nue-propriété'].length > 0 || groupes.usufruit.length > 0
  if (groupes['pleine propriété'].length > 0 && demembre)
    anomalies.push({ code: 'droits_incompatibles', message: 'Pleine propriété et démembrement en même temps sur le lot.' })
  else if (demembre && (groupes['nue-propriété'].length === 0 || groupes.usufruit.length === 0))
    anomalies.push({ code: 'demembrement_incomplet', message: 'Démembrement incomplet : nue-propriété et usufruit attendus tous deux.' })
  for (const [droit, liste] of Object.entries(groupes)) {
    if (liste.length === 0) continue
    const somme = sommeParts(liste.map((p) => p.part as Tantiemes))
    if (somme.numerateur !== somme.denominateur)
      anomalies.push({ code: 'parts_incompletes', message: `Parts de ${droit} : ${somme.numerateur}/${somme.denominateur} au lieu de 1.` })
  }
  if (new Set(proprietaires.map((p) => p.compteId)).size > 1)
    anomalies.push({ code: 'comptes_multiples', message: 'Plusieurs comptes pour les droits de propriété du lot : une dette = un compte.' })
  return anomalies
}

/**
 * Mutation d'un lot : les positions sortantes sont closes à la date (statut Sorti), les entrantes ouvertes (En place).
 * Rien n'est effacé ; renvoie les positions à jour et le contrôle des droits du lot à la date.
 */
export function muterLot(
  positions: Position[],
  {
    lotId,
    date,
    sortantes,
    entrantes,
  }: { lotId: string; date: string; sortantes: string[]; entrantes: Omit<Position, 'lotId' | 'statut' | 'dateEntree' | 'dateSortie'>[] },
): { positions: Position[]; anomalies: AnomalieDroits[] } {
  if (!estDateIsoValide(date)) throw new Error(`Date de mutation invalide (${date}) : AAAA-MM-JJ attendu.`)
  for (const id of sortantes)
    if (!positions.some((p) => p.id === id && p.lotId === lotId)) throw new Error(`Position sortante introuvable sur le lot : « ${id} ».`)
  const apres = [
    ...positions.map((p) => (sortantes.includes(p.id) ? { ...p, statut: 'Sorti' as const, dateSortie: date } : p)),
    ...entrantes.map((e) => creerPosition({ ...e, lotId, statut: 'En place', dateEntree: date, dateSortie: null })),
  ]
  return { positions: apres, anomalies: controlerDroitsLot(positionsEnPlace(apres, lotId, date)) }
}

/** Ancien copropriétaire VitFix (une fiche par lot : identité, position et solde mêlés). */
export interface CoproprietaireHistorique {
  id: string
  lotId: string
  nom: string
  tel: string
  mail: string
  statut: string
}

/** Migration D2 : une identité, un compte et une position de pleine propriété (1/1) par ancienne fiche. */
export function migrerCoproprietaire(
  ancien: CoproprietaireHistorique,
  { coproprieteId, serie, dateEntree }: { coproprieteId: string; serie: string; dateEntree: string },
): { identite: Identite; compte: CompteCoproprietaire; position: Position } {
  const identite = creerIdentite({
    id: `id-${ancien.id}`,
    nature: 'physique',
    civilite: '',
    nom: ancien.nom,
    prenom: null,
    telecoms: [
      ...(ancien.tel.trim() ? [{ nature: 'Téléphone', valeur: ancien.tel.trim() }] : []),
      ...(ancien.mail.trim() ? [{ nature: 'E-mail', valeur: ancien.mail.trim() }] : []),
    ],
  })
  const compte = creerCompteCoproprietaire({ id: `cpt-${ancien.id}`, coproprieteId, serie, libelle: identite.nom })
  const position = creerPosition({
    id: `pos-${ancien.id}`,
    identiteId: identite.id,
    lotId: ancien.lotId,
    compteId: compte.id,
    qualite: 'Copropriétaire',
    part: { numerateur: 1, denominateur: 1 },
    statut: 'En place',
    dateEntree,
    dateSortie: null,
  })
  return { identite, compte, position }
}
