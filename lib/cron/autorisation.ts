// Secret des tâches planifiées (27/11/2026) : en-tête « Authorization: Bearer CRON_SECRET », envoyé par le handler
// scheduled du Worker (worker/taches-planifiees.ts) ou par GitHub Actions. Comparaison à temps constant sur des
// empreintes SHA-256 de même longueur. Secret absent ou vide côté serveur, ou en-tête absent : refus, toujours (sans
// cette garde, un secret vide accepterait l'en-tête « Bearer »).

import { createHash, timingSafeEqual } from 'crypto'

const empreinte = (valeur: string) => createHash('sha256').update(valeur).digest()

/** L'en-tête porte-t-il le secret des tâches planifiées ? */
export function secretCronValide(entete: string | null | undefined, secret: string | null | undefined): boolean {
  if (typeof secret !== 'string' || secret === '' || typeof entete !== 'string' || entete === '') return false
  return timingSafeEqual(empreinte(entete), empreinte(`Bearer ${secret}`))
}
