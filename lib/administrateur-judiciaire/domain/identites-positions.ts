import type { LotEnregistre } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Tantiemes } from '@/lib/administrateur-judiciaire/domain/format'
import { formaterNumeroCompte } from '@/lib/administrateur-judiciaire/domain/plan-comptable'
import { normaliserTexte } from '@/lib/administrateur-judiciaire/domain/texte'
import { GROUPE_IDENTITE, QUALITE_IDENTITE, type GroupeIdentite } from '@/lib/data/referentiels-gesteam-judiciaire'

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
 *
 * Point 59 du bilan 2 — coordonnées et rattachements (Gestéam, tranche 37 § Identités : adresses « À partir du …
 * jusqu'au … », bouton Représentant légal, groupes ; tranche 39 : grilles Positions et Participations).
 * - Adresses datées, bornes INCLUSES (les positions, elles, sont semi-ouvertes : sorties le jour de leur sortie).
 * - 🟢 D. 1967 art. 65 al. 2 (décret n° 2025-1292, en vigueur le 25/12/2025) : notifications et mises en demeure
 *   « valablement faites à la dernière adresse électronique ou au dernier domicile communiqué par le copropriétaire à
 *   cet effet » ; aucun délai de prise d'effet d'un changement d'adresse.
 * - 🔵 Déduit : une adresse vaut pour la notification dès sa réception par le syndic (communiqueeLe), et au plus tôt
 *   à sa date de début ; parmi les adresses en cours à la date, la dernière à prendre effet l'emporte (une adresse
 *   temporaire de correspondance prime l'adresse permanente pendant sa période) ; à prise d'effet égale, l'adresse
 *   bornée l'emporte ; sinon aucune n'est retenue et le contrôle le signale. Si aucune adresse n'est en cours (ancienne
 *   adresse close, nouvelle pas encore reçue), la dernière communiquée reste l'adresse de notification, et le contrôle
 *   signale qu'elle est échue.
 * - Groupes bornés par GROUPE_IDENTITE ; représentant légal daté, réservé à la personne morale (plusieurs co-gérants
 *   possibles) ; participations DÉRIVÉES des positions (D2 : la part est portée par la position), sans entité.
 * 🔴 Non établi : portée de « à cet effet » (toute adresse connue du syndic vaut-elle ?) — l'usage de l'adresse reste
 * libre, valeurs Gestéam non relevées ; choix du jeu de coordonnées par compte ou par syndicat (dans Gestéam, la fiche
 * client désigne son jeu de coordonnées ; ici, l'adresse vaut pour l'identité entière) ; adresse électronique datée
 * (les télécoms ne le sont pas ; voir le point 60) ; parts sociales d'un
 * associé de SCI qui n'est pas lui-même titulaire d'une position (hors champ). Le contrôle avant envoi électronique
 * (prénom, personne morale sans représentant) relève du point 60.
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

/** Adresse postale datée : valable du `du` au `au` INCLUS (au null : sans fin). */
export interface AdresseDatee {
  id: string
  lignes: string[]
  codePostal: string
  ville: string
  pays: string
  /** Usage de l'adresse (Gestéam « Usage », valeurs non relevées) ; null : aucun. */
  usage: string | null
  du: string
  au: string | null
  /** Réception de l'adresse par le syndic (D. 1967 art. 65) ; null : inconnue, la date de début fait foi. */
  communiqueeLe: string | null
}

/** Représentant légal ou statutaire d'une personne morale, du `du` au `au` INCLUS. */
export interface RepresentantLegal {
  /** Identité du représentant (personne physique ou morale). */
  identiteId: string
  /** Gérant, président… ; null : non précisée. */
  fonction: string | null
  du: string
  au: string | null
}

export interface Identite {
  id: string
  nature: 'physique' | 'morale'
  /** Civilité Gestéam (Monsieur, Madame, Indivision, SDC, S.C.I., Société…). */
  civilite: string
  nom: string
  prenom: string | null
  telecoms: Telecom[]
  adresses: AdresseDatee[]
  groupes: GroupeIdentite[]
  /** Vide pour une personne physique. */
  representants: RepresentantLegal[]
}

export type SaisieIdentite = Omit<Identite, 'adresses' | 'groupes' | 'representants'> &
  Partial<Pick<Identite, 'adresses' | 'groupes' | 'representants'>>

const nettoyer = (texte: string): string => texte.replace(/\s+/g, ' ').trim()

function verifierPeriode(du: string, au: string | null, objet: string): void {
  if (!estDateIsoValide(du)) throw new Error(`Date de début invalide (${du}) pour ${objet} : AAAA-MM-JJ attendu.`)
  if (au === null) return
  if (!estDateIsoValide(au)) throw new Error(`Date de fin invalide (${au}) pour ${objet} : AAAA-MM-JJ attendu.`)
  if (au < du) throw new Error(`${objet} : date de fin antérieure à la date de début.`)
}

/** Pays nettoyé ; « France » par défaut et quelle que soit la graphie (FRANCE, france…). */
function paysDeLAdresse(saisie: string): string {
  const pays = nettoyer(saisie)
  return !pays || normaliserTexte(pays) === 'FRANCE' ? 'France' : pays
}

export function creerAdresseDatee(saisie: AdresseDatee): AdresseDatee {
  const lignes = saisie.lignes.map(nettoyer).filter(Boolean)
  if (lignes.length === 0) throw new Error('Adresse sans ligne (numéro et voie attendus).')
  const ville = nettoyer(saisie.ville)
  if (!ville) throw new Error('Adresse sans ville.')
  const pays = paysDeLAdresse(saisie.pays)
  const codePostal = saisie.codePostal.trim()
  if (pays === 'France' && !/^\d{5}$/.test(codePostal)) throw new Error(`Code postal « ${saisie.codePostal} » : 5 chiffres attendus.`)
  verifierPeriode(saisie.du, saisie.au, `l'adresse « ${saisie.id} »`)
  if (saisie.communiqueeLe !== null && !estDateIsoValide(saisie.communiqueeLe))
    throw new Error(`Date de communication invalide (${saisie.communiqueeLe}) pour l'adresse « ${saisie.id} » : AAAA-MM-JJ attendu.`)
  return { ...saisie, lignes, codePostal, ville, pays, usage: saisie.usage?.trim() || null }
}

function verifierGroupes(groupes: GroupeIdentite[]): void {
  const vus = new Set<string>()
  for (const groupe of groupes) {
    if (!(GROUPE_IDENTITE as readonly string[]).includes(groupe)) throw new Error(`Groupe « ${groupe} » inconnu.`)
    if (vus.has(groupe)) throw new Error(`Groupe « ${groupe} » en double.`)
    vus.add(groupe)
  }
}

function verifierRepresentants(identite: Pick<Identite, 'id' | 'nature' | 'nom'>, representants: RepresentantLegal[]): void {
  if (representants.length > 0 && identite.nature !== 'morale')
    throw new Error(`${identite.nom} : le représentant légal est réservé à une personne morale.`)
  for (const r of representants) {
    if (!r.identiteId.trim()) throw new Error('Représentant légal : identité attendue.')
    if (r.identiteId.trim() === identite.id) throw new Error(`${identite.nom} : une personne morale ne se représente pas elle-même.`)
    verifierPeriode(r.du, r.au, `le représentant de ${identite.nom}`)
  }
}

export function creerIdentite(saisie: SaisieIdentite): Identite {
  const nom = nettoyer(saisie.nom)
  if (!nom) throw new Error("Nom de l'identité manquant.")
  const adresses = (saisie.adresses ?? []).map(creerAdresseDatee)
  const ids = adresses.map((a) => a.id)
  const doublon = ids.find((id, i) => ids.indexOf(id) !== i)
  if (doublon !== undefined) throw new Error(`Adresse « ${doublon} » en double.`)
  const groupes = saisie.groupes ?? []
  verifierGroupes(groupes)
  const representants = saisie.representants ?? []
  verifierRepresentants({ id: saisie.id, nature: saisie.nature, nom }, representants)
  return {
    ...saisie,
    nom,
    prenom: saisie.prenom?.trim() || null,
    adresses,
    groupes: [...groupes],
    representants: representants.map((r) => ({ ...r, identiteId: r.identiteId.trim(), fonction: r.fonction?.trim() || null })),
  }
}

const dansPeriode = (date: string, du: string, au: string | null): boolean => du <= date && (au === null || date <= au)

function verifierDate(date: string): void {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
}

/** Adresses valables à une date (bornes incluses), dans l'ordre de la fiche. */
export function adressesValablesA(identite: Pick<Identite, 'adresses'>, date: string): AdresseDatee[] {
  verifierDate(date)
  return identite.adresses.filter((a) => dansPeriode(date, a.du, a.au))
}

/** Prise d'effet d'une adresse pour la notification : sa réception par le syndic, au plus tôt sa date de début. */
const priseDEffet = (a: AdresseDatee): string => (a.communiqueeLe !== null && a.communiqueeLe > a.du ? a.communiqueeLe : a.du)

const comparerCandidates = (a: AdresseDatee, b: AdresseDatee): number =>
  priseDEffet(b).localeCompare(priseDEffet(a)) || Number(b.au !== null) - Number(a.au !== null)

/**
 * Adresses candidates à la notification, la dernière à prendre effet en tête (bornée d'abord à égalité) : celles en
 * cours à la date, ou à défaut les adresses communiquées et déjà closes (`echue`).
 */
function candidatesNotification(identite: Pick<Identite, 'adresses'>, date: string): { candidates: AdresseDatee[]; echue: boolean } {
  verifierDate(date)
  const communiquees = identite.adresses.filter((a) => priseDEffet(a) <= date)
  const enCours = communiquees.filter((a) => a.au === null || date <= a.au)
  if (enCours.length > 0) return { candidates: enCours.sort(comparerCandidates), echue: false }
  return { candidates: communiquees.sort(comparerCandidates), echue: communiquees.length > 0 }
}

const indiscernables = (a: AdresseDatee, b: AdresseDatee): boolean => priseDEffet(a) === priseDEffet(b) && (a.au === null) === (b.au === null)

/**
 * D. 1967 art. 65 al. 2 — adresse postale de notification à la date : la dernière communiquée qui vaut à cette date,
 * à défaut la dernière communiquée, même close ; null si aucune, ou si deux se valent.
 */
export function adresseDeNotification(identite: Pick<Identite, 'adresses'>, date: string): AdresseDatee | null {
  const [premiere, seconde] = candidatesNotification(identite, date).candidates
  if (!premiere) return null
  return seconde && indiscernables(premiere, seconde) ? null : premiere
}

export interface AnomalieAdresse {
  code: 'sans_adresse' | 'adresses_concurrentes' | 'adresse_echue'
  message: string
}

export function controlerAdresses(identite: Pick<Identite, 'adresses'>, date: string): AnomalieAdresse[] {
  const { candidates, echue } = candidatesNotification(identite, date)
  const [premiere, seconde] = candidates
  if (!premiere) return [{ code: 'sans_adresse', message: `Aucune adresse postale communiquée au ${date}.` }]
  if (seconde && indiscernables(premiere, seconde))
    return [{ code: 'adresses_concurrentes', message: `Adresses « ${premiere.id} » et « ${seconde.id} » concurrentes : préciser laquelle a été communiquée en dernier.` }]
  if (echue)
    return [
      {
        code: 'adresse_echue',
        message: `Adresse « ${premiere.id} » close le ${premiere.au} : demander la nouvelle adresse ; d'ici là, la dernière adresse communiquée reste valable (D. 1967 art. 65).`,
      },
    ]
  return []
}

/** Représentants légaux d'une personne morale à une date (bornes incluses) ; [] pour une personne physique. */
export function representantsLegauxA(identite: Pick<Identite, 'nature' | 'representants'>, date: string): RepresentantLegal[] {
  verifierDate(date)
  return identite.nature === 'morale' ? identite.representants.filter((r) => dansPeriode(date, r.du, r.au)) : []
}

/** Identités d'un groupe (ex. « Copie CS » : copies au conseil syndical), triées par nom. */
export const identitesDuGroupe = (identites: Identite[], groupe: GroupeIdentite): Identite[] =>
  identites.filter((i) => i.groupes.includes(groupe)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

export interface CompteCoproprietaire {
  id: string
  /** D1 : le syndicat. */
  coproprieteId: string
  /** Numéro de série du compte (segment auxiliaire, 5 caractères). */
  serie: string
  libelle: string
  /**
   * Décision J10 (Hugo, 30/10/2026) — identité du mandataire commun des indivisaires du compte (L. 1965 art. 23, al. 2 :
   * désigné d'accord entre eux ou, à défaut, par le président du tribunal judiciaire). Facultatif et non indexé ; absent,
   * null ou vide : aucun désigné. Seul ce mandataire reçoit un règlement destiné à l'indivision
   * (reglements-fournisseurs.ts, controlerBeneficiaireIndivisaire).
   */
  mandataireCommunId?: string | null
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

/** Statut d'une position à une date, cohérent avec positionsEnPlace (sortie le jour de sa sortie). */
export function statutPositionA(p: Position, date: string): StatutPosition {
  verifierDate(date)
  if (p.statut === 'Futur' || date < p.dateEntree) return 'Futur'
  if (p.dateSortie !== null && date >= p.dateSortie) return 'Sorti'
  return 'En place'
}

export interface LignePositionIdentite {
  position: Position
  /** Lot joint (immeuble, n°) ; null s'il n'est pas fourni. */
  lot: LotEnregistre | null
  statut: StatutPosition
}

const RANG_STATUT: Record<StatutPosition, number> = { 'En place': 0, Futur: 1, Sorti: 2 }

const comparerLignes = (a: LignePositionIdentite, b: LignePositionIdentite): number =>
  RANG_STATUT[a.statut] - RANG_STATUT[b.statut] ||
  Number(a.lot === null) - Number(b.lot === null) ||
  (a.lot?.numero ?? a.position.lotId).localeCompare(b.lot?.numero ?? b.position.lotId, 'fr', { numeric: true })

/**
 * Grille Positions d'une identité (Gestéam : Immeubles · N° · Nature · Statut) : en place, puis futures, puis sorties,
 * puis par n° de lot. Sans date, le statut enregistré ; avec une date, le statut à cette date.
 */
export function positionsIdentite(
  positions: Position[],
  identiteId: string,
  { date, lots = [] }: { date?: string; lots?: LotEnregistre[] } = {},
): LignePositionIdentite[] {
  if (date !== undefined) verifierDate(date)
  return positions
    .filter((p) => p.identiteId === identiteId)
    .map((position) => ({
      position,
      lot: lots.find((l) => l.id === position.lotId) ?? null,
      statut: date === undefined ? position.statut : statutPositionA(position, date),
    }))
    .sort(comparerLignes)
}

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

type Droit = 'pleine propriété' | 'nue-propriété' | 'usufruit'

/** Droit de propriété porté par une qualité ; null hors des qualités de propriété (locataire, gardien…). */
function droitDe(qualite: QualitePosition): Droit | null {
  if (PLEINE_PROPRIETE.includes(qualite)) return 'pleine propriété'
  if (qualite === 'Nu propriétaire') return 'nue-propriété'
  if (qualite === 'Usufruitier') return 'usufruit'
  return null
}

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
    'pleine propriété': proprietaires.filter((p) => droitDe(p.qualite) === 'pleine propriété'),
    'nue-propriété': proprietaires.filter((p) => droitDe(p.qualite) === 'nue-propriété'),
    usufruit: proprietaires.filter((p) => droitDe(p.qualite) === 'usufruit'),
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

/** Participation d'une identité à un compte (Gestéam, grille Participations : Compte · Société, indivision · Parts · Total · Statut). */
export interface Participation {
  compteId: string
  /** Libellé du compte (nom de l'indivision ou de la société) ; null s'il est vide ou si le compte n'est pas fourni. */
  libelle: string | null
  lotId: string
  qualite: QualitePosition
  part: Tantiemes
  /** Somme des parts EN PLACE à la date sur le même compte, le même lot et le même droit (1 attendu). */
  total: Tantiemes
  statut: StatutPosition
}

const QUALITES_PARTICIPATION: ReadonlySet<string> = new Set(['Indivisaire', 'Associé(e)'])

/**
 * Participations d'une identité, dérivées de ses positions : indivisaire ou associé, ou droit partagé (part < 1). Un plein
 * propriétaire seul (1/1) n'a pas de participation. Ordre des positions.
 */
export function participationsIdentite(
  positions: Position[],
  comptes: CompteCoproprietaire[],
  identiteId: string,
  date: string,
): Participation[] {
  verifierDate(date)
  const participations: Participation[] = []
  for (const p of positions) {
    const droit = droitDe(p.qualite)
    if (p.identiteId !== identiteId || droit === null || p.compteId === null || p.part === null) continue
    if (!QUALITES_PARTICIPATION.has(p.qualite) && p.part.numerateur === p.part.denominateur) continue
    const coTitulaires = positionsEnPlace(positions, p.lotId, date).filter(
      (q) => q.compteId === p.compteId && droitDe(q.qualite) === droit && q.part !== null,
    )
    participations.push({
      compteId: p.compteId,
      libelle: comptes.find((c) => c.id === p.compteId)?.libelle.trim() || null,
      lotId: p.lotId,
      qualite: p.qualite,
      part: p.part,
      total: sommeParts(coTitulaires.map((q) => q.part as Tantiemes)),
      statut: statutPositionA(p, date),
    })
  }
  return participations
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
