// ── AJ Signalement — diffusion : jetons de désinscription effacés des événements Sentry (PR 3, lot 6) ────────────────
//
// Cahier PR 3 § 8.2 (« Journalisation ») : l'adresse un clic de l'en-tête List-Unsubscribe
// (/api/aj-signalement/desinscription/un-clic/<jeton>) est appelée en clair par les messageries. Son jeton ne permet que
// de s'opposer (lib/aj-signalement/diffusion-lien.ts), mais il reste propre à une personne : il ne part pas chez Sentry.
// Toute chaîne de l'événement (adresse de la requête, nom de la transaction, fils d'Ariane, spans, contextes, message,
// exceptions) est relue et le segment qui suit « …/un-clic/ » devient « [jeton] ». Le jeton de la PAGE n'atteint jamais
// le serveur (il est dans le fragment de l'adresse).
//
// Navigateur (relecture 2 de la PR 3) : la page /<identifiant>/desinscription/ lit son jeton (de page, ou un clic après la
// redirection D-P5b) dans le FRAGMENT de l'adresse, puis l'efface par history.replaceState. Le SDK du navigateur enregistre
// cet effacement comme fil d'Ariane « navigation » dont « from » est l'adresse d'AVANT, fragment compris ; une erreur
// levée avant l'effacement porte le fragment dans request.url. instrumentation-client.ts passe donc chaque fil d'Ariane,
// chaque erreur et chaque transaction par effacerJetonsDesinscriptionSentryQr : tout jeton de lien de diffusion (forme
// fixe <32 hexadécimaux>.<64 hexadécimaux>), où qu'il soit, devient « [jeton] » ; le chemin de la page reste lisible.
//
// Module pur, sans dépendance : importé par sentry.server.config.ts, sentry.edge.config.ts (beforeSend et
// beforeSendTransaction), instrumentation-client.ts (beforeBreadcrumb, beforeSend, beforeSendTransaction), et par les tests.

/** Segment qui suit le préfixe un clic, jusqu'au prochain séparateur d'adresse ou de texte. */
const MOTIF_JETON_UN_CLIC = /(\/api\/aj-signalement\/desinscription\/un-clic\/)[^/?#\s"'<>]+/g

/**
 * Jeton d'un lien de diffusion, de page ou un clic (`<identifiant, 32 hex>.<HMAC-SHA-256, 64 hex>`), où qu'il soit : en
 * fragment, en chemin ou dans un texte. Insensible à la casse ; sur-effacer est sans risque.
 */
const MOTIF_JETON_DIFFUSION = /[a-f0-9]{32}\.[a-f0-9]{64}/gi

/** Profondeur au-delà de laquelle l'événement n'est plus parcouru (un événement Sentry est peu profond). */
const PROFONDEUR_MAX = 64

/** Le texte, jeton un clic remplacé par « [jeton] » (toutes ses occurrences). */
export function effacerJetonsUnClicQr(texte: string): string {
  return texte.replace(MOTIF_JETON_UN_CLIC, '$1[jeton]')
}

/** Le texte, tout jeton de lien de diffusion (de page ou un clic, fragment compris) remplacé par « [jeton] ». */
export function effacerJetonsDesinscriptionQr(texte: string): string {
  return effacerJetonsUnClicQr(texte).replace(MOTIF_JETON_DIFFUSION, '[jeton]')
}

function parcourir(valeur: unknown, effacer: (texte: string) => string, vus: WeakSet<object>, profondeur: number): unknown {
  if (typeof valeur === 'string') return effacer(valeur)
  if (typeof valeur !== 'object' || valeur === null || profondeur > PROFONDEUR_MAX || vus.has(valeur)) return valeur
  vus.add(valeur)
  if (Array.isArray(valeur)) {
    for (let i = 0; i < valeur.length; i++) valeur[i] = parcourir(valeur[i], effacer, vus, profondeur + 1)
    return valeur
  }
  const objet = valeur as Record<string, unknown>
  for (const cle of Object.keys(objet)) objet[cle] = parcourir(objet[cle], effacer, vus, profondeur + 1)
  return objet
}

/**
 * Événement Sentry (erreur ou transaction) modifié EN PLACE puis rendu : chaque chaîne, à toute profondeur (structure
 * cyclique comprise), a son jeton un clic effacé. Jamais d'exception.
 */
export function effacerJetonsUnClicSentryQr<E>(evenement: E): E {
  return parcourir(evenement, effacerJetonsUnClicQr, new WeakSet<object>(), 0) as E
}

/**
 * Navigateur : événement, transaction ou fil d'Ariane Sentry modifié EN PLACE puis rendu, tout jeton de lien de diffusion
 * effacé de chaque chaîne (fragment de l'adresse compris), à toute profondeur. Jamais d'exception.
 */
export function effacerJetonsDesinscriptionSentryQr<E>(evenement: E): E {
  return parcourir(evenement, effacerJetonsDesinscriptionQr, new WeakSet<object>(), 0) as E
}
