import { genererId } from '@/lib/administrateur-judiciaire/db/ids'
import { journaliserActivite } from '@/lib/administrateur-judiciaire/db/repository'
import { ajDb, type Ag, type ChangementStatut } from '@/lib/administrateur-judiciaire/db/schema'
import type { StatutAssemblee } from '@/lib/administrateur-judiciaire/domain/referentiels-vitfix'
import { historiqueTrie, preparerChangementStatutAg } from '@/lib/administrateur-judiciaire/domain/statut-assemblee'

/**
 * Seul point d'écriture du statut d'une assemblée générale (T12). Dans une même transaction : contrôle du changement
 * (domaine), mise à jour du statut de l'AG, ligne d'historique avec sa date d'effet, et deux entrées au journal
 * d'activité. Une erreur n'écrit rien.
 */

export interface OptionsChangementStatut {
  /** Date de l'acte (AAAA-MM-JJ) : convocation envoyée, PV signé, notification présentée. Pas la date de saisie. */
  dateEffet: string
  /** Courrier AR qui prouve l'acte (T30) ; null tant que l'entité Courrier n'existe pas. */
  courrierId?: string | null
  actor?: string | null
}

export async function changerStatutAg(
  agId: string,
  nouveau: StatutAssemblee,
  { dateEffet, courrierId = null, actor = null }: OptionsChangementStatut,
): Promise<Ag> {
  return ajDb.transaction('rw', ajDb.ags, ajDb.changementsStatut, ajDb.courriers, ajDb.activityLog, async () => {
    const avant = await ajDb.ags.get(agId)
    if (!avant) throw new Error(`ags introuvable (id=${agId})`)
    if (courrierId && !(await ajDb.courriers.get(courrierId)))
      throw new Error(`Courrier introuvable (id=${courrierId}) : impossible de le rattacher au changement de statut.`)
    const { statut, changement } = preparerChangementStatutAg(avant, nouveau, dateEffet, courrierId)
    const maintenant = new Date().toISOString()
    const apres: Ag = { ...avant, statut, updatedAt: maintenant, updatedBy: actor }
    const ligne: ChangementStatut = {
      ...changement,
      id: genererId(),
      createdAt: maintenant,
      updatedAt: maintenant,
      createdBy: actor,
      updatedBy: actor,
    }
    await ajDb.ags.put(apres)
    await ajDb.changementsStatut.add(ligne)
    await journaliserActivite({ entite: 'ags', entiteId: agId, action: 'update', qui: actor, avant, apres })
    await journaliserActivite({
      entite: 'changementsStatut',
      entiteId: ligne.id,
      action: 'create',
      qui: actor,
      avant: null,
      apres: ligne,
    })
    return apres
  })
}

/** Historique des statuts d'une AG, du plus ancien au plus récent (par date d'effet). */
export async function historiqueStatutAg(agId: string): Promise<ChangementStatut[]> {
  const lignes = await ajDb.changementsStatut.where('[entiteType+entiteId]').equals(['ag', agId]).toArray()
  return historiqueTrie(lignes, agId)
}

/**
 * Relie après coup un changement de statut au courrier qui le prouve (T31) : l'accusé de réception revient souvent
 * après la saisie du changement. Seul `courrierId` est complété ; la date d'effet et les statuts restent inchangés.
 */
export async function rattacherPreuveNotification(
  changementId: string,
  courrierId: string,
  { actor = null }: { actor?: string | null } = {},
): Promise<ChangementStatut> {
  return ajDb.transaction('rw', ajDb.changementsStatut, ajDb.courriers, ajDb.activityLog, async () => {
    const avant = await ajDb.changementsStatut.get(changementId)
    if (!avant) throw new Error(`Changement de statut introuvable (id=${changementId}).`)
    if (!(await ajDb.courriers.get(courrierId)))
      throw new Error(`Courrier introuvable (id=${courrierId}) : impossible de le rattacher au changement de statut.`)
    const apres: ChangementStatut = {
      ...avant,
      courrierId,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    }
    await ajDb.changementsStatut.put(apres)
    await journaliserActivite({
      entite: 'changementsStatut',
      entiteId: changementId,
      action: 'update',
      qui: actor,
      avant,
      apres,
    })
    return apres
  })
}
