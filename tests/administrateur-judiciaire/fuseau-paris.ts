/**
 * Fixe le fuseau horaire des tests de la succursale sur Europe/Paris (celui de la maquette de référence
 * et des résultats de l'oracle), quel que soit le fuseau du poste ou de la CI.
 * À importer EN PREMIER dans chaque fichier de test qui manipule des dates locales :
 *   import './fuseau-paris'
 * (la variable d'environnement TZ passée en ligne de commande est ignorée par Node sous Windows,
 * l'affectation à l'exécution fonctionne partout).
 */
process.env.TZ = 'Europe/Paris'

export const FUSEAU_TESTS = 'Europe/Paris'
