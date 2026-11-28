/**
 * Sérialise un objet JSON-LD pour l'injecter dans <script type="application/ld+json">.
 *
 * JSON.stringify n'échappe pas « < » : une valeur saisie par un utilisateur (nom d'entreprise
 * d'un artisan, par exemple) contenant « </script><script>… » fermerait la balise et
 * exécuterait du code sur la page publique (XSS stockée). On échappe donc <, >, & et les
 * séparateurs U+2028 / U+2029 en séquences \uXXXX, que tout parseur JSON relit à l'identique.
 */
export function serialiserJsonLd(donnees: unknown): string {
  return JSON.stringify(donnees)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
