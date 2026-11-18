import { repartirAuxPlusFortsRestes } from '@/lib/administrateur-judiciaire/domain/arrondis'
import { ajouterJours, composerDateIso, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  numeroCompteCoproprietaire,
  positionsEnPlace,
  estQualiteCopropriete,
  type CompteCoproprietaire,
  type Position,
} from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { creerTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Répartition des charges et avis d'appel (cartographie Gestéam, tranches 21, 25 et 30). Fonctions pures, montants en
 * CENTIMES ENTIERS, sans écran.
 *
 * D1 — clés, échéances et comptes appartiennent au SYNDICAT. D2 — l'avis d'appel s'adresse au COMPTE copropriétaire qui
 * détient les droits de propriété du lot à la date d'exigibilité (positions en place), sauf mutation du lot ce jour-là
 * (ci-dessous).
 *
 * Gestéam — l'échéance d'appel porte (mandat, clé, exercice ou travaux / tranche, exigibilité) ; l'avis d'appel d'un
 * copropriétaire liste, par clé, sa quote-part (tantièmes du lot / total de la clé), le solde antérieur et le total.
 * Arrondi : plus forts restes, la somme des quotes-parts égale exactement l'échéance (aucun centime perdu ni créé).
 * 🔵 Comptes de contrepartie par défaut : 70100 (provisions, budget), 10500 (fonds de travaux, compte observé tranche
 *    25) ; remplaçables par échéance. Travaux : 10200, le 102 « crédité des provisions appelées par le débit du compte
 *    450 » (arrêté du 14 mars 2005, art. 10 ; décision de Hugo du 17/11/2026, J67, R61), viré au 702 au fil des charges
 *    (travaux-operations.ts).
 * 🔵 Une échéance à 0 centime (tranche de travaux entièrement financée par le fonds de travaux) reste dans l'avis (l'avis
 *    du n° 17 y rattache l'emploi du fonds) mais n'écrit aucune ligne : débits et crédits nuls sont omis de l'écriture.
 *
 * Mutation du lot le jour de l'exigibilité — décision de Hugo Carvalho du 30/10/2026 : l'appel est dû par le VENDEUR.
 * 🟢 Relu sur Légifrance le 30/10/2026 :
 * - D. 1967 art. 6-2 (en vigueur depuis le 25/12/2025, modifié par le décret n° 2025-1292, art. 3 ; même texte, au renvoi
 *   près — « troisième alinéa de l'article 14-1 » —, du 01/09/2004 au 25/12/2025) : « A l'occasion de la mutation à titre
 *   onéreux d'un lot : 1° Le paiement de la provision exigible du budget prévisionnel, en application du troisième alinéa
 *   du I de l'article 14-1 de la loi du 10 juillet 1965, incombe au vendeur ; 2° Le paiement des provisions des dépenses
 *   non comprises dans le budget prévisionnel incombe à celui, vendeur ou acquéreur, qui est copropriétaire au moment de
 *   l'exigibilité » ; art. 6-3 : « Toute convention contraire aux dispositions de l'article 6-2 n'a d'effet qu'entre les
 *   parties à la mutation à titre onéreux » (🔵 l'avis d'appel suit donc l'art. 6-2, quelle que soit la clause de
 *   l'acte) ;
 * - L. 1965 art. 14-1, I, al. 3 : « La provision est exigible le premier jour de chaque trimestre ou le premier jour de
 *   la période fixée par l'assemblée générale » ; II : les sommes afférentes aux dépenses pour travaux hors budget « sont
 *   exigibles selon les modalités votées par l'assemblée générale » ;
 * - art. 14-2-1, I, al. 6 : « Ce fonds de travaux est alimenté par une cotisation annuelle obligatoire. Chaque
 *   copropriétaire contribue au fonds selon les mêmes modalités que celles décidées par l'assemblée générale pour le
 *   versement des provisions du budget prévisionnel. » ; même renvoi dans l'ancien art. 14-2, II (rédaction en vigueur
 *   du 25/11/2018 au 01/01/2023) : cotisation « versée par les copropriétaires selon les mêmes modalités ».
 * Règle, par nature d'échéance :
 * - budget : vendeur (art. 6-2, 1°) 🟢 ;
 * - fonds de travaux : vendeur, la cotisation suivant le régime des provisions du budget (art. 14-2-1, I, al. 6) 🔵 ;
 * - travaux hors budget (art. 6-2, 2°) : vendeur, 🔵 déduit et décision de Hugo — la somme est exigible dès le début du
 *   jour fixé, quand le vendeur est encore copropriétaire.
 * 🔵 Mutation, dans le modèle (identites-positions.muterLot, positions semi-ouvertes) : sur le même lot, une position de
 * copropriété en place la veille sort le jour même et une autre y entre ; les comptes redevables sont alors ceux des
 * positions de copropriété en place la veille (indivision, démembrement : toutes les positions du vendeur, un seul compte
 * attendu — D2). Sans cette succession, rien ne change : première position d'un lot ou position de reprise (aucune ne
 * sort ce jour-là), sortie sans entrée (lot sans compte), entrée au statut « Futur » (jamais en place) ; une
 * réorganisation sous le même compte laisse le même redevable ; exigible la veille ou le lendemain : inchangé. Cohérent
 * avec fonds-travaux-lots.fondsTravauxALaMutation (vendeur en place la veille, appels du fonds exigibles au plus tard le
 * jour de la mutation dus par lui) ; postesDepuisAvis et l'imputation des encaissements lisent le compte porté par l'avis.
 * Décision de Hugo du 17/11/2026 (registre des décisions juridiques, J67 ; textes relus sur Légifrance le 17/11/2026) :
 * - J67, R87 : cotisation au fonds exigible du 01/01/2017 au 25/11/2018 : même règle qu'ensuite (ancien art. 14-2,
 *   rédaction du 01/01/2017 au 25/11/2018 ; pour un appel exigible au plus tard le jour de la mutation, les 1° et 2° de
 *   l'art. 6-2 désignent tous deux le vendeur) ; avant le 01/01/2017, aucun fonds de travaux légal (fonds-travaux.ts,
 *   CREATION_FONDS_TRAVAUX). Mutation le jour d'une exigibilité antérieure au 01/09/2004 (avant l'art. 6-2, créé par le
 *   décret n° 2004-479, art. 5 ; règle de l'époque non relue, créances de cet âge très probablement prescrites : L. 1965
 *   art. 42, al. 1) : hors champ, l'appel n'est porté à aucun compte (anomalie mutation_avant_art_6_2).
 * 🔴 Non établi :
 * - mutation à titre gratuit (donation, succession) : l'art. 6-2 ne vise que la mutation à titre onéreux, et le modèle ne
 *   distingue pas la nature de la mutation (muterLot n'en porte aucune) ; la règle du vendeur est appliquée à toute
 *   mutation. Question : qui doit la provision exigible le jour d'une mutation à titre gratuit ?
 */

export interface LotCle {
  lotId: string
  tantiemes: number
}

export interface CleRepartition {
  id: string
  coproprieteId: string
  code: string
  libelle: string
  lots: LotCle[]
  totalTantiemes: number
}

export function creerCleRepartition(saisie: Omit<CleRepartition, 'totalTantiemes'>): CleRepartition {
  if (saisie.lots.length === 0) throw new Error(`Clé ${saisie.code} : aucun lot.`)
  const vus = new Set<string>()
  for (const l of saisie.lots) {
    if (vus.has(l.lotId)) throw new Error(`Clé ${saisie.code} : lot ${l.lotId} en double.`)
    vus.add(l.lotId)
    if (!Number.isInteger(l.tantiemes) || l.tantiemes <= 0) throw new Error(`Clé ${saisie.code} : tantièmes invalides pour le lot ${l.lotId}.`)
  }
  return { ...saisie, totalTantiemes: saisie.lots.reduce((s, l) => s + l.tantiemes, 0) }
}

/** Répartit un montant au tantième, au centime près (plus forts restes, départage par l'ordre des lots de la clé). */
export function repartir(montantCentimes: number, cle: CleRepartition): { lotId: string; centimes: number }[] {
  if (!Number.isInteger(montantCentimes) || montantCentimes < 0)
    throw new Error(`Montant invalide (${montantCentimes}) : centimes entiers positifs attendus.`)
  const parts = repartirAuxPlusFortsRestes(montantCentimes, cle.lots.map((l) => l.tantiemes))
  return cle.lots.map((l, i) => ({ lotId: l.lotId, centimes: parts[i] }))
}

export type NatureEcheance = 'budget' | 'travaux' | 'fonds_travaux'

const CONTREPARTIE_PAR_DEFAUT: Record<NatureEcheance, string> = { budget: '70100', travaux: '10200', fonds_travaux: '10500' }

/** Code du plan crédité par l'appel de l'échéance : le sien, à défaut celui de sa nature. */
export const codeContrepartie = (e: Pick<EcheanceAppel, 'nature' | 'compteContrepartie'>): string =>
  e.compteContrepartie ?? CONTREPARTIE_PAR_DEFAUT[e.nature]

export interface EcheanceAppel {
  id: string
  coproprieteId: string
  cleId: string
  exigibilite: string
  libelle: string
  montantCentimes: number
  nature: NatureEcheance
  /** Code du plan crédité (5 caractères) ; à défaut, celui de la nature. */
  compteContrepartie?: string
}

export interface LigneAvis {
  echeanceId: string
  lotId: string
  cle: string
  centimes: number
}

export interface AvisCompte {
  compteId: string
  lignes: LigneAvis[]
  totalAppeleCentimes: number
  soldeAnterieurCentimes: number
  totalAPayerCentimes: number
}

export interface AnomalieAppel {
  /** mutation_avant_art_6_2 : mutation le jour d'une exigibilité antérieure à l'art. 6-2, hors champ (J67, R87). */
  code: 'cle_inconnue' | 'lot_sans_compte' | 'comptes_multiples' | 'mutation_avant_art_6_2'
  echeanceId: string
  lotId: string | null
}

export interface AvisAppels {
  echeances: EcheanceAppel[]
  parCompte: AvisCompte[]
  anomalies: AnomalieAppel[]
}

/** Positions de copropriété en place sur le lot à la date (semi-ouvertes : sorties le jour de leur sortie). */
const proprietairesEnPlace = (positions: Position[], lotId: string, date: string): Position[] =>
  positionsEnPlace(positions, lotId, date).filter((p) => estQualiteCopropriete(p.qualite))

/** D. 1967 art. 6-2, créé par le décret n° 2004-479 (art. 5), en vigueur le 01/09/2004 (J67, R87). */
export const ENTREE_EN_VIGUEUR_ART_6_2 = composerDateIso(2004, 9, 1)

/**
 * Comptes redevables de la quote-part du lot exigible à `exigibilite` : ceux des positions de copropriété en place ce
 * jour-là ; si le lot mute ce jour-là (une position de copropriété en place la veille sort, une autre entre), ceux des
 * positions en place la veille : le vendeur (D. 1967 art. 6-2 ; décision du 30/10/2026, voir l'en-tête). `mutation` :
 * le lot mute ce jour-là.
 */
function comptesRedevables(positions: Position[], lotId: string, exigibilite: string): { comptes: Set<string>; mutation: boolean } {
  const duJour = proprietairesEnPlace(positions, lotId, exigibilite)
  const veille = proprietairesEnPlace(positions, lotId, ajouterJours(exigibilite, -1))
  const mutation = duJour.some((p) => p.dateEntree === exigibilite) && veille.some((p) => p.dateSortie === exigibilite)
  return { comptes: new Set((mutation ? veille : duJour).map((p) => p.compteId as string)), mutation }
}

/** Anomalie d'une quote-part qui n'est portée à aucun compte : mutation avant l'art. 6-2 (J67, R87), ou titulaires ≠ 1. */
function anomalieDuTitulaire(redevables: { comptes: Set<string>; mutation: boolean }, exigibilite: string): AnomalieAppel['code'] | null {
  if (redevables.mutation && exigibilite < ENTREE_EN_VIGUEUR_ART_6_2) return 'mutation_avant_art_6_2'
  if (redevables.comptes.size === 1) return null
  return redevables.comptes.size === 0 ? 'lot_sans_compte' : 'comptes_multiples'
}

/**
 * Avis d'appel par compte : quotes-parts des lots détenus à chaque exigibilité (au vendeur, si le lot mute ce jour-là),
 * solde antérieur, total à payer.
 */
export function avisDAppel({
  echeances,
  cles,
  positions,
  comptes,
  soldesAnterieurs = {},
}: {
  echeances: EcheanceAppel[]
  cles: CleRepartition[]
  positions: Position[]
  comptes: CompteCoproprietaire[]
  soldesAnterieurs?: Record<string, number>
}): AvisAppels {
  const lignes = new Map<string, LigneAvis[]>()
  const anomalies: AnomalieAppel[] = []
  for (const echeance of echeances) {
    if (!estDateIsoValide(echeance.exigibilite))
      throw new Error(`Échéance « ${echeance.id} » : date d'exigibilité invalide (${echeance.exigibilite}) : AAAA-MM-JJ attendu.`)
    const cle = cles.find((c) => c.id === echeance.cleId)
    if (!cle) {
      anomalies.push({ code: 'cle_inconnue', echeanceId: echeance.id, lotId: null })
      continue
    }
    for (const part of repartir(echeance.montantCentimes, cle)) {
      const redevables = comptesRedevables(positions, part.lotId, echeance.exigibilite)
      const code = anomalieDuTitulaire(redevables, echeance.exigibilite)
      if (code) {
        anomalies.push({ code, echeanceId: echeance.id, lotId: part.lotId })
        continue
      }
      const [compteId] = redevables.comptes
      lignes.set(compteId, [...(lignes.get(compteId) ?? []), { echeanceId: echeance.id, lotId: part.lotId, cle: cle.code, centimes: part.centimes }])
    }
  }
  const ordre = (id: string) => comptes.find((c) => c.id === id)?.serie ?? id
  const parCompte = [...lignes.entries()]
    .sort(([a], [b]) => ordre(a).localeCompare(ordre(b)))
    .map(([compteId, l]) => {
      const totalAppeleCentimes = l.reduce((s, x) => s + x.centimes, 0)
      const soldeAnterieurCentimes = soldesAnterieurs[compteId] ?? 0
      return { compteId, lignes: l, totalAppeleCentimes, soldeAnterieurCentimes, totalAPayerCentimes: totalAppeleCentimes + soldeAnterieurCentimes }
    })
  return { echeances, parCompte, anomalies }
}

/**
 * Écriture de l'appel (famille « Appel de fonds ») : débit des comptes 450, crédit des comptes de contrepartie ; une
 * ligne nulle (échéance à 0 centime) n'est pas écrite.
 */
export function traitementAppelDeFonds(
  avis: AvisAppels,
  { id, date, segmentSyndicat, comptes }: { id: string; date: string; segmentSyndicat: string; comptes: CompteCoproprietaire[] },
): Traitement {
  if (avis.anomalies.length > 0) throw new Error(`Appel non écrit : ${avis.anomalies.length} anomalie(s) à lever d'abord.`)
  const debits = avis.parCompte.map((a) => {
    const compte = comptes.find((c) => c.id === a.compteId)
    if (!compte) throw new Error(`Compte copropriétaire introuvable : « ${a.compteId} ».`)
    return { compte: numeroCompteCoproprietaire(compte, segmentSyndicat), sens: 'debit' as const, montantCentimes: a.totalAppeleCentimes }
  })
  const credits = new Map<string, number>()
  for (const e of avis.echeances) {
    if (e.montantCentimes === 0) continue
    const code = codeContrepartie(e)
    credits.set(code, (credits.get(code) ?? 0) + e.montantCentimes)
  }
  return creerTraitement({
    id,
    famille: 'Appel de fonds',
    date,
    mouvements: [
      ...debits.filter((d) => d.montantCentimes > 0),
      ...[...credits.entries()].map(([code, montantCentimes]) => ({
        compte: `${segmentSyndicat}.${code}.00000.0`,
        sens: 'credit' as const,
        montantCentimes,
      })),
    ],
  })
}
