import { dateVersIso, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  migrerCoproprietaire,
  type CompteCoproprietaire,
  type Identite,
  type Position,
} from '@/lib/administrateur-judiciaire/domain/identites-positions'

/**
 * Migration D2 des anciennes fiches copropriétaire (table `coproprietaires` : une fiche par lot, qui mêle identité,
 * position et compte) vers les tables de la version 3 (identites, comptesCoproprietaires, positions). Plan pur, rejoué
 * à chaque appel : l'écriture (db/migration-d2.ts) le calcule et l'applique dans une seule transaction.
 *
 * Règles (aucune règle juridique nouvelle : migrerCoproprietaire fait la conversion) :
 * - une fiche = une identité + un compte + une position de copropriétaire en place, part 1/1 (migrerCoproprietaire,
 *   identifiants id-, cpt-, pos- suivis de celui de la fiche). Aucune fusion de personnes : la même personne sur deux
 *   lots donne deux identités (rapprochement de doublons : choix de l'utilisateur, plus tard). « Un compte par fiche »
 *   vient de migrerCoproprietaire et s'écarte de D2 pour l'indivision (un seul compte) et la mutation (position du vendeur
 *   close) jusqu'à la correction : les lots à plusieurs fiches sont rendus « à régulariser » ;
 * - nature « physique », sans déduction (fixée par migrerCoproprietaire) : une personne morale migrée (« SCI … ») ne
 *   peut pas recevoir de représentant légal avant sa correction ; aucune case « professionnel » (J78 : non saisie) ;
 *   téléphone et courriel en télécoms, sans valeur de notification (aucune adresse électronique de notification datée) ;
 * - série du compte : à la suite du plus grand numéro numérique pris dans le syndicat, par un compte en base ou par un
 *   compte que le journal d'activité garde (état avant et après : compte supprimé ou renuméroté depuis, seriesDuJournal),
 *   fiches triées par n° de lot, nom, identifiant (même résultat d'un appel à l'autre). Une série prise n'est donc
 *   jamais redonnée à un autre débiteur (D2 : le numéro du compte désigne le débiteur). Limite : une base vidée (mode
 *   réel, démonstration restaurée) repart sans journal ; une ligne écrite hors de l'application n'y laisse pas de trace ;
 * - date d'entrée : la première ordonnance des mandats du syndicat (date locale, dateVersIso), à défaut le jour de
 *   création de la fiche ; marquée à vérifier (ReprisePosition) ;
 * - solde et statut : gardés sur le compte comme donnée de reprise (RepriseSoldeCompte : centimes, positifs quand ils
 *   sont dus ; statut tel quel ; jour du relevé), sans aucune écriture comptable ; le solde de la fiche continue
 *   d'évoluer avec la trésorerie (imputerEncaissement), le relevé non ;
 * - déjà migrée (une de ses trois lignes existe, ou le journal d'activité en garde la trace : ligne supprimée depuis) :
 *   ignorée, jamais recréée ni mise à jour ;
 * - fiche invalide (identifiant absent, lot introuvable, nom vide, champ non texte, solde non numérique, date d'entrée
 *   introuvable, plus de série libre) : écartée avec son motif, les autres sont migrées.
 */

/** Trace de la reprise sur la position : d'où vient la date d'entrée (à vérifier). */
export interface ReprisePosition {
  coproprietaireId: string
  /** Première ordonnance des mandats du syndicat, ou, sans mandat, jour de création de l'ancienne fiche. */
  origineDateEntree: 'ordonnance' | 'creation_fiche'
}

/** Solde et statut de l'ancienne fiche relevés à la migration, gardés sur le compte (aucune écriture comptable). */
export interface RepriseSoldeCompte {
  coproprietaireId: string
  /** Solde de la fiche en centimes, positif quand il est dû (la fiche : euros, négatif = dette). */
  soldeDuCentimes: number
  /** Statut de la fiche (« À jour », « Impayé », « Contentieux »…), tel quel. */
  statutFiche: string
  /** Jour du relevé (AAAA-MM-JJ) : le solde de la fiche peut avoir changé depuis. */
  releveLe: string
}

export interface LigneMigrationD2 {
  coproprietaireId: string
  identite: Identite
  compte: CompteCoproprietaire & { reprise: RepriseSoldeCompte }
  position: Position & { reprise: ReprisePosition }
}

export interface FicheEcartee {
  coproprietaireId: string
  motif: string
}

export interface LotARegulariser {
  lotId: string
  coproprietaireIds: string[]
  motif: string
}

export interface EntreesMigrationD2 {
  /** Anciennes fiches telles que lues en base : leurs champs sont contrôlés ici. */
  fiches: readonly Record<string, unknown>[]
  lots: readonly { id: string; coproprieteId: string; numero: string }[]
  /** Mandats (ordonnance : Date locale). */
  mandats: readonly { coproprieteId: string; ordonnance: unknown }[]
  /** Séries prises : comptes copropriétaires en base, et ceux que le journal d'activité garde (seriesDuJournal). */
  comptes: readonly Pick<CompteCoproprietaire, 'coproprieteId' | 'serie'>[]
  /** Identifiants déjà connus : lignes D2 en base et entités du journal d'activité. */
  idsConnus: ReadonlySet<string>
  /** Jour de la migration (AAAA-MM-JJ, contrôlé) : jour du relevé du solde sur chaque compte créé. */
  aujourdhui: string
}

export interface PlanMigrationD2 {
  aCreer: LigneMigrationD2[]
  dejaMigrees: string[]
  ecartees: FicheEcartee[]
  lotsARegulariser: LotARegulariser[]
}

/**
 * Identifiants des lignes D2 d'une fiche, avant de la migrer (pour savoir si elle l'est déjà) : ceux que pose
 * migrerCoproprietaire (le test migration-d2.test.ts vérifie qu'ils restent identiques).
 */
export const idsMigration = (coproprietaireId: string): { identite: string; compte: string; position: string } => ({
  identite: `id-${coproprietaireId}`,
  compte: `cpt-${coproprietaireId}`,
  position: `pos-${coproprietaireId}`,
})

/**
 * Séries que le journal d'activité des comptes copropriétaires garde (entrées de l'entité « comptesCoproprietaires » :
 * état avant et après de chaque création, modification et suppression), pour qu'une série sortie (compte supprimé ou
 * renuméroté) ne soit jamais redonnée. Un état illisible (ligne écrite hors de l'application) est ignoré. Fonction pure.
 */
export function seriesDuJournal(
  entrees: readonly { avant: unknown; apres: unknown }[],
): Pick<CompteCoproprietaire, 'coproprieteId' | 'serie'>[] {
  const series: Pick<CompteCoproprietaire, 'coproprieteId' | 'serie'>[] = []
  for (const { avant, apres } of entrees)
    for (const etat of [avant, apres]) {
      if (etat === null || typeof etat !== 'object') continue
      const { coproprieteId, serie } = etat as Record<string, unknown>
      if (typeof coproprieteId === 'string' && typeof serie === 'string') series.push({ coproprieteId, serie })
    }
  return series
}

const SERIE_MAX = 99_999
const MOTIF_SERIE_ILLISIBLE = 'Série illisible sur un compte copropriétaire du syndicat : à corriger avant de reprendre la fiche.'
const MOTIF_LOT_A_REGULARISER =
  "Plusieurs fiches sur le lot : indivision ou mutation à régulariser (D2 : une indivision = un seul compte ; une mutation clôt la position du vendeur). La migration a ouvert une position 1/1 et un compte par fiche (migrerCoproprietaire) ; les droits du lot sont en anomalie (controlerDroitsLot)."

interface FicheValide {
  rang: number
  id: string
  lotId: string
  nom: string
  tel: string
  mail: string
  statut: string
  solde: number
  createdAt: unknown
  lot: { id: string; coproprieteId: string; numero: string }
}

/** Texte d'un champ : absent (undefined, null) → vide ; autre chose qu'un texte → motif. */
function texte(fiche: Record<string, unknown>, champ: string, obligatoire: boolean): string | { motif: string } {
  const valeur = fiche[champ]
  if (!obligatoire && (valeur === undefined || valeur === null)) return ''
  return typeof valeur === 'string' ? valeur : { motif: `Champ « ${champ} » : texte attendu (reçu ${JSON.stringify(valeur) ?? String(valeur)}).` }
}

function valider(fiche: Record<string, unknown>, rang: number, lots: EntreesMigrationD2['lots']): FicheValide | { motif: string } {
  const champs: Record<string, string> = {}
  for (const [champ, obligatoire] of [
    ['lotId', true],
    ['nom', true],
    ['tel', false],
    ['mail', false],
    ['statut', false],
  ] as const) {
    const lu = texte(fiche, champ, obligatoire)
    if (typeof lu !== 'string') return lu
    champs[champ] = lu
  }
  const solde = fiche.solde
  if (typeof solde !== 'number' || !Number.isFinite(solde)) return { motif: `Solde non numérique (reçu ${JSON.stringify(solde) ?? String(solde)}).` }
  const lot = lots.find((l) => l.id === champs.lotId)
  if (!lot) return { motif: `Lot introuvable (id=${champs.lotId}).` }
  return {
    rang,
    id: fiche.id as string,
    lotId: champs.lotId,
    nom: champs.nom,
    tel: champs.tel,
    mail: champs.mail,
    statut: champs.statut,
    solde,
    createdAt: fiche.createdAt,
    lot,
  }
}

/** Première ordonnance des mandats de chaque syndicat (date locale). */
function premieresOrdonnances(mandats: EntreesMigrationD2['mandats']): Map<string, string> {
  const premieres = new Map<string, string>()
  for (const m of mandats) {
    const date = dateVersIso(m.ordonnance)
    if (date === null) continue
    const actuelle = premieres.get(m.coproprieteId)
    if (actuelle === undefined || date < actuelle) premieres.set(m.coproprieteId, date)
  }
  return premieres
}

function dateEntree(f: FicheValide, ordonnances: Map<string, string>): { date: string; origine: ReprisePosition['origineDateEntree'] } | null {
  const ordonnance = ordonnances.get(f.lot.coproprieteId)
  if (ordonnance !== undefined) return { date: ordonnance, origine: 'ordonnance' }
  const creation = typeof f.createdAt === 'string' ? dateVersIso(new Date(f.createdAt)) : null
  return creation === null ? null : { date: creation, origine: 'creation_fiche' }
}

const normaliserSerie = (serie: string): string => serie.trim().toUpperCase().padStart(5, '0')

const comparer = (a: FicheValide, b: FicheValide): number =>
  a.lot.coproprieteId.localeCompare(b.lot.coproprieteId) ||
  a.lot.numero.localeCompare(b.lot.numero, 'fr', { numeric: true }) ||
  a.nom.localeCompare(b.nom, 'fr') ||
  a.id.localeCompare(b.id)

/**
 * Lots touchés par la migration (une ligne créée) qui portent plusieurs fiches : indivision ou mutation à régulariser.
 * Fiches de chaque lot dans l'ordre des identifiants, lots dans l'ordre des identifiants.
 */
function lotsARegulariserDe(fiches: EntreesMigrationD2['fiches'], aCreer: readonly LigneMigrationD2[]): LotARegulariser[] {
  const lotsTouches = new Set(aCreer.map((l) => l.position.lotId))
  const parLot = new Map<string, string[]>()
  for (const fiche of fiches)
    if (typeof fiche.lotId === 'string' && lotsTouches.has(fiche.lotId) && typeof fiche.id === 'string')
      parLot.set(fiche.lotId, [...(parLot.get(fiche.lotId) ?? []), fiche.id])
  return [...parLot.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([lotId, ids]) => ({ lotId, coproprietaireIds: [...ids].sort((a, b) => a.localeCompare(b)), motif: MOTIF_LOT_A_REGULARISER }))
    .sort((a, b) => a.lotId.localeCompare(b.lotId))
}

/**
 * Séries prises par syndicat (normalisées), et syndicats dont un compte a une série qui n'est pas un texte (ligne écrite
 * hors application) : leurs séries prises sont inconnues, aucune ne leur est donnée (risque de doublon) ; leurs fiches
 * sont écartées avec un motif, comme « plus de série libre ».
 */
function seriesDesComptes(comptes: EntreesMigrationD2['comptes']): { seriesPrises: Map<string, Set<string>>; seriesIllisibles: Set<string> } {
  const seriesPrises = new Map<string, Set<string>>()
  const seriesIllisibles = new Set<string>()
  for (const c of comptes) {
    const serie: unknown = c.serie
    if (typeof serie !== 'string') {
      seriesIllisibles.add(c.coproprieteId)
      continue
    }
    const prises = seriesPrises.get(c.coproprieteId) ?? new Set<string>()
    prises.add(normaliserSerie(serie))
    seriesPrises.set(c.coproprieteId, prises)
  }
  return { seriesPrises, seriesIllisibles }
}

/**
 * Plan de la migration : lignes à créer, fiches déjà migrées, fiches écartées, lots à régulariser. Fonction pure. Jour de
 * la migration invalide : erreur, rien n'est planifié (il serait écrit tel quel dans le relevé de chaque compte).
 */
export function planifierMigrationD2({ fiches, lots, mandats, comptes, idsConnus, aujourdhui }: EntreesMigrationD2): PlanMigrationD2 {
  if (!estDateIsoValide(aujourdhui)) throw new Error(`Migration D2 : date invalide (${aujourdhui}), AAAA-MM-JJ attendu.`)
  const dejaMigrees: string[] = []
  const ecartees: (FicheEcartee & { rang: number })[] = []
  const valides: FicheValide[] = []
  fiches.forEach((fiche, rang) => {
    const id = fiche.id
    if (typeof id !== 'string' || !id.trim()) {
      ecartees.push({ rang, coproprietaireId: typeof id === 'string' ? id : '', motif: 'Fiche sans identifiant.' })
      return
    }
    if (Object.values(idsMigration(id)).some((connu) => idsConnus.has(connu))) {
      dejaMigrees.push(id)
      return
    }
    const resultat = valider(fiche, rang, lots)
    if ('motif' in resultat) ecartees.push({ rang, coproprietaireId: id, motif: resultat.motif })
    else valides.push(resultat)
  })

  const ordonnances = premieresOrdonnances(mandats)
  const { seriesPrises, seriesIllisibles } = seriesDesComptes(comptes)
  const prochaine = (coproprieteId: string): string | null => {
    const prises = seriesPrises.get(coproprieteId) ?? new Set<string>()
    const max = Math.max(0, ...[...prises].filter((s) => /^\d+$/.test(s)).map(Number))
    for (let n = max + 1; n <= SERIE_MAX; n++) {
      const serie = String(n).padStart(5, '0')
      if (!prises.has(serie)) return serie
    }
    return null
  }

  const aCreer: LigneMigrationD2[] = []
  for (const f of [...valides].sort(comparer)) {
    const entree = dateEntree(f, ordonnances)
    if (entree === null) {
      ecartees.push({ rang: f.rang, coproprietaireId: f.id, motif: "Date d'entrée introuvable : aucun mandat du syndicat, date de création de la fiche illisible." })
      continue
    }
    if (seriesIllisibles.has(f.lot.coproprieteId)) {
      ecartees.push({ rang: f.rang, coproprietaireId: f.id, motif: MOTIF_SERIE_ILLISIBLE })
      continue
    }
    const serie = prochaine(f.lot.coproprieteId)
    if (serie === null) {
      ecartees.push({ rang: f.rang, coproprietaireId: f.id, motif: `Plus de numéro de série libre pour un compte du syndicat ${f.lot.coproprieteId}.` })
      continue
    }
    let migree: ReturnType<typeof migrerCoproprietaire>
    try {
      migree = migrerCoproprietaire(
        { id: f.id, lotId: f.lotId, nom: f.nom, tel: f.tel, mail: f.mail, statut: f.statut },
        { coproprieteId: f.lot.coproprieteId, serie, dateEntree: entree.date },
      )
    } catch (erreur) {
      // erreur de donnée du domaine : la fiche est écartée avec le message, les autres continuent
      ecartees.push({ rang: f.rang, coproprietaireId: f.id, motif: erreur instanceof Error ? erreur.message : String(erreur) })
      continue
    }
    const prises = seriesPrises.get(f.lot.coproprieteId) ?? new Set<string>()
    prises.add(migree.compte.serie)
    seriesPrises.set(f.lot.coproprieteId, prises)
    aCreer.push({
      coproprietaireId: f.id,
      identite: migree.identite,
      compte: {
        ...migree.compte,
        reprise: { coproprietaireId: f.id, soldeDuCentimes: Math.round(-f.solde * 100) + 0, statutFiche: f.statut, releveLe: aujourdhui },
      },
      position: { ...migree.position, reprise: { coproprietaireId: f.id, origineDateEntree: entree.origine } },
    })
  }

  ecartees.sort((a, b) => a.rang - b.rang)
  return {
    aCreer,
    dejaMigrees,
    ecartees: ecartees.map(({ coproprietaireId, motif }) => ({ coproprietaireId, motif })),
    lotsARegulariser: lotsARegulariserDe(fiches, aCreer),
  }
}

/** Fiche écartée, avec de quoi la retrouver à l'écran : syndicat et n° de son lot, nom lisible (null : inconnus ou vides). */
export interface FicheEcarteeDetaillee extends FicheEcartee {
  coproprieteId: string | null
  lotNumero: string | null
  nom: string | null
}

/**
 * Fiches écartées par le plan, nommées par leur syndicat, leur lot et leur nom (décision du 22/11/2026 : donner le motif
 * des fiches écartées). Ordre et motifs du plan conservés ; fiche retrouvée par son identifiant (clé de la table) ; lot
 * introuvable : syndicat et n° null ; nom vide ou autre chose qu'un texte : null. Fonction pure.
 */
export function detaillerEcartees(
  ecartees: readonly FicheEcartee[],
  fiches: EntreesMigrationD2['fiches'],
  lots: EntreesMigrationD2['lots'],
): FicheEcarteeDetaillee[] {
  const ficheParId = new Map(fiches.flatMap((f) => (typeof f.id === 'string' ? [[f.id, f] as const] : [])))
  const lotParId = new Map(lots.map((l) => [l.id, l]))
  return ecartees.map((e) => {
    const fiche = ficheParId.get(e.coproprietaireId)
    const lot = typeof fiche?.lotId === 'string' ? lotParId.get(fiche.lotId) : undefined
    const nom = typeof fiche?.nom === 'string' ? fiche.nom.trim().replaceAll(/\s+/g, ' ') : ''
    return { ...e, coproprieteId: lot?.coproprieteId ?? null, lotNumero: lot?.numero ?? null, nom: nom || null }
  })
}

/** N° de lot qui commence déjà par « Lot » ou « Lots » (toute casse, collé au n° ou non), pas par un autre mot. */
const DEJA_PREFIXE_LOT = /^lots?(?!\p{L})/iu

/**
 * « <code du syndicat> · Lot <n°>, <nom ou « fiche sans nom »> — <motif> » ; sans code ni lot : « <nom> — <motif> ». Un
 * n° déjà écrit « Lot … » (liste importée : « Lot 12 », « Lot12 », « LOTS 3-4 ») n'est pas préfixé une seconde fois.
 */
export function libelleFicheEcartee(e: FicheEcarteeDetaillee, codeCopro?: string): string {
  const numero = e.lotNumero?.trim()
  const lot = numero && (DEJA_PREFIXE_LOT.test(numero) ? numero : `Lot ${numero}`)
  const lieu = [codeCopro, lot].filter(Boolean).join(' · ')
  if (!lieu) return [e.nom ?? 'Fiche sans nom', e.motif].join(' — ')
  return [`${lieu}, ${e.nom ?? 'fiche sans nom'}`, e.motif].join(' — ')
}
