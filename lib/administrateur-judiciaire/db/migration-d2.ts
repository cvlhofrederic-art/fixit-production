import type { OptionsEcriture } from '@/lib/administrateur-judiciaire/db/repository'
import { repoComptesCoproprietaires, repoIdentites, repoPositions } from '@/lib/administrateur-judiciaire/db/repositories'
import { ajDb, type Coproprietaire } from '@/lib/administrateur-judiciaire/db/schema'
import {
  detaillerEcartees,
  idsMigration,
  planifierMigrationD2,
  seriesDuJournal,
  type FicheEcarteeDetaillee,
  type LotARegulariser,
  type PlanMigrationD2,
} from '@/lib/administrateur-judiciaire/domain/migration-d2'

/**
 * Migration des anciennes fiches copropriétaire en identité, compte et position (D2), sur les tables de la version 3.
 * Fonction relançable, hors montée de version (aucune fonction upgrade : elle ne tournerait ni sur une base neuve, ni
 * après un import de liste, et une erreur y bloquerait l'ouverture de toute la base) et hors store (sa forme est figée
 * par l'oracle de la base locale).
 *
 * Une seule transaction : lecture des fiches, des lots, des mandats, des lignes D2 et du journal d'activité (fiches déjà
 * migrées ; séries sorties des comptes, seriesDuJournal), plan pur (planifierMigrationD2 : les erreurs de données y sont
 * prises fiche par fiche et rendues avec leur motif ; jour de la migration invalide : erreur, rien n'est écrit), puis les
 * écritures en création (repositories : champs de suivi, une entrée de journal par ligne). Deux appels concurrents
 * (deux onglets) se suivent : le second voit les lignes du premier et ne crée rien. Une erreur d'écriture annule tout.
 * L'ancienne table `coproprietaires` n'est ni vidée, ni modifiée, ni marquée.
 *
 * Appelée par le bouton « Reprendre les fiches de toutes les copropriétés » de l'écran « Appels de fonds » (décision du
 * 22/11/2026 : garder le bouton). planDeReprise donne, sans rien écrire, ce que la reprise ferait des fiches d'un
 * syndicat (fiches à créer, écartées avec leur motif) : même lecture, même plan (planDesFiches), une seule règle.
 */

export interface RapportMigrationD2 {
  /** Fiches migrées par cet appel. */
  creees: string[]
  /** Fiches déjà migrées (une de leurs lignes existe, ou le journal en garde la trace). */
  dejaMigrees: string[]
  /** Fiches écartées, avec leur motif, leur syndicat, leur lot et leur nom (detaillerEcartees). */
  ecartees: FicheEcarteeDetaillee[]
  /** Lots à plusieurs fiches touchés par cet appel : indivision ou mutation à régulariser. */
  lotsARegulariser: LotARegulariser[]
}

/** Plan de la reprise, fiches écartées nommées (detaillerEcartees). */
export interface PlanDeReprise extends Omit<PlanMigrationD2, 'ecartees'> {
  ecartees: FicheEcarteeDetaillee[]
}

const sansId = <T extends { id: string }>({ id, ...reste }: T): { id: string; donnees: Omit<T, 'id'> } => ({ id, donnees: reste })

/** Tables que lit planDesFiches : la transaction qui l'appelle doit toutes les comprendre. */
const tablesDuPlan = () => [ajDb.lots, ajDb.mandats, ajDb.identites, ajDb.comptesCoproprietaires, ajDb.positions, ajDb.activityLog]

/**
 * Plan de la migration des fiches reçues, dans la transaction de l'appelant. Ne lit que ce que planifierMigrationD2
 * consulte pour ces fiches : leurs lots, puis les mandats (ordonnances) et les séries prises (comptes en base et journal
 * des comptes) des syndicats de ces lots, les lignes D2 et le journal d'activité des fiches (déjà migrées). Le plan se
 * calcule syndicat par syndicat : le classement est celui d'une lecture de toute la base, mais la donnée d'un autre
 * syndicat (compte illisible) ne fait plus échouer l'écran « Appels de fonds » d'un syndicat. Aucun lot trouvé : le
 * journal des comptes n'est pas lu.
 */
async function planDesFiches(fichesLues: readonly Coproprietaire[], aujourdhui: string): Promise<PlanDeReprise> {
  const fiches = fichesLues as unknown as Record<string, unknown>[]
  const candidats = fiches.flatMap((f) => (typeof f.id === 'string' && f.id.trim() ? Object.values(idsMigration(f.id)) : []))
  const lotIds = [...new Set(fiches.flatMap((f) => (typeof f.lotId === 'string' ? [f.lotId] : [])))]
  const lots = (await ajDb.lots.bulkGet(lotIds)).filter((lot) => lot !== undefined)
  const syndicats = [...new Set(lots.flatMap((lot) => (typeof lot.coproprieteId === 'string' ? [lot.coproprieteId] : [])))]
  const [mandats, comptes, journalComptes, identites, positions, comptesD2, journal] = await Promise.all([
    ajDb.mandats.where('coproprieteId').anyOf(syndicats).toArray(),
    ajDb.comptesCoproprietaires.where('coproprieteId').anyOf(syndicats).toArray(),
    // entité du journal des comptes copropriétaires (repositories.ts, repoComptesCoproprietaires) : séries sorties
    syndicats.length > 0 ? ajDb.activityLog.where('entite').equals('comptesCoproprietaires').toArray() : [],
    ajDb.identites.bulkGet(candidats),
    ajDb.positions.bulkGet(candidats),
    ajDb.comptesCoproprietaires.bulkGet(candidats),
    ajDb.activityLog.where('entiteId').anyOf(candidats).toArray(),
  ])
  const idsConnus = new Set<string>([
    ...[...identites, ...positions, ...comptesD2].flatMap((ligne) => (ligne ? [ligne.id] : [])),
    ...journal.map((entree) => entree.entiteId),
  ])
  const desSyndicats = new Set(syndicats)
  const plan = planifierMigrationD2({
    fiches,
    lots,
    mandats,
    comptes: [...comptes, ...seriesDuJournal(journalComptes).filter((s) => desSyndicats.has(s.coproprieteId))],
    idsConnus,
    aujourdhui,
  })
  return { ...plan, ecartees: detaillerEcartees(plan.ecartees, fiches, lots) }
}

export function migrerFichesCoproprietaires({ aujourdhui, actor = null }: OptionsEcriture & { aujourdhui: string }): Promise<RapportMigrationD2> {
  return ajDb.transaction('rw', [ajDb.coproprietaires, ...tablesDuPlan()], async () => {
    const plan = await planDesFiches(await ajDb.coproprietaires.toArray(), aujourdhui)
    for (const ligne of plan.aCreer) {
      const identite = sansId(ligne.identite)
      await repoIdentites.create(identite.donnees, { id: identite.id, actor })
      const compte = sansId(ligne.compte)
      await repoComptesCoproprietaires.create(compte.donnees, { id: compte.id, actor })
      const position = sansId(ligne.position)
      await repoPositions.create(position.donnees, { id: position.id, actor })
    }
    return {
      creees: plan.aCreer.map((l) => l.coproprietaireId),
      dejaMigrees: plan.dejaMigrees,
      ecartees: plan.ecartees,
      lotsARegulariser: plan.lotsARegulariser,
    }
  })
}

/**
 * Ce que la reprise ferait des fiches reçues (celles des lots d'un syndicat : écran « Appels de fonds »), sans rien
 * écrire : même lecture et même plan que migrerFichesCoproprietaires, dans une transaction en lecture. Le plan se calcule
 * syndicat par syndicat (séries, ordonnances, lignes connues et lots à régulariser propres au syndicat ou à la fiche) :
 * les fiches d'un syndicat y sont classées comme par la reprise de toutes les copropriétés. Jour invalide : erreur.
 */
export function planDeReprise(fiches: readonly Coproprietaire[], { aujourdhui }: { aujourdhui: string }): Promise<PlanDeReprise> {
  return ajDb.transaction('r', tablesDuPlan(), () => planDesFiches(fiches, aujourdhui))
}
