import { genererId } from '@/lib/administrateur-judiciaire/db/ids'
import { creerRepository } from '@/lib/administrateur-judiciaire/db/repository'
import { ajDb, type ReleveImporteEnregistre } from '@/lib/administrateur-judiciaire/db/schema'
import { compteBanque } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import { empreinteReleve, reconnaitreReleve, type EmpreinteReleve } from '@/lib/administrateur-judiciaire/domain/import/doublons-releves'
import type { LigneReleve } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import { designationReleve } from '@/lib/administrateur-judiciaire/domain/import/releve-compte'
import {
  origineDuMouvement,
  releveImporte,
  type OrigineReleve,
  type ReleveRepris,
} from '@/lib/administrateur-judiciaire/domain/import/releves-importes'

/**
 * Table locale « relevesImportes » (base en version 5 ; décision du 26/11/2026 du référent métier, PR 799, points 10 B
 * et 11 B) : un relevé gardé par relevé CFONB 120 ou camt.053 importé sur un compte bancaire (ce qui est gardé :
 * domain/import/releves-importes.ts). Volontairement hors du store (sa forme est figée par l'oracle de la base locale),
 * comme db/rapprochements.ts : la table est lue ici, à l'affichage (use-releves-importes.ts).
 * - Écriture : dans la transaction des lignes du relevé seulement (importerReleve du store), jamais seule. Tout est écrit
 *   ou rien : un relevé gardé sans ses lignes ferait refuser son import, des lignes sans leur relevé seraient comptées
 *   deux fois à l'import suivant.
 * - Un relevé déjà gardé (même relevé, même identifiant avec un autre contenu, ou, sans identifiant commun, même
 *   période avec d'autres soldes — réponse du 28/11/2026, point #858 · 2 A : reconnaitreReleve) est refusé à
 *   l'écriture, sans rien écrire : l'analyse de l'écran l'écarte déjà, ce contrôle couvre une analyse périmée (import
 *   fait entre-temps dans un autre onglet, double clic). Retour de la relecture du 27/11/2026 : il est comparé à tous
 *   les relevés gardés de la copropriété, et non à ceux de la seule fiche de compte. Deux fiches peuvent porter le même
 *   IBAN (fiche clôturée puis recréée, saisie en double ; domain/comptes-bancaires.ts : « deux fiches d'un même IBAN
 *   sont un seul compte ») : le même relevé écrit sur les deux serait compté deux fois dans la trésorerie du syndicat.
 *   La comparaison porte sur le compte en banque du relevé (IBAN ou RIB) : un relevé d'un autre compte en banque n'est
 *   jamais confondu. 🔴 Non traité : un même IBAN sous deux copropriétés (compte partagé entre mandats).
 * - Chaque création est tracée au journal d'activité, comme toute écriture de la base. Aucune modification ni
 *   suppression n'est proposée : un relevé gardé ne se corrige pas.
 */

const repoRelevesImportes = creerRepository(ajDb.relevesImportes, 'relevesImportes')

/** Relevés d'un import : compte bancaire, jour de l'import, et chaque relevé avec ses mouvements repris. */
export interface RelevesDeLImport {
  banqueId: string
  /** AAAA-MM-JJ (jour courant de l'application). */
  dateImport: string
  releves: readonly ReleveRepris[]
}

/** Relevé déjà gardé pour la copropriété, ou gardé plus haut dans l'import en cours : son empreinte et sa fiche de compte. */
type ReleveConnu = EmpreinteReleve & { banqueId: string }

/** Ordre d'enregistrement : instant de l'écriture, puis rang dans le fichier pour les relevés d'un même import. */
const parEnregistrement = (a: ReleveImporteEnregistre, b: ReleveImporteEnregistre): number =>
  a.createdAt.localeCompare(b.createdAt) || a.rang - b.rang

/** Relevés gardés d'une copropriété (tous ses comptes bancaires), dans l'ordre de leur enregistrement. */
export async function listerRelevesImportes(coproprieteId: string): Promise<ReleveImporteEnregistre[]> {
  const lus = await ajDb.relevesImportes.where('coproprieteId').equals(coproprieteId).toArray()
  return lus.sort(parEnregistrement)
}

/**
 * Garde les relevés d'un import et rend, pour chaque ligne à écrire, les informations de son mouvement (à poser sur
 * l'écriture). À appeler DANS la transaction des lignes (tables « relevesImportes » et « activityLog » comprises).
 * Refus, par une erreur qui annule la transaction : lignes hors du sous-compte 512 du compte bancaire, relevés et lignes
 * qui ne se correspondent pas (chaque ligne écrite doit être un mouvement repris, et l'inverse), relevé déjà gardé sur
 * ce compte ou sur un autre compte de la copropriété, ou présent deux fois dans l'import.
 */
export async function enregistrerRelevesImportes(
  coproprieteId: string,
  compte: string,
  { banqueId, dateImport, releves }: RelevesDeLImport,
  lignes: readonly LigneReleve[],
): Promise<Map<LigneReleve, OrigineReleve>> {
  if (compte !== compteBanque(banqueId))
    throw new Error(`Relevés à garder : lignes attendues au sous-compte 512 du compte bancaire du relevé (reçu : « ${compte} »).`)
  const repris = releves.flatMap((releve) => releve.repris),
    aEcrire = new Set<LigneReleve>(lignes)
  if (repris.length !== lignes.length || new Set(repris).size !== repris.length || repris.some((mouvement) => !aEcrire.has(mouvement)))
    throw new Error('Relevés et lignes de l’import ne correspondent pas : analyser le fichier à nouveau.')
  const connus: ReleveConnu[] = await ajDb.relevesImportes.where('coproprieteId').equals(coproprieteId).toArray(),
    origines = new Map<LigneReleve, OrigineReleve>()
  for (const aGarder of releves) {
    const { releve } = aGarder,
      empreinte = empreinteReleve(releve),
      reconnu = reconnaitreReleve(empreinte, connus)
    if (reconnu) {
      const ou = reconnu.connu.banqueId === banqueId ? 'sur ce compte' : 'sur un autre compte de la copropriété'
      throw new Error(
        `${designationReleve(releve.rang, releve.compte, releve.dateOuverture, releve.dateCloture)} : déjà importé ${ou}. Analyser le fichier à nouveau.`,
      )
    }
    const { id, ...champs } = releveImporte(aGarder, { id: genererId(), coproprieteId, banqueId, dateImport })
    await repoRelevesImportes.create(champs, { id })
    connus.push({ ...empreinte, banqueId })
    for (const mouvement of aGarder.repris) origines.set(mouvement, origineDuMouvement(id, mouvement))
  }
  return origines
}
