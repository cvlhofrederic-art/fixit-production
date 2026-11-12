// ── AJ Signalement — diffusion : jeton un clic effacé des événements Sentry (PR 3, lot 6) ───────────────────────────
//
// Cahier PR 3 § 8.2 (« Journalisation ») : l'adresse un clic de l'en-tête List-Unsubscribe
// (/api/aj-signalement/desinscription/un-clic/<jeton>) est appelée en clair par les messageries. Son jeton ne permet que
// de s'opposer (lib/aj-signalement/diffusion-lien.ts), mais il reste propre à une personne : il ne part pas chez Sentry.
// Toute chaîne de l'événement (adresse de la requête, nom de la transaction, fils d'Ariane, spans, contextes, message,
// exceptions) est relue et le segment qui suit « …/un-clic/ » devient « [jeton] ». Le jeton de la PAGE n'atteint jamais
// le serveur (il est dans le fragment de l'adresse).
//
// Module pur, sans dépendance : importé par sentry.server.config.ts et sentry.edge.config.ts (beforeSend et
// beforeSendTransaction), et par les tests.

/** Segment qui suit le préfixe un clic, jusqu'au prochain séparateur d'adresse ou de texte. */
const MOTIF_JETON_UN_CLIC = /(\/api\/aj-signalement\/desinscription\/un-clic\/)[^/?#\s"'<>]+/g

/** Profondeur au-delà de laquelle l'événement n'est plus parcouru (un événement Sentry est peu profond). */
const PROFONDEUR_MAX = 64

/** Le texte, jeton un clic remplacé par « [jeton] » (toutes ses occurrences). */
export function effacerJetonsUnClicQr(texte: string): string {
  return texte.replace(MOTIF_JETON_UN_CLIC, '$1[jeton]')
}

function parcourir(valeur: unknown, vus: WeakSet<object>, profondeur: number): unknown {
  if (typeof valeur === 'string') return effacerJetonsUnClicQr(valeur)
  if (typeof valeur !== 'object' || valeur === null || profondeur > PROFONDEUR_MAX || vus.has(valeur)) return valeur
  vus.add(valeur)
  if (Array.isArray(valeur)) {
    for (let i = 0; i < valeur.length; i++) valeur[i] = parcourir(valeur[i], vus, profondeur + 1)
    return valeur
  }
  const objet = valeur as Record<string, unknown>
  for (const cle of Object.keys(objet)) objet[cle] = parcourir(objet[cle], vus, profondeur + 1)
  return objet
}

/**
 * Événement Sentry (erreur ou transaction) modifié EN PLACE puis rendu : chaque chaîne, à toute profondeur (structure
 * cyclique comprise), a son jeton un clic effacé. Jamais d'exception.
 */
export function effacerJetonsUnClicSentryQr<E>(evenement: E): E {
  return parcourir(evenement, new WeakSet<object>(), 0) as E
}
