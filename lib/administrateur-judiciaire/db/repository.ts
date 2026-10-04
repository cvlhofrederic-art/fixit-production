import type { Table } from 'dexie'
import { genererId } from '@/lib/administrateur-judiciaire/db/ids'
import {
  ajDb,
  type EntiteEnregistree,
  type EntreeJournalActivite,
} from '@/lib/administrateur-judiciaire/db/schema'

/**
 * Accès générique à une table de la base locale. Chaque écriture pose les champs de suivi
 * (createdAt/updatedAt en ISO, createdBy/updatedBy) et ajoute une entrée au journal d'activité (état avant et après).
 */

/** Données d'une entité à créer : tout sauf l'identifiant et les champs de suivi, posés par le repository. */
export type DonneesCreation<T extends EntiteEnregistree> = Omit<T, keyof EntiteEnregistree>

/** Modification partielle d'une entité. */
export type DonneesModification<T extends EntiteEnregistree> = Partial<DonneesCreation<T>>

export interface OptionsEcriture {
  /** Auteur de l'écriture (null par défaut). */
  actor?: string | null
}

export interface OptionsCreation extends OptionsEcriture {
  /** Identifiant imposé (genererId() par défaut). */
  id?: string
}

export interface Repository<T extends EntiteEnregistree> {
  /** Toute la table, filtrée en mémoire sur l'égalité stricte de chaque champ du filtre. */
  list(filtre?: Partial<T>): Promise<T[]>
  get(id: string): Promise<T | null>
  create(donnees: DonneesCreation<T>, options?: OptionsCreation): Promise<T>
  /** Fusionne le patch dans l'entité existante ; lève « <entite> introuvable (id=…) » si elle n'existe pas. */
  update(id: string, patch: DonneesModification<T>, options?: OptionsEcriture): Promise<T>
  remove(id: string, options?: OptionsEcriture): Promise<void>
}

/** Ajoute une entrée au journal d'activité (identifiant et horodatage ISO générés) et la renvoie. */
export async function journaliserActivite(
  entree: Omit<EntreeJournalActivite, 'id' | 'quand'>,
): Promise<EntreeJournalActivite> {
  const ligne: EntreeJournalActivite = {
    id: genererId(),
    quand: new Date().toISOString(),
    ...entree,
  }
  await ajDb.activityLog.add(ligne)
  return ligne
}

export function creerRepository<T extends EntiteEnregistree>(table: Table<T, string>, entite: string): Repository<T> {
  return {
    async list(filtre) {
      const toutes = await table.toArray()
      if (!filtre) return toutes
      const criteres = Object.entries(filtre)
      return toutes.filter((ligne) =>
        criteres.every(([champ, valeur]) => (ligne as Record<string, unknown>)[champ] === valeur),
      )
    },
    async get(id) {
      return (await table.get(id)) ?? null
    },
    async create(donnees, options) {
      const maintenant = new Date().toISOString(),
        auteur = options?.actor ?? null,
        cree = {
          ...donnees,
          id: options?.id ?? genererId(),
          createdAt: maintenant,
          updatedAt: maintenant,
          createdBy: auteur,
          updatedBy: auteur,
        } as T
      await table.add(cree)
      await journaliserActivite({
        entite,
        entiteId: cree.id,
        action: 'create',
        qui: auteur,
        avant: null,
        apres: cree,
      })
      return cree
    },
    async update(id, patch, options) {
      const avant = await table.get(id)
      if (!avant) throw new Error(`${entite} introuvable (id=${id})`)
      const auteur = options?.actor ?? null,
        apres: T = {
          ...avant,
          ...patch,
          updatedAt: new Date().toISOString(),
          updatedBy: auteur,
        }
      await table.put(apres)
      await journaliserActivite({
        entite,
        entiteId: id,
        action: 'update',
        qui: auteur,
        avant,
        apres,
      })
      return apres
    },
    async remove(id, options) {
      const avant = await table.get(id),
        auteur = options?.actor ?? null
      await table.delete(id)
      await journaliserActivite({
        entite,
        entiteId: id,
        action: 'remove',
        qui: auteur,
        avant: avant ?? null,
        apres: null,
      })
    },
  }
}
