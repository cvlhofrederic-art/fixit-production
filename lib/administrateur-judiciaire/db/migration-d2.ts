import type { OptionsEcriture } from '@/lib/administrateur-judiciaire/db/repository'
import { repoComptesCoproprietaires, repoIdentites, repoPositions } from '@/lib/administrateur-judiciaire/db/repositories'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import {
  idsMigration,
  planifierMigrationD2,
  seriesDuJournal,
  type FicheEcartee,
  type LotARegulariser,
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
 * Aucun appel dans cette PR : l'appeler au démarrage, c'est préparer les données avant l'écran (question posée à
 * Frédéric) ; sinon, la PR écran l'appellera.
 */

export interface RapportMigrationD2 {
  /** Fiches migrées par cet appel. */
  creees: string[]
  /** Fiches déjà migrées (une de leurs lignes existe, ou le journal en garde la trace). */
  dejaMigrees: string[]
  ecartees: FicheEcartee[]
  /** Lots à plusieurs fiches touchés par cet appel : indivision ou mutation à régulariser. */
  lotsARegulariser: LotARegulariser[]
}

const sansId = <T extends { id: string }>({ id, ...reste }: T): { id: string; donnees: Omit<T, 'id'> } => ({ id, donnees: reste })

export function migrerFichesCoproprietaires({ aujourdhui, actor = null }: OptionsEcriture & { aujourdhui: string }): Promise<RapportMigrationD2> {
  const tables = [ajDb.coproprietaires, ajDb.lots, ajDb.mandats, ajDb.identites, ajDb.comptesCoproprietaires, ajDb.positions, ajDb.activityLog]
  return ajDb.transaction('rw', tables, async () => {
    const [fiches, lots, mandats, comptes, journalComptes] = await Promise.all([
      ajDb.coproprietaires.toArray(),
      ajDb.lots.toArray(),
      ajDb.mandats.toArray(),
      ajDb.comptesCoproprietaires.toArray(),
      // entité du journal des comptes copropriétaires (repositories.ts, repoComptesCoproprietaires) : séries sorties
      ajDb.activityLog.where('entite').equals('comptesCoproprietaires').toArray(),
    ])
    const candidats = fiches.flatMap((f) => (typeof f.id === 'string' && f.id.trim() ? Object.values(idsMigration(f.id)) : []))
    const [identites, positions, comptesD2, journal] = await Promise.all([
      ajDb.identites.bulkGet(candidats),
      ajDb.positions.bulkGet(candidats),
      ajDb.comptesCoproprietaires.bulkGet(candidats),
      ajDb.activityLog.where('entiteId').anyOf(candidats).toArray(),
    ])
    const idsConnus = new Set<string>([
      ...[...identites, ...positions, ...comptesD2].flatMap((ligne) => (ligne ? [ligne.id] : [])),
      ...journal.map((entree) => entree.entiteId),
    ])
    const plan = planifierMigrationD2({
      fiches: fiches as unknown as Record<string, unknown>[],
      lots,
      mandats,
      comptes: [...comptes, ...seriesDuJournal(journalComptes)],
      idsConnus,
      aujourdhui,
    })
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
