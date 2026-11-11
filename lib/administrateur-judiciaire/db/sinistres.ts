'use client'

import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { repoSinistres } from '@/lib/administrateur-judiciaire/db/repositories'
import type { OptionsEcriture } from '@/lib/administrateur-judiciaire/db/repository'
import type { Sinistre } from '@/lib/administrateur-judiciaire/db/schema'
import { controlerFicheSinistre, numerosAttribues } from '@/lib/administrateur-judiciaire/domain/fiche-sinistre'
import { creerSinistre, type SaisieSinistre } from '@/lib/administrateur-judiciaire/domain/sinistres'
import type { StatutSinistre } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Écriture des fiches sinistre (écran Sinistres, mode données réelles) dans la table locale existante « sinistres »,
 * sans changement de schéma ni de version : les champs de la fiche Gestéam y sont optionnels et non indexés. Écrit
 * par le repository (champs de suivi et journal d'activité posés par lui), puis l'état chargé du store est mis à jour.
 * Volontairement hors du store (aucune action ajoutée à EtatDonneesStore : sa forme est figée par l'oracle de la base
 * locale). L'écran décide du mode : en démonstration, il n'appelle pas cette fonction.
 */

export interface OptionsEnregistrementSinistre extends OptionsEcriture {
  /** Fiche existante à modifier ; absent ou null : création. */
  id?: string | null
  /** Jour courant (AAAA-MM-JJ) : plausibilité des dates. */
  aujourdhui: string
  /** Statut choisi à l'écran (En cours / Terminé), contrôlé contre « Clos le » ; jamais stocké. */
  statutSaisi?: StatutSinistre | null
}

/** Lignes du store avec la fiche enregistrée : remplacée si elle y est déjà, ajoutée sinon. */
const remplacerOuAjouter = (lignes: Sinistre[], enregistre: Sinistre): Sinistre[] =>
  lignes.some((ligne) => ligne.id === enregistre.id)
    ? lignes.map((ligne) => (ligne.id === enregistre.id ? enregistre : ligne))
    : [...lignes, enregistre]

/**
 * Crée ou modifie la fiche. Refusée (rien n'est écrit) si son format est invalide (creerSinistre) ou si elle porte une
 * anomalie bloquante (controlerFicheSinistre : chronologie, statut ⇔ « Clos le », numéro déjà attribué à une autre
 * fiche…). Numéros attribués : ceux des autres lignes de la table qui sont des textes (numerosAttribues, même liste
 * qu'à l'écran) ; une ligne écrite hors de l'application dont le n° n'est pas un texte ne bloque donc rien. Une
 * modification d'une fiche disparue lève l'erreur du repository.
 */
export async function enregistrerSinistre(saisie: SaisieSinistre, options: OptionsEnregistrementSinistre): Promise<Sinistre> {
  const fiche = creerSinistre(saisie)
  const id = options.id ?? null
  const bloquants = controlerFicheSinistre(fiche, {
    aujourdhui: options.aujourdhui,
    statutSaisi: options.statutSaisi,
    numerosExistants: numerosAttribues(await repoSinistres.list(), id),
  }).filter((anomalie) => anomalie.niveau === 'bloquant')
  if (bloquants.length > 0) throw new Error(bloquants.map((anomalie) => anomalie.message).join(' '))
  const ecriture = { actor: options.actor ?? null }
  const enregistre = id ? await repoSinistres.update(id, fiche, ecriture) : await repoSinistres.create(fiche, ecriture)
  useDonneesStore.setState((etat) => ({ sinistres: remplacerOuAjouter(etat.sinistres, enregistre) }))
  return enregistre
}
