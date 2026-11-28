'use client'

import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { repoBanques } from '@/lib/administrateur-judiciaire/db/repositories'
import type { Ecriture } from '@/lib/administrateur-judiciaire/db/schema'
import { compteBanque } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import type { LigneReleve } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import type { ReleveRepris } from '@/lib/administrateur-judiciaire/domain/import/releves-importes'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Import d'un relevé sur le compte bancaire choisi par l'écran « Banque et recouvrement » : les lignes vont au
 * sous-compte 512 de ce compte (db/sous-comptes-banque.ts). L'écriture reste celle du store (importerReleve : une
 * transaction, 471 à ventiler pour chaque sortie), appelée avec ce sous-compte. Refusé, sans écriture, pour un compte
 * introuvable, d'une autre copropriété ou clôturé.
 * Décision du 26/11/2026 (PR 799, points 10 B et 11 B) : pour un relevé CFONB 120 ou camt.053, `releves` porte les
 * relevés dont viennent les lignes (chacun avec ses mouvements repris) ; ils sont gardés dans la même transaction, avec
 * les informations de chaque mouvement sur sa ligne, et un relevé déjà gardé pour la copropriété fait refuser l'import
 * (db/releves-importes.ts). Sans relevé (CSV), rien n'est gardé : comportement inchangé.
 * Période arrêtée protégée (décision du 26/11/2026, rb-04 A) : refusé en entier si une ligne est datée au plus tard du
 * dernier arrêté clôturé du compte, ou tant qu'un arrêté illisible reste sur le compte. Le contrôle est celui du store,
 * dans la transaction d'écriture, qui ouvre aussi le journal d'une copropriété qui n'en a pas : un refus n'en laisse pas,
 * et ne garde aucun relevé.
 */
export async function importerReleveSurCompte(
  coproprieteId: string,
  banqueId: string,
  lignes: LigneReleve[],
  releves: readonly ReleveRepris[] = [],
): Promise<Ecriture[]> {
  const compte = await repoBanques.get(banqueId)
  if (compte?.coproprieteId !== coproprieteId) throw new Error(`Compte bancaire introuvable pour cette copropriété (id=${banqueId}).`)
  if (compte.actif === false) throw new Error(`Compte bancaire clôturé : aucun relevé ne s'y importe (id=${banqueId}).`)
  return useDonneesStore
    .getState()
    .importerReleve(coproprieteId, lignes, compteBanque(banqueId), releves.length > 0 ? { banqueId, dateImport: AUJOURDHUI_ISO, releves } : undefined)
}
