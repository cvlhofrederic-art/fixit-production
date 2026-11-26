import type { ReglementCompteEnregistre } from '@/lib/administrateur-judiciaire/db/schema'
import {
  compteEncaissement,
  validerIban,
  type CompteCandidatEncaissement,
  type ModeComptesLu,
} from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import {
  DELAI_PREAVIS_SEPA_JOURS,
  contenuAvisAppel,
  echeancesPrelevementDepuisAvis,
  type ContenuAvisAppel,
  type ContenuAvisCompte,
  type EcartPrelevement,
  type MandatPrelevement,
  type RegimeAdministrateurProvisoire,
  type ReglementCompte,
} from '@/lib/administrateur-judiciaire/domain/avis-appel'
import { ajouterJours, dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  controlerDateComptableAppel,
  dateComptableAppel,
  echeancesAAppeler,
  type AnomalieDateComptableAppel,
  type BornesExercice,
  type EcheanceAppelSuivie,
} from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import type { Tantiemes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  controlerDroitsLot,
  positionsEnPlace,
  type CompteCoproprietaire,
  type Identite,
  type Position,
} from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { preparerLotPrelevements, type LotPrelevements, type MotifExclusion } from '@/lib/administrateur-judiciaire/domain/prelevements-sepa'
import {
  avisDAppel,
  mutationDuJour,
  traitementAppelDeFonds,
  type AnomalieAppel,
  type AvisAppels,
  type CleRepartition,
  type NatureEcheance,
  type SousComptes450,
} from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import type { Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Vue de l'écran « Appels de fonds » en données réelles (plan des écrans, § 5.5 à 5.10) : calculs purs sur les tables
 * D2 lues (db/appels-de-fonds.ts), par les fonctions du domaine, sans règle propre. Seuls les textes à l'écran et le
 * choix des données passées au domaine sont décidés ici :
 * - l'appel regroupe les échéances « Prévu » exigibles jusqu'à la date choisie (echeancesAAppeler) ;
 * - avis par compte (avisDAppel), écriture de l'appel en aperçu (traitementAppelDeFonds) et contrôle de sa date
 *   comptable (controlerDateComptableAppel : J67, R96) ; toute anomalie de répartition bloque l'écriture ;
 * - solde antérieur non repris (les encaissements de la trésorerie sont imputés aux anciennes fiches, comptes
 *   « 450-<fiche> », pas aux comptes D2) : l'avis ne porte que l'appelé ; point à trancher ;
 * - contenu de l'avis (contenuAvisAppel) : règlement de chaque compte (mode et mandat SEPA lus sur le compte, saisie à
 *   brancher), ICS de la fiche copropriété, compte qui reçoit les règlements désigné selon le mode de tenue lu pour le
 *   mandat (décision du 22/11/2026, ap-03 : compteEncaissement, sans ordre fixe ni repli ; mode illisible ou compte non
 *   désigné : la diffusion est bloquée, jamais l'écriture de l'appel) ;
 * - prélèvements par l'avis (echeancesPrelevementDepuisAvis), puis le lot (preparerLotPrelevements) : la diffusion de
 *   l'avis n'est pas branchée, aucun débit n'est donc pré-notifié ; un débit possible attend la diffusion, les autres
 *   sont exclus avec leur motif. Le fichier pain.008 n'est ni produit ni transmis par l'écran.
 */

/** Libellés des natures d'échéance (repartition-appels.ts : contrepartie 70100, 10500, 10200 par défaut). */
export const NATURES_APPEL: Record<NatureEcheance, string> = {
  budget: 'Provisions du budget',
  fonds_travaux: 'Cotisation au fonds de travaux',
  travaux: 'Travaux hors budget',
}

/** Lot lu pour l'appel : identifiant, numéro, tantièmes généraux. */
export interface LotAppel {
  id: string
  numero: string
  tantiemes: Tantiemes
}

/** Compte copropriétaire lu, avec son règlement enregistré s'il existe (mode, mandat SEPA : saisie à brancher). */
export type CompteAppel = CompteCoproprietaire & { reglement?: ReglementCompteEnregistre | null }

/** Compte bancaire du syndicat lu pour désigner celui qui reçoit les règlements (nature, IBAN, actif, marques du fonds). */
export type BanqueAppel = CompteCandidatEncaissement

export interface DonneesAppels {
  lots: readonly LotAppel[]
  positions: readonly Position[]
  identites: readonly Pick<Identite, 'id' | 'nom' | 'prenom'>[]
  comptes: readonly CompteAppel[]
  cles: readonly CleRepartition[]
  echeances: readonly EcheanceAppelSuivie[]
  exercices: readonly BornesExercice[]
  banques: readonly BanqueAppel[]
  /** Mode de tenue des comptes du mandat (choix du mandat, à défaut réglage du cabinet), ou l'erreur de lecture (ap-03). */
  modeComptes: ModeComptesLu
  /** Comptes en contentieux (colonne « Ctx » de Gestéam) : prélèvement suspendu. */
  comptesEnContentieux: ReadonlySet<string>
}

export interface ContexteAppel {
  /** Échéances « Prévu » exigibles jusqu'à ce jour. */
  jusquAu: string
  dateEmission: string
  datePrelevement: string | null
  segmentSyndicat: string
  syndicat: { nom: string; adresse: string }
  ics: string | null
  administrateurProvisoire: RegimeAdministrateurProvisoire | null
  /** Réglage du syndicat (J67, R104) : saisie à brancher, null à l'écran. */
  sousComptes450?: SousComptes450 | null
}

export type EtatPrelevement = 'retenu' | 'attente_diffusion' | 'exclu'

export interface LignePrelevement {
  compteId: string
  libelle: string
  numeroCompte: string
  montantCentimes: number
  etat: EtatPrelevement
  motif: string | null
}

export interface VuePrelevements {
  lot: LotPrelevements
  lignes: LignePrelevement[]
}

export interface VueAvisAppel {
  /** Échéances de l'appel (« Prévu », exigibles jusqu'à la date choisie). */
  echeances: EcheanceAppelSuivie[]
  avis: AvisAppels | null
  /** Anomalies de répartition, en clair : chacune bloque l'écriture. */
  anomalies: string[]
  contenu: ContenuAvisAppel | null
  /** Calcul impossible (donnée enregistrée illisible) : message du domaine. */
  erreur: string | null
  /** Écriture de l'appel en aperçu (identifiant provisoire) ; null si l'avis porte une anomalie. */
  ecriture: Traitement | null
  equilibre: { debitCentimes: number; creditCentimes: number; equilibree: boolean } | null
  dateComptable: string | null
  controleDate: AnomalieDateComptableAppel[]
  /** Première exigibilité hors des exercices du syndicat : exercice à ouvrir avant d'écrire. */
  exerciceManquant: string | null
  /** Raison qui bloque l'écriture ; null : l'appel peut être écrit. */
  blocage: string | null
  prelevements: VuePrelevements | null
}

const nomLot = (lots: readonly LotAppel[], lotId: string | null): string => lots.find((l) => l.id === lotId)?.numero ?? lotId ?? '—'

const nomIdentite = (i: Pick<Identite, 'nom' | 'prenom'> | undefined): string => (i ? [i.nom, i.prenom].filter(Boolean).join(' ') : 'Identité inconnue')

/** Montant saisi en euros (« 1 000,01 », « 12.5 ») → centimes entiers ; null s'il est illisible ou au-delà du centime. */
export function centimesDepuisSaisie(texte: string): number | null {
  const brut = texte.replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(brut)) return null
  const [euros, centimes = ''] = brut.split('.')
  return Number(euros) * 100 + Number(centimes.padEnd(2, '0'))
}

/** Exigibilités des échéances « Prévu », sans doublon, dans l'ordre : une option d'appel chacune. */
export function exigibilitesAAppeler(echeances: readonly EcheanceAppelSuivie[]): string[] {
  return [...new Set(echeances.filter((e) => e.statut === 'Prévu').map((e) => e.exigibilite))].sort((a, b) => a.localeCompare(b))
}

/** Date du débit proposée : la dernière exigibilité, au plus tôt le délai de pré-notification après l'émission. */
export function datePrelevementProposee(exigibilites: readonly string[], dateEmission: string): string {
  const auPlusTot = ajouterJours(dateEmission, DELAI_PREAVIS_SEPA_JOURS)
  const derniere = [...exigibilites].sort((a, b) => a.localeCompare(b)).at(-1) ?? auPlusTot
  return derniere > auPlusTot ? derniere : auPlusTot
}

function texteAnomalie(a: AnomalieAppel, d: DonneesAppels, echeances: readonly EcheanceAppelSuivie[]): string {
  const echeance = echeances.find((e) => e.id === a.echeanceId)
  const libelle = echeance?.libelle ?? a.echeanceId
  const date = echeance ? dateIsoVersFr(echeance.exigibilite) : '—'
  const lot = `Lot ${nomLot(d.lots, a.lotId)}`
  switch (a.code) {
    case 'cle_inconnue':
      return `« ${libelle} » : clé de répartition inconnue (${echeance?.cleId ?? '—'}).`
    case 'lot_sans_compte':
      return `${lot} : aucun compte copropriétaire en place au ${date} (« ${libelle} »).`
    case 'comptes_multiples':
      return `${lot} : plusieurs comptes pour les droits de propriété au ${date} (« ${libelle} ») : une dette = un compte (D2).`
    case 'mutation_avant_art_6_2':
      return `${lot} : mutation le jour d'une exigibilité antérieure au 01/09/2004 (« ${libelle} ») : hors champ.`
  }
}

function equilibreDe(t: Traitement): NonNullable<VueAvisAppel['equilibre']> {
  const total = (sens: 'debit' | 'credit') => t.mouvements.filter((m) => m.sens === sens).reduce((s, m) => s + m.montantCentimes, 0)
  const debitCentimes = total('debit')
  const creditCentimes = total('credit')
  return { debitCentimes, creditCentimes, equilibree: debitCentimes === creditCentimes }
}

/** Motif lisible d'un débit retiré par le contenu : IBAN et RUM précisés, sinon les messages bloquants du compte. */
function motifContenuBloque(compte: ContenuAvisCompte, mandat: MandatPrelevement | null | undefined, ecart: EcartPrelevement): string {
  if (ecart.codes.includes('mandat_incomplet') && mandat) {
    if (!validerIban(mandat.iban)) return 'IBAN du mandat invalide'
    if (!mandat.rum.trim()) return 'RUM absente'
  }
  const messages = compte.anomalies.filter((a) => a.gravite === 'bloquant').map((a) => a.message)
  return messages.length > 0 ? messages.join(' ') : 'Avis bloqué : débit non annoncé.'
}

const MOTIFS_LOT: Record<MotifExclusion, string> = {
  solde_nul: 'Rien à prélever',
  contentieux: 'Compte en contentieux : prélèvement suspendu',
  iban_invalide: 'IBAN du mandat invalide',
  rum_absente: 'RUM absente',
}

function ligneEcartee(ecart: EcartPrelevement, compte: ContenuAvisCompte, mandat: MandatPrelevement | null | undefined): LignePrelevement | null {
  const base = { compteId: compte.compteId, libelle: compte.libelleCompte, numeroCompte: compte.numeroCompte }
  const montant = compte.instructions?.mode === 'Prélèvement' ? compte.instructions.montantCentimes : 0
  switch (ecart.motif) {
    case 'mode_reglement':
      return null
    case 'contentieux':
      return { ...base, montantCentimes: 0, etat: 'exclu', motif: MOTIFS_LOT.contentieux }
    case 'compte_non_syndicat':
      return { ...base, montantCentimes: 0, etat: 'exclu', motif: 'Prélèvement non annoncé : le compte qui reçoit les règlements n’est pas établi au nom du syndicat' }
    case 'montant_nul':
      return { ...base, montantCentimes: 0, etat: 'exclu', motif: MOTIFS_LOT.solde_nul }
    case 'prenotification_absente':
      return ecart.codes.length === 0
        ? { ...base, montantCentimes: montant, etat: 'attente_diffusion', motif: "En attente de la diffusion de l'avis (pré-notification)" }
        : { ...base, montantCentimes: montant, etat: 'exclu', motif: `Pré-notification impossible (${ecart.codes.join(', ')})` }
    case 'contenu_bloque':
      return { ...base, montantCentimes: 0, etat: 'exclu', motif: motifContenuBloque(compte, mandat, ecart) }
  }
}

/** Lot de prélèvements tiré de l'avis (préavis, mentions bloquantes), sans diffusion : rien n'est pré-notifié. */
function vuePrelevements(contenu: ContenuAvisAppel, d: DonneesAppels, prefixeId: string): VuePrelevements {
  const { echeances, ecartees } = echeancesPrelevementDepuisAvis(contenu, { prefixeId, diffusions: [], comptesEnContentieux: d.comptesEnContentieux })
  const lot = preparerLotPrelevements(echeances)
  const lignes: LignePrelevement[] = []
  for (const compte of contenu.parCompte) {
    const ecart = ecartees.find((e) => e.compteId === compte.compteId)
    const mandat = d.comptes.find((c) => c.id === compte.compteId)?.reglement?.mandat
    const exclue = lot.exclues.find((e) => e.id.endsWith(`-${compte.serie}`))
    const retenue = lot.retenues.find((r) => r.compteCoproprietaire === compte.numeroCompte)
    const base = { compteId: compte.compteId, libelle: compte.libelleCompte, numeroCompte: compte.numeroCompte }
    if (ecart) {
      const ligne = ligneEcartee(ecart, compte, mandat)
      if (ligne) lignes.push(ligne)
    } else if (retenue) lignes.push({ ...base, montantCentimes: retenue.montantCentimes, etat: 'retenu', motif: null })
    else if (exclue) lignes.push({ ...base, montantCentimes: 0, etat: 'exclu', motif: MOTIFS_LOT[exclue.motif] })
  }
  return { lot, lignes }
}

const reglementsDe = (comptes: readonly CompteAppel[]): ReglementCompte[] =>
  comptes.flatMap((c) => (c.reglement ? [{ ...c.reglement, compteId: c.id }] : []))

/** Contenu de l'avis et lot de prélèvements ; une donnée illisible (mandat mal formé) donne une erreur, pas d'exception. */
function contenuEtPrelevements(avis: AvisAppels, d: DonneesAppels, c: ContexteAppel): Pick<VueAvisAppel, 'contenu' | 'prelevements' | 'erreur'> {
  try {
    const contenu = contenuAvisAppel(avis, {
      cles: [...d.cles],
      comptes: [...d.comptes],
      segmentSyndicat: c.segmentSyndicat,
      syndicat: c.syndicat,
      compteEncaissement: compteEncaissement(d.modeComptes, d.banques),
      ics: c.ics,
      dateEmission: c.dateEmission,
      reglements: reglementsDe(d.comptes),
      datePrelevement: c.datePrelevement,
      administrateurProvisoire: c.administrateurProvisoire,
      comptesEnContentieux: d.comptesEnContentieux,
    })
    return { contenu, prelevements: vuePrelevements(contenu, d, `${c.segmentSyndicat}-${c.jusquAu.replaceAll('-', '')}`), erreur: null }
  } catch (erreur) {
    return { contenu: null, prelevements: null, erreur: `Avis non établi : ${erreur instanceof Error ? erreur.message : String(erreur)}` }
  }
}

/** Aperçu de l'écriture (identifiant provisoire) et contrôle de sa date comptable. */
function ecritureDe(avis: AvisAppels, d: DonneesAppels, c: ContexteAppel) {
  const date = dateComptableAppel(avis)
  const ecriture = traitementAppelDeFonds(avis, {
    id: 'apercu',
    date,
    segmentSyndicat: c.segmentSyndicat,
    comptes: [...d.comptes],
    sousComptes450: c.sousComptes450 ?? null,
  })
  const controleDate = controlerDateComptableAppel(ecriture, avis, d.exercices)
  const manquant = controleDate.find((a) => a.code === 'exigibilite_hors_exercice')
  return {
    ecriture,
    equilibre: equilibreDe(ecriture),
    dateComptable: date,
    controleDate,
    exerciceManquant: manquant ? (avis.echeances.find((e) => e.id === manquant.echeanceId)?.exigibilite ?? null) : null,
  }
}

const VUE_VIDE: Omit<VueAvisAppel, 'echeances'> = {
  avis: null,
  anomalies: [],
  contenu: null,
  erreur: null,
  ecriture: null,
  equilibre: null,
  dateComptable: null,
  controleDate: [],
  exerciceManquant: null,
  blocage: null,
  prelevements: null,
}

/** « « A » », « « A » et « B » », « « A », « B » et « C » » ; espaces insécables dans les guillemets (pas de « » seul en début de ligne). */
function listeEntreGuillemets(libelles: readonly string[]): string {
  const cites = libelles.map((l) => `« ${l} »`)
  return cites.length > 1 ? `${cites.slice(0, -1).join(', ')} et ${cites.at(-1)}` : (cites[0] ?? '')
}

/**
 * Message qui bloque l'écriture. Exercice à ouvrir : une seule phrase, avec les libellés des échéances et non leurs
 * identifiants (défaut 3 du 22/11/2026) ; les autres refus de la date comptable suivent, tels que le domaine les écrit.
 */
function blocageDe(anomalies: readonly string[], controleDate: readonly AnomalieDateComptableAppel[], echeances: readonly EcheanceAppelSuivie[]): string | null {
  if (anomalies.length > 0) {
    const n = anomalies.length
    return `Appel non écrit : ${n} anomalie${n > 1 ? 's' : ''} de répartition à lever d'abord.`
  }
  const refus = controleDate.filter((a) => a.gravite === 'bloquant')
  if (refus.length === 0) return null
  const horsExercice = refus.filter((a) => a.code === 'exigibilite_hors_exercice')
  const libelleDe = (id: string) => echeances.find((e) => e.id === id)?.libelle ?? id
  const exercice =
    horsExercice.length > 0
      ? `Exercice à ouvrir : aucun exercice du syndicat ne comprend l’exigibilité de ${listeEntreGuillemets([...new Set(horsExercice.map((a) => libelleDe(a.echeanceId)))])}.`
      : null
  return [exercice, ...refus.filter((a) => a.code !== 'exigibilite_hors_exercice').map((a) => a.message)].filter(Boolean).join(' ')
}

/** Avis de l'appel choisi, écriture en aperçu, contrôles et prélèvements. */
export function vueAvisAppel(d: DonneesAppels, c: ContexteAppel): VueAvisAppel {
  let echeances: EcheanceAppelSuivie[] = []
  try {
    echeances = echeancesAAppeler([...d.echeances], { jusquAu: c.jusquAu })
    if (echeances.length === 0) return { ...VUE_VIDE, echeances }
    const avis = avisDAppel({ echeances, cles: [...d.cles], positions: [...d.positions], comptes: [...d.comptes] })
    const anomalies = avis.anomalies.map((a) => texteAnomalie(a, d, echeances))
    if (anomalies.length > 0) return { ...VUE_VIDE, echeances, avis, anomalies, blocage: blocageDe(anomalies, [], echeances) }
    const ecriture = ecritureDe(avis, d, c)
    return { ...VUE_VIDE, echeances, avis, anomalies, ...ecriture, blocage: blocageDe([], ecriture.controleDate, echeances), ...contenuEtPrelevements(avis, d, c) }
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur)
    return { ...VUE_VIDE, echeances, erreur: message, blocage: 'Appel non écrit : avis impossible à établir sur les données enregistrées.' }
  }
}

export interface PersonneEnPlace {
  positionId: string
  nom: string
  qualite: string
  /** Part du droit (« 1/2 ») ; vide hors qualité de copropriété. */
  part: string
  /** Série du compte ; vide sans compte. */
  serie: string
}

export interface DroitsLot {
  lotId: string
  numero: string
  enPlace: PersonneEnPlace[]
  /** Premier défaut des droits (controlerDroitsLot), sans point final (pastille) ; null : droits complets. */
  anomalie: string | null
  /** Vente ce jour-là : l'appel exigible ce jour va au vendeur (D. 1967 art. 6-2). */
  venteCeJour: boolean
  /** Vente ce jour-là : vendeurs appelés (positions de la veille qui sortent ce jour), avec leur compte ; vide sinon. */
  vendeurs: PersonneEnPlace[]
}

/** « Droits sur les lots » à la date : personnes en place, contrôle des droits, vente du jour et vendeur appelé. */
export function vueDroitsLots(d: Pick<DonneesAppels, 'lots' | 'positions' | 'identites' | 'comptes'>, date: string): DroitsLot[] {
  const personne = (p: Position): PersonneEnPlace => ({
    positionId: p.id,
    nom: nomIdentite(d.identites.find((i) => i.id === p.identiteId)),
    qualite: p.qualite,
    part: p.part ? `${p.part.numerateur}/${p.part.denominateur}` : '',
    serie: d.comptes.find((c) => c.id === p.compteId)?.serie ?? '',
  })
  return [...d.lots]
    .sort((a, b) => a.numero.localeCompare(b.numero, 'fr', { numeric: true }))
    .map((lot) => {
      const enPlace = positionsEnPlace([...d.positions], lot.id, date)
      const vente = mutationDuJour([...d.positions], lot.id, date)
      return {
        lotId: lot.id,
        numero: lot.numero,
        enPlace: enPlace.map(personne),
        anomalie: controlerDroitsLot(enPlace)[0]?.message.replace(/\.$/, '') ?? null,
        venteCeJour: vente.mutation,
        vendeurs: vente.mutation ? vente.veille.filter((p) => p.dateSortie === date).map(personne) : [],
      }
    })
}

export interface IndicateursAppels {
  aAppelerNombre: number
  aAppelerCentimes: number
  appeleCentimes: number
  prochaineExigibilite: string | null
  comptes: number
}

/** Indicateurs de l'écran, sur l'échéancier du syndicat. */
export function indicateursAppels(echeances: readonly EcheanceAppelSuivie[], comptes: readonly unknown[]): IndicateursAppels {
  const prevues = echeances.filter((e) => e.statut === 'Prévu')
  return {
    aAppelerNombre: prevues.length,
    aAppelerCentimes: prevues.reduce((s, e) => s + e.montantCentimes, 0),
    appeleCentimes: echeances.filter((e) => e.statut === 'Appelé').reduce((s, e) => s + e.montantCentimes, 0),
    prochaineExigibilite: exigibilitesAAppeler(echeances)[0] ?? null,
    comptes: comptes.length,
  }
}
