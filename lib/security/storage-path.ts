/**
 * Chemins d'objets Supabase Storage manipulés par le serveur en service role (RLS contournée).
 *
 * Le client Storage place le chemin tel quel dans l'URL de l'API (/object/{bucket}/{chemin}) : un
 * segment « .. » (ou « %2e%2e », que l'analyseur d'URL traite pareil) remonterait hors du dossier,
 * voire du bucket visé, et « ? » ou « # » couperaient le chemin pour viser un autre objet.
 *
 * Deux usages :
 * - buildStoragePath(...) : chemins construits par le serveur (dépôt, listage). Chaque segment vient
 *   d'une liste blanche stricte (identifiants, UUID, noms générés), jamais d'un nom de fichier client.
 * - assertStoragePath(...) : chemins relus en base (storage_path, pdf_url…) ou renvoyés par Storage,
 *   avant download, createSignedUrl ou remove. Les anciens noms (espaces, accents) restent acceptés ;
 *   la traversée est bloquée et, quand la route le connaît, le chemin doit rester dans le dossier du
 *   propriétaire (préfixe, ou liste de préfixes quand le format a changé au fil du temps).
 *
 * Une StoragePathError se traduit par une réponse 400 générique, sans détail du chemin : le chemin
 * n'est jamais renvoyé au client ni journalisé (les messages d'erreur ne le contiennent pas).
 */
export class StoragePathError extends Error {
  constructor(message = 'Chemin de stockage invalide') {
    super(message)
    this.name = 'StoragePathError'
  }
}

/** Segment généré côté serveur : lettre ou chiffre en tête, puis [A-Za-z0-9._-], 128 caractères au plus. */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

const LONGUEUR_MAX = 1024

/** Caractères de contrôle (dont retour à la ligne et NUL) et séparateurs d'URL (« ? », « # »). */
const CARACTERES_INTERDITS = /[\u0000-\u001f\u007f?#]/

/** Préfixe attendu : un dossier, ou plusieurs dossiers possibles (les valeurs nulles sont ignorées). */
export type PrefixeAutorise = string | ReadonlyArray<string | null | undefined>

export function safeSegment(value: unknown): string {
  if (typeof value !== 'string' || !SEGMENT.test(value) || value.includes('..')) {
    throw new StoragePathError('Segment de chemin invalide')
  }
  return value
}

export function buildStoragePath(...segments: unknown[]): string {
  if (segments.length === 0) throw new StoragePathError('Chemin vide')
  return segments.map(safeSegment).join('/')
}

export function assertStoragePath(value: unknown, expectedPrefix?: PrefixeAutorise): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > LONGUEUR_MAX) {
    throw new StoragePathError('Chemin vide ou trop long')
  }
  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    throw new StoragePathError('Encodage invalide')
  }
  for (const p of [value, decoded]) {
    if (p.startsWith('/') || p.includes('\\') || CARACTERES_INTERDITS.test(p)) {
      throw new StoragePathError('Chemin interdit')
    }
    if (p.split('/').some((s) => s === '' || s === '.' || s === '..')) {
      throw new StoragePathError('Traversée interdite')
    }
  }
  if (expectedPrefix !== undefined) {
    // Un préfixe demandé mais vide (valeur absente, liste sans dossier) refuse tout : jamais de
    // contrôle sauté en silence.
    const prefixes = (typeof expectedPrefix === 'string' ? [expectedPrefix] : expectedPrefix)
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .map((p) => (p.endsWith('/') ? p : `${p}/`))
    if (prefixes.length === 0 || !prefixes.some((prefix) => value.startsWith(prefix))) {
      throw new StoragePathError('Hors du dossier autorisé')
    }
  }
  return value
}
