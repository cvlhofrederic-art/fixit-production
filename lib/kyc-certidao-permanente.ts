// Lecture du texte d'une certidão permanente du registre commercial portugais, pièce que dépose une société BTP
// inscrite en portugais (marché KYC pt_btp, lib/kyc-orchestrate.ts). Le texte vient de la lecture de l'image par un
// modèle : mise en page libre (lignes « Libellé : valeur », libellé seul puis valeur à la ligne, rubriques enchaînées
// sur une ligne, tableau, puces et gras Markdown), libellés en majuscules ou non, chiffres parfois groupés par trois.
// Fonctions pures, sans réseau ; expressions sans retour arrière coûteux (texte fourni par l'inscrit, via le modèle).

export interface CertidaoLue {
  /** NIPC de la matrícula : le premier numéro de 9 chiffres qui suit « NIPC » ou « Matrícula ». */
  nipc: string | null
  /** Le NIPC de la matrícula est celui que la société a déclaré. Écrit ailleurs (associé, titulaire), il ne compte pas. */
  nipcDeclarePresent: boolean
  /** Firma (dénomination) de la société, lue sur son libellé « Firma » ou « Denominação ». */
  firma: string | null
  /** Gérant ou administrateur, lu sur son libellé : montré à l'administrateur, jamais compté dans le score. */
  gerente: string | null
  /** Código de acesso (0000-0000-0000) : l'administrateur consulte la certidão en ligne avec ce code. */
  codigoAcesso: string | null
  /** Fin de validité de la certidão (AAAA-MM-JJ). */
  validaAte: string | null
}

// Le modèle rend au plus quelques milliers de caractères : au-delà, le texte n'est pas une certidão lue.
const LONGUEUR_MAX = 20_000
// Une firma ou un nom tient en une ligne courte : la valeur lue est bornée avant tout traitement.
const LONGUEUR_VALEUR = 200
// Libellé d'une autre rubrique de la matrícula, suivi de deux-points : une firma lue sur une ligne qui enchaîne les
// rubriques s'arrête avant lui (« Obras Capital - Construções, Lda » reste entière).
const RUBRIQUE_SUIVANTE = /(?<=[ \t])(?:natureza[ \t]+jur[ií]dica|sede|nipc|nif|matr[ií]cula|capital|obje(?:c)?to|cae)[ \t]*:.*$/i

/**
 * Texte ramené à des lignes « libellé : valeur » : gras et titres Markdown retirés, cellules de tableau à la ligne,
 * puces et numéros de début de ligne retirés.
 */
function normaliser(texte: string): string {
  return texte
    .slice(0, LONGUEUR_MAX)
    .replace(/[*#`]/g, '')
    .replace(/\|/g, '\n')
    .replace(/\r/g, '')
    .replace(/^[ \t]*(?:[-•–]|\d{1,2}[.)])[ \t]+/gm, '')
}

/**
 * Valeur d'un libellé : en début de ligne après un séparateur, ou seule sur la ligne suivante quand le libellé est
 * seul ; sinon après le libellé et deux-points, au milieu d'une ligne qui enchaîne les rubriques.
 */
function valeurApres(texte: string, libelle: string): string | null {
  const motifs = [
    `^[ \\t]*(?:${libelle})[ \\t]*[:.–—-][ \\t]*(\\S[^\\n]*)$`,
    `^[ \\t]*(?:${libelle})[ \\t]*(?::[ \\t]*)?\\n[ \\t]*(\\S[^\\n]*)$`,
    `(?<=[ \\t])(?:${libelle})[ \\t]*:[ \\t]*(\\S[^\\n]*)$`,
  ]
  for (const motif of motifs) {
    const trouve = new RegExp(motif, 'im').exec(texte)
    if (trouve) return trouve[1].slice(0, LONGUEUR_VALEUR).trim()
  }
  return null
}

function lireFirma(texte: string): string | null {
  const valeur = valeurApres(texte, 'firma(?:[ \\t]*\\/[ \\t]*denomina[cç][aã]o)?|denomina[cç][aã]o(?:[ \\t]+social)?')
  if (!valeur) return null
  const firma = valeur.replace(RUBRIQUE_SUIVANTE, '').trim()
  return firma.length >= 2 ? firma.slice(0, 160) : null
}

function lireGerente(texte: string): string | null {
  const valeur = valeurApres(texte, 'gerente(?:s)?|ger[eê]ncia|administrador(?:es)?')
  if (!valeur) return null
  // « Gerência » seule sur sa ligne : la ligne suivante porte « Nome/Firma: … » ; la personne est suivie de son NIF.
  const nom = valeur.replace(/^nome(?:[ \t]*\/[ \t]*firma)?[ \t]*:[ \t]*/i, '').split(/,|[ \t]+NIF\b/i)[0].trim()
  return nom.length >= 3 ? nom.slice(0, 100) : null
}

function lireCodigoAcesso(texte: string): string | null {
  const m = /c[oó]digo[ \t]+de[ \t]+acesso\s*(?:[:.–-]\s*)?(\d{4})[ \t]*-[ \t]*(\d{4})[ \t]*-[ \t]*(\d{4})/i.exec(texte)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

/** Date AAAA-MM-JJ ; null si le jour ou le mois est impossible. */
function dateIso(annee: string, mois: string, jour: string): string | null {
  const m = Number(mois)
  const j = Number(jour)
  if (m < 1 || m > 12 || j < 1 || j > 31) return null
  return `${annee}-${mois}-${jour}`
}

/** Fin de validité, écrite AAAA-MM-JJ ou JJ/MM/AAAA (JJ.MM.AAAA, JJ-MM-AAAA). */
function lireValidaAte(texte: string): string | null {
  const m = /v[aá]lida[ \t]+at[eé]\s*(?:[:.–-]\s*)?(?:(\d{4})-(\d{2})-(\d{2})|(\d{2})[/.-](\d{2})[/.-](\d{4}))/i.exec(texte)
  if (!m) return null
  return m[1] ? dateIso(m[1], m[2], m[3]) : dateIso(m[6], m[5], m[4])
}

function lireNipc(texte: string, nipcDeclare: string): { nipc: string | null; nipcDeclarePresent: boolean } {
  const libelle = /(?:nipc|matr[ií]cula)\D{0,30}(\d{3})[\s.-]?(\d{3})[\s.-]?(\d{3})(?!\d)/i.exec(texte)
  const nipc = libelle ? `${libelle[1]}${libelle[2]}${libelle[3]}` : null
  return { nipc, nipcDeclarePresent: nipc !== null && nipc === nipcDeclare }
}

/** Lit la certidão d'après son texte ; `nipcDeclare` est le NIPC de la fiche (9 chiffres, sans espace). */
export function lireCertidaoPermanente(texte: string, nipcDeclare: string): CertidaoLue {
  const propre = normaliser(texte)
  return {
    ...lireNipc(propre, nipcDeclare),
    firma: lireFirma(propre),
    gerente: lireGerente(propre),
    codigoAcesso: lireCodigoAcesso(propre),
    validaAte: lireValidaAte(propre),
  }
}
