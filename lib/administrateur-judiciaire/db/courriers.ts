import { repoCourriers, repoModelesCourrier } from '@/lib/administrateur-judiciaire/db/repositories'
import type { OptionsEcriture } from '@/lib/administrateur-judiciaire/db/repository'
import type { Courrier } from '@/lib/administrateur-judiciaire/db/schema'
import {
  controlerAccuseReception,
  controlerDepot,
  controlerPremierePresentation,
  preparerCourrier,
} from '@/lib/administrateur-judiciaire/domain/courriers'

/** Écritures des courriers (T30). Le suivi d'envoi est saisi : aucun routeur n'est intégré. */

/** Crée un courrier à partir d'un modèle : la forme d'envoi du modèle est copiée et figée. */
export async function creerCourrierDepuisModele(
  modeleId: string,
  saisie: Parameters<typeof preparerCourrier>[1],
  options?: OptionsEcriture,
): Promise<Courrier> {
  const modele = await repoModelesCourrier.get(modeleId)
  if (!modele) throw new Error(`Modèle de courrier introuvable (id=${modeleId}).`)
  return repoCourriers.create(preparerCourrier(modele, saisie), options)
}

async function lireCourrier(id: string): Promise<Courrier> {
  const courrier = await repoCourriers.get(id)
  if (!courrier) throw new Error(`Courrier introuvable (id=${id}).`)
  return courrier
}

/** Enregistre le dépôt (date AAAA-MM-JJ) et, le cas échéant, la référence chez le routeur ; statut « A Suivre ». */
export async function enregistrerDepot(
  id: string,
  { dateDepot, referenceDiffusion = null }: { dateDepot: string; referenceDiffusion?: string | null },
  options?: OptionsEcriture,
): Promise<Courrier> {
  controlerDepot(dateDepot)
  await lireCourrier(id)
  return repoCourriers.update(id, { dateDepot, referenceDiffusion, statut: 'A Suivre' }, options)
}

/**
 * Enregistre la date de PREMIÈRE présentation du pli par La Poste (J1) : elle fait courir le délai de l'art. 42,
 * que le pli soit retiré ou non. Une présentation postérieure à celle déjà saisie est refusée.
 */
export async function enregistrerPremierePresentation(
  id: string,
  datePremierePresentation: string,
  options?: OptionsEcriture,
): Promise<Courrier> {
  controlerPremierePresentation(await lireCourrier(id), datePremierePresentation)
  return repoCourriers.update(id, { datePremierePresentation }, options)
}

/** Enregistre l'accusé de réception (retrait du pli) d'un AR présenté (date AAAA-MM-JJ, non antérieure). */
export async function enregistrerAccuseReception(
  id: string,
  dateAccuseReception: string,
  options?: OptionsEcriture,
): Promise<Courrier> {
  controlerAccuseReception(await lireCourrier(id), dateAccuseReception)
  return repoCourriers.update(id, { dateAccuseReception }, options)
}
