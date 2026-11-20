'use client'

import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { repoBanques } from '@/lib/administrateur-judiciaire/db/repositories'
import type { Ecriture } from '@/lib/administrateur-judiciaire/db/schema'
import { compteBanque } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import type { LigneReleve } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'

/**
 * Import d'un relevé sur le compte bancaire choisi par l'écran « Banque et recouvrement » : les lignes vont au
 * sous-compte 512 de ce compte (db/sous-comptes-banque.ts). L'écriture reste celle du store (importerReleve : une
 * transaction, 471 à ventiler pour chaque sortie), appelée avec ce sous-compte. Refusé, sans écriture, pour un compte
 * introuvable, d'une autre copropriété ou clôturé.
 */
export async function importerReleveSurCompte(coproprieteId: string, banqueId: string, lignes: LigneReleve[]): Promise<Ecriture[]> {
  const compte = await repoBanques.get(banqueId)
  if (compte?.coproprieteId !== coproprieteId) throw new Error(`Compte bancaire introuvable pour cette copropriété (id=${banqueId}).`)
  if (compte.actif === false) throw new Error(`Compte bancaire clôturé : aucun relevé ne s'y importe (id=${banqueId}).`)
  return useDonneesStore.getState().importerReleve(coproprieteId, lignes, compteBanque(banqueId))
}
