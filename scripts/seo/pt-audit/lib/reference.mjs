// Format de la référence SEO PT (data/seo/reference-seo-pt.json, écrite par pt-tests.mjs --mode reference).
// Ses valeurs viennent du site audité, donc du réseau : empreintes des sitemaps (T2, T9), statut, canonique,
// title et hreflang des pages FR mesurées (T9), règles robots.txt hors PT (T11). pt-tests n'écrit la référence
// que si referenceValide l'accepte (CodeQL js/http-to-file-access) : une réponse inattendue ne peut ni grossir
// le fichier au-delà des bornes ni en changer la forme. Importé par pt-tests.mjs et par les tests
// (tests/seo/pt-tests-reference.test.ts).

/** Bornes larges : la référence du 13/10/2026 a 30 pages FR, des titles de 101 caractères au plus et 4 hreflang par page. */
export const BORNES_REFERENCE = Object.freeze({ texte: 2048, liste: 200, pages: 500 })

/** Référence refusée avant écriture : le CLI n'affiche que son message, sans pile d'appels. */
export class ErreurReference extends Error {
  constructor(message) {
    super(message)
    this.name = 'ErreurReference'
  }
}

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
// Chaîne d'au plus BORNES_REFERENCE.texte caractères, sans caractère de contrôle
const texteBorne = (v) => typeof v === 'string' && v.length <= BORNES_REFERENCE.texte && !/\p{Cc}/u.test(v)
const listeBornee = (v) => Array.isArray(v) && v.length <= BORNES_REFERENCE.liste && v.every(texteBorne)
const cheminBorne = (v) => texteBorne(v) && v.startsWith('/')
const CHAMPS_MESURE = ['status', 'canonical', 'title', 'hreflang']

/** Écart d'une mesure de page FR (T9) : statut HTTP entier, canonique, title et hreflang bornés. */
function problemeMesure(m) {
  if (!estObjet(m)) return 'mesure attendue'
  if (Object.keys(m).some((k) => !CHAMPS_MESURE.includes(k))) return 'champ inattendu'
  if (!Number.isInteger(m.status) || m.status < 0 || m.status > 599) return 'statut HTTP entier attendu'
  if (!texteBorne(m.canonical)) return 'canonique hors bornes'
  if (!texteBorne(m.title)) return 'title hors bornes'
  if (!listeBornee(m.hreflang)) return 'hreflang hors bornes'
  return ''
}

function problemePagesFr(fr) {
  if (!estObjet(fr)) return 'pages attendues'
  const pages = Object.entries(fr)
  if (pages.length > BORNES_REFERENCE.pages) return pages.length + ' pages, au plus ' + BORNES_REFERENCE.pages
  for (const [chemin, m] of pages) {
    if (!cheminBorne(chemin)) return 'chemin de page hors bornes'
    const ecart = problemeMesure(m)
    if (ecart) return chemin + ' : ' + ecart
  }
  return ''
}

/** Écart d'une entrée : seules les clés que pt-tests écrit sont admises. */
function problemeEntree(cle, v) {
  if (cle === 'date' || cle === 'base') return texteBorne(v) ? '' : 'texte hors bornes'
  if (cle === 'fr') return problemePagesFr(v)
  if (cle === 'robots_hors_pt') return listeBornee(v) ? '' : 'règles hors bornes'
  if (cle.startsWith('sha256_') && cheminBorne(cle.slice('sha256_'.length))) {
    return typeof v === 'string' && /^[\da-f]{64}$/.test(v) ? '' : 'empreinte SHA-256 attendue'
  }
  return 'clé inattendue'
}

/** Premier écart de `ref` au format d'une référence, sans recopier la valeur fautive ; '' si elle est conforme. */
export function problemeReference(ref) {
  if (!estObjet(ref)) return 'objet attendu'
  for (const [cle, v] of Object.entries(ref)) {
    const ecart = problemeEntree(cle, v)
    if (ecart) return (texteBorne(cle) ? cle : 'clé hors bornes') + ' : ' + ecart
  }
  return ''
}

/** Garde avant l'écriture du fichier : vrai si `ref` a la forme d'une référence et des valeurs bornées. */
export function referenceValide(ref) {
  return problemeReference(ref) === ''
}
