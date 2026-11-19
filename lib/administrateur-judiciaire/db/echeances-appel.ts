import { journaliserActivite, type OptionsEcriture } from '@/lib/administrateur-judiciaire/db/repository'
import { ajDb, type EcheanceAppelEnregistree } from '@/lib/administrateur-judiciaire/db/schema'
import {
  annulerAvantAppel,
  fixerRegroupement,
  fixerRelancable,
  marquerEnvoyees,
  mettreEnAttente,
  reprendreEcheance,
  suivreEcheances,
} from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import type { EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'

/**
 * Échéancier des appels du syndicat (table `echeancesAppel`, version 3), lu et écrit ici seulement. L'identifiant d'une
 * échéance n'est unique qu'au sein de son syndicat (D1 ; « B-2026-001-1 » pour tout syndicat qui a un exercice « 2026 »
 * et une clé « 001 ») : la table la range sous la clé [coproprieteId+id], et le journal d'activité sous
 * « <syndicat>:<identifiant> » (convention dansLeSyndicat de travaux-operations.ts). Pas de repository générique.
 *
 * Le statut, le traitement d'appel ou d'annulation et la composition de l'appel ne s'écrivent que par les fonctions
 * d'echeancier-appels.ts, dans une transaction qui relit l'échéancier entier du syndicat. Ici, celles qui n'écrivent
 * aucune pièce : suivreEcheances (ajout, « Prévu »), mettreEnAttente, reprendreEcheance, annulerAvantAppel,
 * fixerRegroupement, fixerRelancable, marquerEnvoyees. L'appel (marquerAppelees, « Appelé ») et son annulation
 * (annulerAppelees, écriture contraire) s'écrivent avec leur pièce de traitement, dans la même transaction : PR écran.
 */

const entiteIdEcheance = (e: Pick<EcheanceAppel, 'coproprieteId' | 'id'>): string => `${e.coproprieteId}:${e.id}`

/** Échéancier du syndicat, trié par identifiant (index coproprieteId, puis clé). */
export function echeancesAppelDuSyndicat(coproprieteId: string): Promise<EcheanceAppelEnregistree[]> {
  return ajDb.echeancesAppel.where('coproprieteId').equals(coproprieteId).toArray()
}

/**
 * Ajoute des échéances produites par le domaine (appels-budget, fonds-travaux, travaux-operations) à l'échéancier de LEUR
 * syndicat, avec le suivi par défaut (suivreEcheances : « Prévu », relançable par défaut). Refus, rien n'est écrit : lot
 * de plusieurs syndicats, échéance déjà dans l'échéancier du syndicat, échéance que suivreEcheances refuse.
 */
export function ajouterEcheancesAppel(
  echeances: EcheanceAppel[],
  { actor = null, relancable = true }: OptionsEcriture & { relancable?: boolean } = {},
): Promise<EcheanceAppelEnregistree[]> {
  // refus du domaine dans la transaction (comme changerSuiviEcheances) : la promesse est rejetée, rien n'est écrit
  return ajDb.transaction('rw', ajDb.echeancesAppel, ajDb.activityLog, async () => {
    const syndicats = new Set(echeances.map((e) => e.coproprieteId))
    if (syndicats.size > 1) throw new Error(`Échéances de ${syndicats.size} syndicats (${[...syndicats].join(', ')}) : un seul syndicat par ajout.`)
    const suivies = suivreEcheances(echeances, { relancable })
    const deja = (await ajDb.echeancesAppel.bulkGet(suivies.map((e): [string, string] => [e.coproprieteId, e.id]))).filter((e) => e !== undefined)
    if (deja.length > 0) {
      const identifiants = deja.map((e) => `« ${e.id} »`).join(', ')
      throw new Error(`Échéance(s) ${identifiants} déjà dans l'échéancier du syndicat ${deja[0].coproprieteId}.`)
    }
    const maintenant = new Date().toISOString()
    const lignes: EcheanceAppelEnregistree[] = suivies.map((e) => ({ ...e, createdAt: maintenant, updatedAt: maintenant, createdBy: actor, updatedBy: actor }))
    await ajDb.echeancesAppel.bulkAdd(lignes)
    // entrées du journal placées dans l'ordre des lignes (journaliserActivite pose son ajout sans attente préalable)
    await Promise.all(
      lignes.map((ligne) =>
        journaliserActivite({ entite: 'echeancesAppel', entiteId: entiteIdEcheance(ligne), action: 'create', qui: actor, avant: null, apres: ligne }),
      ),
    )
    return lignes
  })
}

/** Opérations du suivi qui n'écrivent aucune pièce (voir l'en-tête), chacune par sa fonction d'echeancier-appels.ts. */
export type OperationSuiviEcheance =
  | { operation: 'mettreEnAttente'; id: string; motif: string }
  | { operation: 'reprendre'; id: string }
  | { operation: 'annulerAvantAppel'; id: string }
  | { operation: 'fixerRegroupement'; id: string; regroupement: number | null }
  | { operation: 'fixerRelancable'; id: string; relancable: boolean }
  | { operation: 'marquerEnvoyees'; ids: string[]; le: string }

/** Applique l'opération à l'échéancier entier du syndicat ; rend l'échéancier après. */
function appliquer(echeances: EcheanceAppelEnregistree[], op: OperationSuiviEcheance): EcheanceAppelEnregistree[] {
  if (op.operation === 'marquerEnvoyees') return marquerEnvoyees(echeances, { ids: op.ids, le: op.le })
  const cible = echeances.find((e) => e.id === op.id)
  if (!cible) throw new Error(`Échéance « ${op.id} » introuvable dans l'échéancier du syndicat.`)
  const changee = changerUne(cible, op)
  return echeances.map((e) => (e === cible ? changee : e))
}

function changerUne(e: EcheanceAppelEnregistree, op: Exclude<OperationSuiviEcheance, { operation: 'marquerEnvoyees' }>): EcheanceAppelEnregistree {
  switch (op.operation) {
    case 'mettreEnAttente':
      return mettreEnAttente(e, op.motif)
    case 'reprendre':
      return reprendreEcheance(e)
    case 'annulerAvantAppel':
      return annulerAvantAppel(e)
    case 'fixerRegroupement':
      return fixerRegroupement(e, op.regroupement)
    case 'fixerRelancable':
      return fixerRelancable(e, op.relancable)
  }
}

/**
 * Change le suivi d'échéances du syndicat par une fonction du domaine, dans une transaction qui relit tout l'échéancier
 * du syndicat ; rend les échéances modifiées (une opération sans effet n'écrit rien). Refus du domaine : rien n'est écrit.
 */
export function changerSuiviEcheances(
  coproprieteId: string,
  op: OperationSuiviEcheance,
  { actor = null }: OptionsEcriture = {},
): Promise<EcheanceAppelEnregistree[]> {
  return ajDb.transaction('rw', ajDb.echeancesAppel, ajDb.activityLog, async () => {
    const avant = await echeancesAppelDuSyndicat(coproprieteId)
    const apres = appliquer(avant, op)
    const maintenant = new Date().toISOString()
    const modifiees: EcheanceAppelEnregistree[] = []
    for (const [i, ligne] of apres.entries()) {
      if (JSON.stringify(ligne) === JSON.stringify(avant[i])) continue
      const ecrite = { ...ligne, updatedAt: maintenant, updatedBy: actor }
      await ajDb.echeancesAppel.put(ecrite)
      await journaliserActivite({ entite: 'echeancesAppel', entiteId: entiteIdEcheance(ecrite), action: 'update', qui: actor, avant: avant[i], apres: ecrite })
      modifiees.push(ecrite)
    }
    return modifiees
  })
}
